import { Injectable } from '@nestjs/common';
import { BookingSide, BookingStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { conflict, notFound, unprocessable } from '../../common/errors';
import { moneyCents, text } from '../../common/validation';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { publicArtistCardSelect, toArtistCard } from '../artists/artist.presenter';
import { mediaUrl } from '../media/media.service';
import { assertBookingTransition, assertCanConfirm, assertCanRespondToOffer, MESSAGE_ALLOWED, resolveSide } from './booking.rules';

const futureDate = z.iso
  .datetime({ offset: true, error: 'Data/hora inválida.' })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() > Date.now(), 'A data da apresentação deve estar no futuro.');

export const OfferSchema = z
  .object({
    performanceAt: futureDate,
    durationMinutes: z.number().int().min(15, 'Duração mínima: 15 minutos.').max(720),
    feeCents: moneyCents,
    terms: z.string().trim().max(2000).default(''),
  })
  .strict();

export const DirectProposalSchema = z
  .object({
    organizationId: z.uuid(),
    artistId: z.uuid(),
    title: text(3, 120, 'Título').optional(),
    offer: OfferSchema,
    message: z.string().trim().max(2000).optional(),
  })
  .strict();

export const FromApplicationSchema = z
  .object({ title: text(3, 120, 'Título').optional(), offer: OfferSchema, message: z.string().trim().max(2000).optional() })
  .strict();

export const MessageSchema = z.object({ body: text(1, 2000, 'Mensagem') }).strict();
export const CancelSchema = z.object({ reason: z.string().trim().max(500).optional() }).strict();
export const PerformanceSchema = z.object({ notes: z.string().trim().max(1000).default('') }).strict();

