import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { publicationIssues } from '../artists/artist.schemas';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { BookingsModule } from '../bookings/bookings.module';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly bookings: BookingsService,
  ) {}

  /**
   * "Pulso" para atualização em tempo real sem recarregar a página: assinatura barata (uma consulta) de tudo o que
   * pode mudar para o usuário — negociações, ofertas, mensagens, contratos, candidaturas, eventos, notificações e
   * convites. O frontend consulta a cada poucos segundos (aba visível) e recarrega as telas abertas quando muda.
   * Sem fila, Redis ou conexão persistente: funciona igual em várias instâncias serverless.
   */
  async pulse(userId: string) {
    const [artistIds, orgIds] = await Promise.all([this.access.managedArtistIds(userId), this.access.managedOrganizationIds(userId)]);
    const rows = await this.prisma.$queryRaw<{ v: string }[]>`
      WITH b AS (
        SELECT id, "updatedAt" FROM "Booking"
        WHERE "artistId" = ANY(${artistIds}::uuid[]) OR "organizationId" = ANY(${orgIds}::uuid[])
      )
      SELECT concat_ws('|',
        (SELECT count(*) || ':' || coalesce(floor(extract(epoch FROM max("updatedAt")) * 1000), 0) FROM b),
        (SELECT count(*) || ':' || coalesce(floor(extract(epoch FROM max(coalesce(o."respondedAt", o."createdAt"))) * 1000), 0)
           FROM "BookingOffer" o WHERE o."bookingId" IN (SELECT id FROM b)),
        (SELECT count(*) FROM "BookingMessage" m WHERE m."bookingId" IN (SELECT id FROM b)),
        (SELECT count(*) FROM "Contract" c WHERE c."bookingId" IN (SELECT id FROM b)),
        (SELECT count(*) || ':' || coalesce(floor(extract(epoch FROM max(a."updatedAt")) * 1000), 0)
           FROM "EventApplication" a JOIN "Event" e ON e.id = a."eventId"
           WHERE a."artistId" = ANY(${artistIds}::uuid[]) OR e."organizerId" = ANY(${orgIds}::uuid[])),
        (SELECT count(*) || ':' || coalesce(floor(extract(epoch FROM max("updatedAt")) * 1000), 0)
           FROM "Event" WHERE "organizerId" = ANY(${orgIds}::uuid[])),
        (SELECT count(*) || ':' || count(*) FILTER (WHERE "readAt" IS NULL) FROM "Notification" WHERE "userId" = ${userId}::uuid),
        (SELECT count(*) FROM "BandMember" WHERE "userId" = ${userId}::uuid AND status = 'INVITED'),
        (SELECT count(*) FROM "OrganizationMember" WHERE "userId" = ${userId}::uuid AND status = 'INVITED')
      ) AS v`;
    return { v: rows[0]?.v ?? '' };
  }

  /** Painel simples: ações pendentes e próximos compromissos confirmados — sem analytics. */
  async summary(userId: string) {
    const [artistIds, orgIds, bookings] = await Promise.all([
      this.access.managedArtistIds(userId),
      this.access.managedOrganizationIds(userId),
      this.bookings.list(userId),
    ]);
    const [invitations, myPendingApplications, applicationsToReview, musician, schedule] = await Promise.all([
      Promise.all([
        this.prisma.bandMember.count({ where: { userId, status: 'INVITED' } }),
        this.prisma.organizationMember.count({ where: { userId, status: 'INVITED' } }),
      ]).then(([a, b]) => a + b),
      this.prisma.eventApplication.count({ where: { artistId: { in: artistIds }, status: 'PENDING' } }),
      this.prisma.eventApplication.findMany({
        where: { status: 'PENDING', event: { organizerId: { in: orgIds }, status: { in: ['OPEN', 'FILLED', 'CLOSED', 'POSTPONED'] } } },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: { id: true, createdAt: true, artist: { select: { name: true } }, event: { select: { id: true, title: true } } },
      }),
      this.prisma.artist.findFirst({
        where: { musicianProfile: { userId } },
        select: {
          id: true,
          name: true,
          bio: true,
          city: true,
          genres: true,
          visibility: true,
          photoId: true,
          _count: { select: { portfolioItems: true } },
          rider: { select: { _count: { select: { items: true } } } },
        },
      }),
      this.schedule(userId),
    ]);
    const completeness = musician
      ? (() => {
          const checks = [
            { label: 'Dados básicos e descrição', done: publicationIssues(musician).length === 0 },
            { label: 'Foto de perfil', done: !!musician.photoId },
            { label: 'Portfólio com ao menos 1 item', done: musician._count.portfolioItems > 0 },
            { label: 'Rider técnico com ao menos 1 item', done: (musician.rider?._count.items ?? 0) > 0 },
            { label: 'Perfil público', done: musician.visibility === 'PUBLIC' },
          ];
          return { artistId: musician.id, percent: Math.round((checks.filter((c) => c.done).length / checks.length) * 100), checks };
        })()
      : null;
    return {
      invitations,
      myPendingApplications,
      applicationsToReview,
      awaitingMe: bookings.filter((b) => b.awaitingMe).slice(0, 10),
      activeNegotiations: bookings.filter((b) => ['NEGOTIATING', 'AGREED'].includes(b.status)).length,
      upcoming: schedule.upcoming.slice(0, 5),
      profileCompleteness: completeness,
      hasMusicianProfile: !!musician,
      managesBands: artistIds.length - (musician ? 1 : 0) > 0,
      managesVenues: orgIds.length > 0,
    };
  }

  /**
   * Apresentações: "próximas" = bookings CONFIRMED com data futura (não são apresentações realizadas);
   * "histórico" = Performance registradas. Candidaturas/eventos publicados não aparecem como compromisso.
   */
  async schedule(userId: string) {
    const [artistIds, orgIds] = await Promise.all([this.access.managedArtistIds(userId), this.access.managedOrganizationIds(userId)]);
    const participant = { OR: [{ artistId: { in: artistIds } }, { organizationId: { in: orgIds } }] };
    const confirmed = await this.prisma.booking.findMany({
      where: { ...participant, status: 'CONFIRMED', performance: null },
      select: {
        id: true,
        title: true,
        confirmedAt: true,
        artist: { select: { name: true, slug: true } },
        organization: { select: { name: true, slug: true, city: true, type: true } },
        event: { select: { id: true, title: true, visibility: true, locationName: true, locationCity: true } },
        offers: { where: { status: 'ACCEPTED' }, select: { performanceAt: true, durationMinutes: true, feeCents: true } },
      },
    });
    const now = Date.now();
    const items = confirmed
      .filter((b) => b.offers[0])
      .map(({ offers, ...b }) => ({ ...b, performanceAt: offers[0].performanceAt, durationMinutes: offers[0].durationMinutes, feeCents: offers[0].feeCents }))
      .sort((a, b) => a.performanceAt.getTime() - b.performanceAt.getTime());
    const performances = await this.prisma.performance.findMany({
      where: participant,
      orderBy: { performedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        performedAt: true,
        notes: true,
        bookingId: true,
        artist: { select: { name: true, slug: true } },
        organization: { select: { name: true, slug: true, city: true } },
      },
    });
    return {
      upcoming: items.filter((i) => i.performanceAt.getTime() > now),
      awaitingRegistration: items.filter((i) => i.performanceAt.getTime() <= now),
      history: performances,
    };
  }
}

@ApiTags('dashboard')
@ApiCookieAuth()
@Controller('me')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard')
  summary(@CurrentUser() user: AuthUser) {
    return this.dashboard.summary(user.id);
  }

  @Get('schedule')
  schedule(@CurrentUser() user: AuthUser) {
    return this.dashboard.schedule(user.id);
  }

  /** Assinatura do estado do usuário para atualização automática das telas (consulta leve, sem cache). */
  @Get('pulse')
  pulse(@CurrentUser() user: AuthUser) {
    return this.dashboard.pulse(user.id);
  }
}

@Module({ imports: [BookingsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
