import { Controller, Injectable, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { BookingSide, Prisma } from '@prisma/client';
import { z } from 'zod';
import { conflict, notFound, unprocessable } from '../../common/errors';
import { ApiZodBody, ZBody } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { NotificationsService } from '../notifications/notifications.service';
import { averageRating, reviewEligibility } from './review.rules';

export const ReviewSchema = z
  .object({
    rating: z.number().int('A nota deve ser um número inteiro.').min(0, 'Nota de 0 a 5.').max(5, 'Nota de 0 a 5.'),
    comment: z.string().trim().max(1000).default(''),
  })
  .strict();

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Lado de quem avalia nesta contratação (contratante ou artista). Quem está nos dois lados não avalia. */
  async sideOf(userId: string, booking: { organizationId: string; artistId: string }): Promise<BookingSide | null> {
    const [role, artist] = await Promise.all([this.access.orgRole(userId, booking.organizationId), this.access.artistAccess(userId, booking.artistId)]);
    const venue = !!role;
    const art = !!artist?.canManage;
    if (venue && art) throw conflict('BOTH_SIDES', 'Você administra os dois lados desta contratação.');
    return venue ? 'VENUE' : art ? 'ARTIST' : null;
  }

  async create(userId: string, bookingId: string, input: z.infer<typeof ReviewSchema>) {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        title: true,
        organizationId: true,
        artistId: true,
        performance: { select: { id: true } },
        offers: { where: { status: 'ACCEPTED' }, select: { performanceAt: true }, take: 1 },
        reviews: { select: { authorSide: true } },
      },
    });
    if (!b) throw notFound('Negociação não encontrada.');
    const side = await this.sideOf(userId, b);
    if (!side) throw notFound('Negociação não encontrada.');
    const check = reviewEligibility({
      bookingStatus: b.status,
      performanceAt: b.offers[0]?.performanceAt ?? null,
      performanceRegistered: !!b.performance,
      side,
      existingSides: b.reviews.map((r) => r.authorSide),
      now: new Date(),
    });
    if (!check.canReview) throw unprocessable('REVIEW_NOT_ALLOWED', check.reason ?? 'Avaliação indisponível.');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.review.create({ data: { bookingId, authorSide: side, authorId: userId, rating: input.rating, comment: input.comment } });
        const target = side === 'VENUE' ? await this.access.artistManagerUserIds(b.artistId, tx) : await this.access.organizationMemberUserIds(b.organizationId, tx);
        await this.notifications.notify(
          tx,
          target.filter((id) => id !== userId),
          {
            category: 'BOOKINGS',
            type: 'REVIEW_RECEIVED',
            title: 'Você recebeu uma avaliação',
            body: `Nova avaliação (${input.rating} de 5) em "${b.title}".`,
            link: `/painel/negociacoes/${bookingId}`,
            dedupeKey: `review-received:${bookingId}:${side}`,
          },
        );
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('REVIEW_EXISTS', 'Você já avaliou esta apresentação.');
      throw e;
    }
    await this.notifications.flush();
    return { ok: true };
  }

  /** Resumo público: avaliações recebidas por um artista (escritas pelos contratantes). */
  async forArtist(artistId: string) {
    return this.summary({ authorSide: 'VENUE', booking: { artistId } }, 'organization');
  }

  /** Resumo público: avaliações recebidas por uma casa/contratante (escritas pelos artistas). */
  async forOrganization(organizationId: string) {
    return this.summary({ authorSide: 'ARTIST', booking: { organizationId } }, 'artist');
  }

  private async summary(where: Prisma.ReviewWhereInput, author: 'organization' | 'artist') {
    const [all, recent] = await Promise.all([
      this.prisma.review.findMany({ where, select: { rating: true } }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, rating: true, comment: true, createdAt: true, booking: { select: { organization: { select: { name: true } }, artist: { select: { name: true } } } } },
      }),
    ]);
    return {
      average: averageRating(all.map((r) => r.rating)),
      count: all.length,
      recent: recent.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        authorName: author === 'organization' ? r.booking.organization.name : r.booking.artist.name,
      })),
    };
  }
}

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @ApiCookieAuth()
  @Post('bookings/:bookingId/review')
  @ApiZodBody(ReviewSchema)
  create(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) id: string, @ZBody(ReviewSchema) body: z.infer<typeof ReviewSchema>) {
    return this.reviews.create(user.id, id, body);
  }
}

@Module({ controllers: [ReviewsController], providers: [ReviewsService], exports: [ReviewsService] })
export class ReviewsModule {}