type OfferInput = z.infer<typeof OfferSchema>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private async sidesFor(userId: string, booking: { organizationId: string; artistId: string }, db?: Tx) {
    const sides = new Set<BookingSide>();
    const [orgRole, artistAccess] = await Promise.all([
      this.access.orgRole(userId, booking.organizationId, db),
      this.access.artistAccess(userId, booking.artistId, db),
    ]);
    if (orgRole) sides.add('VENUE');
    if (artistAccess?.canManage) sides.add('ARTIST');
    return sides;
  }

  private async lock(tx: Tx, bookingId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Booking" WHERE id = ${bookingId}::uuid FOR UPDATE`;
    if (!rows.length) throw notFound('Negociação não encontrada.');
    return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  }

  private async logStatus(tx: Tx, bookingId: string, from: BookingStatus | null, to: BookingStatus, actorId: string, side: BookingSide | null, note?: string) {
    await tx.bookingStatusChange.create({ data: { bookingId, fromStatus: from, toStatus: to, actorId, actorSide: side, note: note ?? null } });
  }

  // ─────────── Criação (dois caminhos → mesmo fluxo) ───────────

  private async createBooking(
    tx: Tx,
    userId: string,
    data: { origin: 'DIRECT' | 'APPLICATION'; organizationId: string; artistId: string; eventId: string | null; applicationId: string | null; title: string },
    offer: OfferInput,
    message?: string,
  ) {
    const booking = await tx.booking.create({ data: { ...data, createdById: userId, status: 'NEGOTIATING' } });
    await this.logStatus(tx, booking.id, null, 'NEGOTIATING', userId, 'VENUE', data.origin === 'DIRECT' ? 'Proposta direta' : 'Iniciada a partir de candidatura');
    await tx.bookingOffer.create({ data: { bookingId: booking.id, authorId: userId, authorSide: 'VENUE', ...offer } });
    if (message) await tx.bookingMessage.create({ data: { bookingId: booking.id, authorId: userId, authorSide: 'VENUE', body: message } });
    return booking.id;
  }

  /** Proposta direta pelo marketplace: casa → artista/banda público. Independente de candidatura. */
  async createDirect(userId: string, input: z.infer<typeof DirectProposalSchema>) {
    await this.access.assertOrgMember(userId, input.organizationId);
    const artist = await this.prisma.artist.findUnique({ where: { id: input.artistId }, select: { visibility: true, name: true } });
    if (!artist || artist.visibility !== 'PUBLIC') throw notFound('Perfil artístico não encontrado ou não público.');
    const sides = await this.sidesFor(userId, input);
    if (sides.has('ARTIST')) throw conflict('BOTH_SIDES', 'Você administra este perfil artístico; não é possível enviar proposta para si mesmo.');
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { name: true } });
    const id = await this.prisma.$transaction((tx) =>
      this.createBooking(
        tx,
        userId,
        {
          origin: 'DIRECT',
          organizationId: input.organizationId,
          artistId: input.artistId,
          eventId: null,
          applicationId: null,
          title: input.title ?? `${org.name} × ${artist.name}`,
        },
        input.offer,
        input.message,
      ),
    );
    return this.detail(userId, id);
  }

  /** Inicia negociação a partir de candidatura ACEITA. A candidatura permanece registrada. */
  async createFromApplication(userId: string, applicationId: string, input: z.infer<typeof FromApplicationSchema>) {
    const app = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        artistId: true,
        artist: { select: { name: true } },
        event: { select: { id: true, title: true, organizerId: true } },
        booking: { select: { id: true } },
      },
    });
    if (!app) throw notFound('Candidatura não encontrada.');
    await this.access.assertOrgMember(userId, app.event.organizerId);
    if (app.status !== 'ACCEPTED') throw conflict('APPLICATION_NOT_ACCEPTED', 'Aceite a candidatura antes de iniciar a negociação.');
    if (app.booking) throw conflict('BOOKING_EXISTS', 'Já existe uma negociação para esta candidatura.');
    const sides = await this.sidesFor(userId, { organizationId: app.event.organizerId, artistId: app.artistId });
    if (sides.has('ARTIST')) throw conflict('BOTH_SIDES', 'Você administra este perfil artístico; outra pessoa da casa deve conduzir a negociação.');
    const id = await this.prisma.$transaction((tx) =>
      this.createBooking(
        tx,
        userId,
        {
          origin: 'APPLICATION',
          organizationId: app.event.organizerId,
          artistId: app.artistId,
          eventId: app.event.id,
          applicationId: app.id,
          title: input.title ?? `${app.event.title} — ${app.artist.name}`,
        },
        input.offer,
        input.message,
      ),
    );
    return this.detail(userId, id);
  }

  // ─────────── Consulta ───────────

  async list(userId: string) {
    const [artistIds, orgIds] = await Promise.all([this.access.managedArtistIds(userId), this.access.managedOrganizationIds(userId)]);
    const rows = await this.prisma.booking.findMany({
      where: { OR: [{ artistId: { in: artistIds } }, { organizationId: { in: orgIds } }] },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
        artistId: true,
        organization: { select: { id: true, name: true, slug: true, city: true } },
        artist: { select: { id: true, name: true, slug: true, kind: true } },
        event: { select: { id: true, title: true } },
        offers: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, authorSide: true, performanceAt: true, feeCents: true } },
        performance: { select: { id: true, performedAt: true } },
      },
    });
    return rows.map(({ offers, ...b }) => {
      const sides: BookingSide[] = [];
      if (orgIds.includes(b.organizationId)) sides.push('VENUE');
      if (artistIds.includes(b.artistId)) sides.push('ARTIST');
      const latest = offers[0] ?? null;
      const awaitingMe =
        b.status === 'NEGOTIATING' && !!latest && latest.status === 'PENDING' && sides.length === 1 && latest.authorSide !== sides[0];
      const awaitingConfirmation = b.status === 'AGREED' && sides.includes('VENUE') && sides.length === 1;
      return { ...b, mySides: sides, latestOffer: latest, awaitingMe: awaitingMe || awaitingConfirmation };
    });
  }

  async detail(userId: string, bookingId: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        title: true,
        status: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
        confirmedAt: true,
        organizationId: true,
        artistId: true,
        applicationId: true,
        confirmedBy: { select: { name: true } },
        organization: { select: { id: true, name: true, slug: true, city: true, addressLine: true, photoId: true } },
        artist: { select: publicArtistCardSelect },
        event: { select: { id: true, title: true, startsAt: true } },
        offers: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            authorSide: true,
            performanceAt: true,
            durationMinutes: true,
            feeCents: true,
            terms: true,
            status: true,
            createdAt: true,
            respondedAt: true,
            previousOfferId: true,
            author: { select: { name: true } },
            respondedBy: { select: { name: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, authorSide: true, body: true, createdAt: true, author: { select: { id: true, name: true } } },
        },
        statusChanges: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, fromStatus: true, toStatus: true, actorSide: true, note: true, createdAt: true, actor: { select: { name: true } } },
        },
        performance: { select: { id: true, performedAt: true, notes: true, createdAt: true, registeredBy: { select: { name: true } } } },
      },
    });
    if (!b) throw notFound('Negociação não encontrada.');
    const sides = await this.sidesFor(userId, b);
    if (sides.size === 0) throw notFound('Negociação não encontrada.');
    const side = sides.size === 1 ? [...sides][0] : null;
    const pending = b.offers.find((o) => o.status === 'PENDING') ?? null;
    const agreed = b.offers.find((o) => o.status === 'ACCEPTED') ?? null;
    const now = Date.now();
    return {
      ...b,
      organization: { ...b.organization, photoId: undefined, photoUrl: mediaUrl(b.organization.photoId) },
      artist: toArtistCard(b.artist),
      messages: b.messages.map((m) => ({ ...m, author: m.author ? { name: m.author.name, isMe: m.author.id === userId } : null })),
      mySide: side,
      bothSides: sides.size > 1,
      pendingOffer: pending,
      agreedOffer: agreed,
      allowed: {
        respond: !!side && b.status === 'NEGOTIATING' && !!pending && pending.authorSide !== side,
        confirm: side === 'VENUE' && b.status === 'AGREED',
        cancel: !!side && ['NEGOTIATING', 'AGREED', 'CONFIRMED'].includes(b.status),
        message: !!side && MESSAGE_ALLOWED.includes(b.status),
        registerPerformance: !!side && b.status === 'CONFIRMED' && !b.performance && !!agreed && agreed.performanceAt.getTime() <= now,
      },
    };
  }

  // ─────────── Ações ───────────

  private async act<T>(userId: string, bookingId: string, fn: (tx: Tx, booking: Prisma.BookingGetPayload<object>, side: BookingSide) => Promise<T>) {
    await this.prisma.$transaction(async (tx) => {
      const booking = await this.lock(tx, bookingId);
      const side = resolveSide(await this.sidesFor(userId, booking, tx));
      await fn(tx, booking, side);
    });
    return this.detail(userId, bookingId);
  }

  async respond(userId: string, bookingId: string, offerId: string, response: 'accept' | 'decline' | 'counter', counter?: OfferInput) {
    return this.act(userId, bookingId, async (tx, booking, side) => {
      const offer = await tx.bookingOffer.findFirst({ where: { id: offerId, bookingId } });
      if (!offer) throw notFound('Proposta não encontrada.');
      assertCanRespondToOffer({ bookingStatus: booking.status, offerStatus: offer.status, offerAuthorSide: offer.authorSide, actingSide: side });
      const now = new Date();
      if (response === 'accept') {
        await tx.bookingOffer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED', respondedAt: now, respondedById: userId } });
        assertBookingTransition(booking.status, 'AGREED');
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'AGREED' } });
        await this.logStatus(tx, booking.id, booking.status, 'AGREED', userId, side, 'Proposta aceita — aguardando confirmação da casa');
      } else if (response === 'decline') {
        await tx.bookingOffer.update({ where: { id: offer.id }, data: { status: 'DECLINED', respondedAt: now, respondedById: userId } });
        assertBookingTransition(booking.status, 'DECLINED');
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'DECLINED' } });
        await this.logStatus(tx, booking.id, booking.status, 'DECLINED', userId, side, 'Proposta recusada');
      } else {
        if (!counter) throw unprocessable('VALIDATION_ERROR', 'Informe os termos da contraproposta.');
        // A oferta anterior é preservada (apenas marcada como SUPERSEDED); a contraproposta é uma nova linha.
        await tx.bookingOffer.update({ where: { id: offer.id }, data: { status: 'SUPERSEDED', respondedAt: now, respondedById: userId } });
        await tx.bookingOffer.create({ data: { bookingId: booking.id, authorId: userId, authorSide: side, previousOfferId: offer.id, ...counter } });
        await tx.booking.update({ where: { id: booking.id }, data: { updatedAt: now } });
      }
    });
  }

  /** Confirmação explícita e auditável, feita pela casa após termos acordados. */
  async confirm(userId: string, bookingId: string) {
    return this.act(userId, bookingId, async (tx, booking, side) => {
      assertCanConfirm(booking.status, side);
      const now = new Date();
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED', confirmedAt: now, confirmedById: userId } });
      await this.logStatus(tx, booking.id, booking.status, 'CONFIRMED', userId, side, 'Contratação confirmada (pagamento é externo à plataforma)');
    });
  }

  async cancel(userId: string, bookingId: string, reason?: string) {
    return this.act(userId, bookingId, async (tx, booking, side) => {
      assertBookingTransition(booking.status, 'CANCELLED');
      const perf = await tx.performance.findUnique({ where: { bookingId: booking.id }, select: { id: true } });
      if (perf) throw conflict('PERFORMANCE_REGISTERED', 'A apresentação já foi registrada como realizada.');
      await tx.bookingOffer.updateMany({ where: { bookingId: booking.id, status: 'PENDING' }, data: { status: 'WITHDRAWN', respondedAt: new Date(), respondedById: userId } });
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
      await this.logStatus(tx, booking.id, booking.status, 'CANCELLED', userId, side, reason || 'Negociação encerrada');
    });
  }

  async message(userId: string, bookingId: string, body: string) {
    return this.act(userId, bookingId, async (tx, booking, side) => {
      if (!MESSAGE_ALLOWED.includes(booking.status)) throw conflict('BOOKING_CLOSED', 'Esta negociação está encerrada.');
      await tx.bookingMessage.create({ data: { bookingId: booking.id, authorId: userId, authorSide: side, body } });
      await tx.booking.update({ where: { id: booking.id }, data: { updatedAt: new Date() } });
    });
  }

  /** Registra a apresentação como realizada (Performance), distinta do booking confirmado. */
  async registerPerformance(userId: string, bookingId: string, notes: string) {
    return this.act(userId, bookingId, async (tx, booking) => {
      if (booking.status !== 'CONFIRMED') throw conflict('NOT_CONFIRMED', 'Só é possível registrar apresentações de contratações confirmadas.');
      const agreed = await tx.bookingOffer.findFirst({ where: { bookingId: booking.id, status: 'ACCEPTED' } });
      if (!agreed) throw conflict('NO_AGREED_OFFER', 'Não há termos acordados nesta negociação.');
      if (agreed.performanceAt.getTime() > Date.now()) throw unprocessable('PERFORMANCE_IN_FUTURE', 'A data da apresentação ainda não chegou.');
      const exists = await tx.performance.findUnique({ where: { bookingId: booking.id }, select: { id: true } });
      if (exists) throw conflict('PERFORMANCE_EXISTS', 'A apresentação já foi registrada.');
      await tx.performance.create({
        data: { bookingId: booking.id, artistId: booking.artistId, organizationId: booking.organizationId, performedAt: agreed.performanceAt, notes, registeredById: userId },
      });
    });
  }
}
