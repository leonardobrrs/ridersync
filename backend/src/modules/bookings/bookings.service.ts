import { Injectable } from '@nestjs/common';
import { Booking, BookingSide, BookingStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { conflict, notFound, unprocessable } from '../../common/errors';
import { moneyCents, optionalText, text } from '../../common/validation';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { ContractsService, contractSummarySelect, toContractSummary } from '../contracts/contracts.service';
import { publicArtistCardSelect, toArtistCard } from '../artists/artist.presenter';
import { EventLifecycleService } from '../events/event-lifecycle.service';
import { ACTIVE_EVENT_STATUSES, assertApplicationTransition } from '../events/event.rules';
import { mediaThumbUrl } from '../media/media.service';
import { NotificationInput } from '../notifications/notification.types';
import { NotificationsService } from '../notifications/notifications.service';
import { AgendaService } from './agenda.service';
import { assertBookingTransition, assertCanConfirm, assertCanRespondToOffer, MESSAGE_ALLOWED, resolveSide, unreadCount } from './booking.rules';
import { reviewEligibility } from '../reviews/review.rules';

const futureDate = z.iso
  .datetime({ offset: true, error: 'Data/hora inválida.' })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() > Date.now(), 'A data da apresentação deve estar no futuro.');

const optionalInt = (min: number, max: number, label: string) =>
  z
    .number()
    .int(`${label} inválido.`)
    .min(min, `${label} deve ser de ${min} a ${max}.`)
    .max(max, `${label} deve ser de ${min} a ${max}.`)
    .nullish()
    .transform((v) => v ?? null);
/** Data sem hora (AAAA-MM-DD) → meia-noite UTC, como a coluna DATE do banco. */
const optionalDateOnly = z.iso
  .date({ error: 'Data inválida.' })
  .nullish()
  .transform((s) => (s ? new Date(`${s}T00:00:00.000Z`) : null));

/** Os refinamentos rodam mesmo quando um campo já falhou (ex.: data em formato inválido continua texto). */
const isDate = (v: unknown): v is Date => v instanceof Date && !Number.isNaN(v.getTime());

/** Dia da apresentação no fuso de Maceió (UTC−3, sem horário de verão), à meia-noite UTC — mesma base das colunas DATE. */
const showDateUtc = (performanceAt: Date) => new Date(`${new Date(performanceAt.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)}T00:00:00.000Z`);

/**
 * Termos da oferta. Os campos de contrato (sinal, prazos, forma de pagamento...) são opcionais: o que faltar aparece
 * como "[A PREENCHER]" no contrato gerado na confirmação. O pagamento em si acontece fora da plataforma.
 */
export const OfferSchema = z
  .object({
    performanceAt: futureDate,
    durationMinutes: z.number().int().min(15, 'Duração mínima: 15 minutos.').max(720),
    feeCents: moneyCents,
    terms: z.string().trim().max(2000).default(''),
    presentationDesc: optionalText(300, 'Descrição da apresentação'),
    advanceMinutes: optionalInt(0, 1440, 'Antecedência'),
    signalCents: moneyCents.nullish().transform((v) => v ?? null),
    signalDueDate: optionalDateOnly,
    balanceDueDate: optionalDateOnly,
    paymentMethod: optionalText(80, 'Forma de pagamento'),
    rescissionDays: optionalInt(0, 365, 'Prazo de rescisão'),
    substitutionDays: optionalInt(0, 365, 'Prazo de substituição'),
  })
  .strict()
  .refine((o) => o.signalCents === null || o.signalCents <= o.feeCents, { path: ['signalCents'], message: 'O sinal não pode ser maior que o cachê.' })
  .refine((o) => !isDate(o.signalDueDate) || !isDate(o.performanceAt) || o.signalDueDate.getTime() <= showDateUtc(o.performanceAt).getTime(), {
    path: ['signalDueDate'],
    message: 'O prazo do sinal não pode ser depois da data da apresentação.',
  })
  .refine((o) => !isDate(o.signalDueDate) || !isDate(o.balanceDueDate) || o.signalDueDate.getTime() <= o.balanceDueDate.getTime(), {
    path: ['balanceDueDate'],
    message: 'O prazo do saldo não pode ser antes do prazo do sinal.',
  });

export const DirectProposalSchema = z
  .object({
    organizationId: z.uuid(),
    artistId: z.uuid(),
    /** Convite vinculado a um evento do contratante: ocupa uma vaga enquanto estiver ativo. */
    eventId: z.uuid().optional(),
    title: text(3, 120, 'Título').optional(),
    offer: OfferSchema,
    message: z.string().trim().max(2000).optional(),
  })
  .strict();

/**
 * Selecionar candidatura. Sem `offer`, a negociação começa com as condições publicadas do evento (data, duração,
 * cachê e condições) — o contratante não precisa redigitar o cachê que já ofereceu. `offer` só é necessário quando o
 * evento não tem cachê definido ("a combinar") e o artista não fez contraproposta.
 */
export const FromApplicationSchema = z
  .object({ title: text(3, 120, 'Título').optional(), offer: OfferSchema.optional(), message: z.string().trim().max(2000).optional() })
  .strict();

export const MessageSchema = z.object({ body: text(1, 2000, 'Mensagem') }).strict();
export const CancelSchema = z.object({ reason: z.string().trim().max(500).optional() }).strict();
export const PerformanceSchema = z.object({ notes: z.string().trim().max(1000).default('') }).strict();

type OfferInput = z.infer<typeof OfferSchema>;
type OfferData = Omit<Prisma.BookingOfferUncheckedCreateInput, 'bookingId' | 'authorId' | 'authorSide' | 'previousOfferId' | 'status'>;
interface OfferStep {
  side: BookingSide;
  authorId: string | null;
  data: OfferData;
  status?: 'PENDING' | 'SUPERSEDED';
}

/** Termos publicados do evento como oferta (campos de contrato ficam para a negociação). */
function offerFromEvent(event: { startsAt: Date; durationMinutes: number | null; feeCents: number | null; conditions: string }, feeCents: number): OfferData {
  return { performanceAt: event.startsAt, durationMinutes: event.durationMinutes ?? 60, feeCents, terms: event.conditions };
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly lifecycle: EventLifecycleService,
    private readonly notifications: NotificationsService,
    private readonly agenda: AgendaService,
    private readonly contracts: ContractsService,
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

  private async sideUserIds(tx: Tx, booking: Pick<Booking, 'organizationId' | 'artistId'>, side: BookingSide) {
    return side === 'VENUE' ? this.access.organizationMemberUserIds(booking.organizationId, tx) : this.access.artistManagerUserIds(booking.artistId, tx);
  }

  private async notifySide(tx: Tx, booking: Pick<Booking, 'id' | 'organizationId' | 'artistId'>, side: BookingSide, actorId: string, n: Omit<NotificationInput, 'category' | 'link'>) {
    const users = (await this.sideUserIds(tx, booking, side)).filter((id) => id !== actorId);
    await this.notifications.notify(tx, users, { ...n, category: 'BOOKINGS', link: `/painel/negociacoes/${booking.id}` });
  }

  /**
   * Encerramento sem acordo (recusa/cancelamento): libera a vaga do evento.
   * Candidatura aceita vinculada passa a CANCELLED ("vaga cancelada"). O evento já está bloqueado pelo chamador.
   */
  private async releaseSlot(tx: Tx, booking: Booking) {
    if (!booking.eventId) return;
    if (booking.applicationId) {
      await tx.eventApplication.updateMany({ where: { id: booking.applicationId, status: 'ACCEPTED' }, data: { status: 'CANCELLED' } });
    }
    const event = await tx.event.findUniqueOrThrow({ where: { id: booking.eventId } });
    await this.lifecycle.applySlotChange(tx, event);
  }

  // ─────────── Criação (dois caminhos → mesmo fluxo) ───────────

  private async createBooking(
    tx: Tx,
    userId: string,
    data: { origin: 'DIRECT' | 'APPLICATION'; organizationId: string; artistId: string; eventId: string | null; applicationId: string | null; title: string },
    offers: OfferStep[],
    message?: string,
  ) {
    const booking = await tx.booking.create({ data: { ...data, createdById: userId, status: 'NEGOTIATING' } });
    await this.logStatus(tx, booking.id, null, 'NEGOTIATING', userId, 'VENUE', data.origin === 'DIRECT' ? 'Proposta direta' : 'Iniciada a partir de candidatura');
    let previousOfferId: string | null = null;
    const base = Date.now();
    for (const [i, o] of offers.entries()) {
      const created: { id: string } = await tx.bookingOffer.create({
        data: {
          bookingId: booking.id,
          authorId: o.authorId,
          authorSide: o.side,
          previousOfferId,
          ...o.data,
          status: o.status ?? 'PENDING',
          // Horários crescentes explícitos: a ordem do histórico não depende de empate no mesmo milissegundo.
          createdAt: new Date(base + i),
          ...(o.status === 'SUPERSEDED' ? { respondedAt: new Date(base + i + 1) } : {}),
        },
        select: { id: true },
      });
      previousOfferId = created.id;
    }
    if (message) await tx.bookingMessage.create({ data: { bookingId: booking.id, authorId: userId, authorSide: 'VENUE', body: message } });
    const awaitingVenue = offers[offers.length - 1]?.side === 'ARTIST';
    await this.notifySide(tx, booking, 'ARTIST', userId, {
      type: awaitingVenue ? 'APPLICATION_SELECTED' : 'PROPOSAL_RECEIVED',
      title: awaitingVenue ? 'Candidatura selecionada' : 'Nova proposta de contratação',
      body: awaitingVenue
        ? `Sua candidatura em "${data.title}" foi selecionada. O contratante vai responder à sua contraproposta de cachê.`
        : `Você recebeu a proposta "${data.title}". Responda, aceite ou envie uma contraproposta.`,
      dedupeKey: `proposal:${booking.id}`,
    });
    return booking.id;
  }

  /** Proposta direta (marketplace ou convite para um evento do contratante). */
  async createDirect(userId: string, input: z.infer<typeof DirectProposalSchema>) {
    await this.access.assertOrgMember(userId, input.organizationId);
    const artist = await this.prisma.artist.findUnique({ where: { id: input.artistId }, select: { visibility: true, name: true } });
    if (!artist || artist.visibility !== 'PUBLIC') throw notFound('Perfil artístico não encontrado ou não público.');
    const sides = await this.sidesFor(userId, input);
    if (sides.has('ARTIST')) throw conflict('BOTH_SIDES', 'Você administra este perfil artístico; não é possível enviar proposta para si mesmo.');
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { name: true } });
    const id = await this.prisma.$transaction(async (tx) => {
      let eventTitle: string | null = null;
      if (input.eventId) {
        const event = await this.lifecycle.lock(tx, input.eventId);
        if (event.organizerId !== input.organizationId) throw notFound('Evento não encontrado.');
        if (!ACTIVE_EVENT_STATUSES.includes(event.status) && event.status !== 'DRAFT') throw conflict('EVENT_NOT_ACTIVE', 'Este evento não está mais ativo.');
        // Convite não ocupa vaga: só a contratação confirmada ocupa. Evento já esgotado não recebe convites.
        await this.lifecycle.assertNotFullyBooked(tx, event);
        const duplicate = await tx.booking.count({ where: { eventId: event.id, artistId: input.artistId, status: { in: ['NEGOTIATING', 'AGREED', 'CONFIRMED'] } } });
        if (duplicate) throw conflict('BOOKING_EXISTS', 'Já existe uma negociação ativa com este artista para este evento.');
        eventTitle = event.title;
      }
      const bookingId = await this.createBooking(
        tx,
        userId,
        {
          origin: 'DIRECT',
          organizationId: input.organizationId,
          artistId: input.artistId,
          eventId: input.eventId ?? null,
          applicationId: null,
          title: input.title ?? (eventTitle ? `${eventTitle} — ${artist.name}` : `${org.name} × ${artist.name}`),
        },
        [{ side: 'VENUE', authorId: userId, data: input.offer }],
        input.message,
      );
      if (input.eventId) await this.lifecycle.applySlotChange(tx, await tx.event.findUniqueOrThrow({ where: { id: input.eventId } }));
      return bookingId;
    });
    await this.notifications.flush();
    return this.detail(userId, id);
  }

  /**
   * Inicia negociação a partir de uma candidatura. Candidatura em análise é selecionada (ACCEPTED) na mesma
   * transação — "selecionar" já abre a negociação. Nenhuma vaga é ocupada aqui: só a confirmação ocupa.
   * A candidatura permanece registrada.
   */
  async createFromApplication(userId: string, applicationId: string, input: z.infer<typeof FromApplicationSchema>) {
    const app = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        artistId: true,
        proposedFeeCents: true,
        submittedById: true,
        artist: { select: { name: true } },
        event: { select: { id: true, title: true, organizerId: true } },
        booking: { select: { id: true } },
      },
    });
    if (!app) throw notFound('Candidatura não encontrada.');
    await this.access.assertOrgMember(userId, app.event.organizerId);
    if (!['PENDING', 'ACCEPTED'].includes(app.status)) throw conflict('APPLICATION_NOT_ACCEPTED', 'Esta candidatura não está mais em análise.');
    if (app.booking) throw conflict('BOOKING_EXISTS', 'Já existe uma negociação para esta candidatura.');
    const sides = await this.sidesFor(userId, { organizationId: app.event.organizerId, artistId: app.artistId });
    if (sides.has('ARTIST')) throw conflict('BOTH_SIDES', 'Você administra este perfil artístico; outra pessoa deve conduzir a negociação.');
    const id = await this.prisma.$transaction(async (tx) => {
      const event = await this.lifecycle.lock(tx, app.event.id);
      await this.lifecycle.assertNotFullyBooked(tx, event);
      if (['CANCELLED', 'COMPLETED'].includes(event.status)) throw conflict('EVENT_NOT_ACTIVE', 'Este evento não está mais ativo.');
      const fresh = await tx.eventApplication.findUniqueOrThrow({ where: { id: app.id }, select: { status: true } });
      if (fresh.status === 'PENDING') {
        if (!ACTIVE_EVENT_STATUSES.includes(event.status)) throw conflict('EVENT_NOT_ACTIVE', 'Este evento não está mais ativo.');
        assertApplicationTransition(fresh.status, 'ACCEPTED');
        await tx.eventApplication.update({ where: { id: app.id }, data: { status: 'ACCEPTED', decidedAt: new Date(), decidedById: userId } });
      } else if (fresh.status !== 'ACCEPTED') {
        throw conflict('APPLICATION_NOT_ACCEPTED', 'Esta candidatura não está mais em análise.');
      }
      if (event.startsAt.getTime() <= Date.now()) throw conflict('EVENT_NOT_ACTIVE', 'A data deste evento já passou.');
      // Ofertas iniciais: proposta digitada pelo contratante; senão, as condições publicadas do evento. Se o artista
      // enviou contraproposta na candidatura, ela vem em seguida e é a oferta pendente — quem responde é o contratante.
      const offers: OfferStep[] = [];
      if (input.offer) offers.push({ side: 'VENUE', authorId: userId, data: input.offer });
      else if (event.feeCents != null) offers.push({ side: 'VENUE', authorId: userId, data: offerFromEvent(event, event.feeCents) });
      if (app.proposedFeeCents != null && !input.offer) {
        if (offers.length) offers[0].status = 'SUPERSEDED';
        offers.push({ side: 'ARTIST', authorId: app.submittedById, data: offerFromEvent(event, app.proposedFeeCents) });
      }
      if (!offers.length) {
        throw unprocessable('OFFER_REQUIRED', 'O evento não tem cachê definido: informe a proposta (data, duração e cachê) para iniciar a negociação.');
      }
      return this.createBooking(
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
        offers,
        input.message,
      );
    });
    await this.notifications.flush();
    return this.detail(userId, id);
  }

  /**
   * Contratação direta nas condições publicadas do evento (data, duração, cachê e condições), que o artista aceitou
   * ao se candidatar: cria a negociação já com os termos aceitos e confirmada, numa única transação auditável
   * (NEGOTIATING → AGREED → CONFIRMED). Mantém todas as travas da confirmação normal: vagas, agenda e estado do evento.
   * Para negociar outros termos, use "Selecionar e negociar" (fluxo normal).
   */
  async hireFromApplication(userId: string, applicationId: string) {
    const app = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, artistId: true, proposedFeeCents: true, artist: { select: { name: true } }, event: { select: { id: true, title: true, organizerId: true } }, booking: { select: { id: true } } },
    });
    if (!app) throw notFound('Candidatura não encontrada.');
    if (app.proposedFeeCents != null) {
      throw conflict('APPLICATION_HAS_COUNTER_OFFER', 'O artista enviou uma contraproposta de cachê. Use "Selecionar e negociar" para responder a ela.');
    }
    await this.access.assertOrgMember(userId, app.event.organizerId);
    if (!['PENDING', 'ACCEPTED'].includes(app.status)) throw conflict('APPLICATION_NOT_ACCEPTED', 'Esta candidatura não está mais em análise.');
    if (app.booking) throw conflict('BOOKING_EXISTS', 'Já existe uma negociação para esta candidatura.');
    const sides = await this.sidesFor(userId, { organizationId: app.event.organizerId, artistId: app.artistId });
    if (sides.has('ARTIST')) throw conflict('BOTH_SIDES', 'Você administra este perfil artístico; outra pessoa deve conduzir a contratação.');
    const id = await this.prisma.$transaction(async (tx) => {
      const event = await this.lifecycle.lock(tx, app.event.id);
      if (!ACTIVE_EVENT_STATUSES.includes(event.status)) throw conflict('EVENT_NOT_ACTIVE', 'Este evento não está mais ativo.');
      await this.lifecycle.assertNotFullyBooked(tx, event);
      if (event.feeCents == null) {
        throw unprocessable('EVENT_TERMS_INCOMPLETE', 'O evento não tem cachê definido. Use "Selecionar e negociar" para combinar os termos.');
      }
      const fresh = await tx.eventApplication.findUniqueOrThrow({ where: { id: app.id }, select: { status: true } });
      if (fresh.status === 'PENDING') {
        assertApplicationTransition('PENDING', 'ACCEPTED');
        await tx.eventApplication.update({ where: { id: app.id }, data: { status: 'ACCEPTED', decidedAt: new Date(), decidedById: userId } });
      } else if (fresh.status !== 'ACCEPTED') {
        throw conflict('APPLICATION_NOT_ACCEPTED', 'Esta candidatura não está mais em análise.');
      }
      const now = new Date();
      const booking = await tx.booking.create({
        data: {
          origin: 'APPLICATION',
          organizationId: app.event.organizerId,
          artistId: app.artistId,
          eventId: event.id,
          applicationId: app.id,
          title: `${event.title} — ${app.artist.name}`,
          createdById: userId,
          status: 'AGREED',
        },
      });
      await tx.bookingOffer.create({
        data: {
          bookingId: booking.id,
          authorId: userId,
          authorSide: 'VENUE',
          performanceAt: event.startsAt,
          durationMinutes: event.durationMinutes ?? 60,
          feeCents: event.feeCents,
          terms: event.conditions,
          status: 'ACCEPTED',
          respondedAt: now,
          respondedById: userId,
        },
      });
      await this.logStatus(tx, booking.id, null, 'NEGOTIATING', userId, 'VENUE', 'Contratação direta a partir da candidatura');
      await this.logStatus(tx, booking.id, 'NEGOTIATING', 'AGREED', userId, 'VENUE', 'Condições publicadas do evento, aceitas pelo artista na candidatura');
      await this.agenda.assertNoConflicts(tx, booking);
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED', confirmedAt: now, confirmedById: userId } });
      await this.logStatus(tx, booking.id, 'AGREED', 'CONFIRMED', userId, 'VENUE', 'Contratação confirmada (pagamento é externo à plataforma)');
      await this.lifecycle.applySlotChange(tx, await tx.event.findUniqueOrThrow({ where: { id: event.id } }), now);
      await this.notifySide(tx, booking, 'ARTIST', userId, {
        type: 'BOOKING_CONFIRMED',
        title: 'Você foi contratado!',
        body: `O contratante aceitou sua candidatura em "${event.title}" nas condições publicadas. O show já está na sua agenda.`,
        dedupeKey: `booking-confirmed:${booking.id}`,
      });
      return booking.id;
    });
    await this.notifications.flush();
    await this.contracts.generateAfterConfirmation(id);
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
        organization: { select: { id: true, name: true, slug: true, city: true, type: true } },
        artist: { select: { id: true, name: true, slug: true, kind: true } },
        event: { select: { id: true, title: true, visibility: true } },
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
        organization: { select: { id: true, name: true, slug: true, type: true, city: true, addressLine: true, photoId: true } },
        artist: { select: publicArtistCardSelect },
        event: { select: { id: true, title: true, startsAt: true, visibility: true, status: true } },
        offers: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            authorSide: true,
            performanceAt: true,
            durationMinutes: true,
            feeCents: true,
            terms: true,
            presentationDesc: true,
            advanceMinutes: true,
            signalCents: true,
            signalDueDate: true,
            balanceDueDate: true,
            paymentMethod: true,
            rescissionDays: true,
            substitutionDays: true,
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
        contract: { select: contractSummarySelect },
        reviews: { orderBy: { createdAt: 'asc' }, select: { id: true, authorSide: true, rating: true, comment: true, createdAt: true } },
      },
    });
    if (!b) throw notFound('Negociação não encontrada.');
    const sides = await this.sidesFor(userId, b);
    if (sides.size === 0) throw notFound('Negociação não encontrada.');
    const side = sides.size === 1 ? [...sides][0] : null;
    const pending = b.offers.find((o) => o.status === 'PENDING') ?? null;
    const agreed = b.offers.find((o) => o.status === 'ACCEPTED') ?? null;
    const now = Date.now();
    const { photoId, slug, ...org } = b.organization;
    const read = await this.prisma.bookingRead.findUnique({ where: { bookingId_userId: { bookingId, userId } }, select: { lastReadAt: true } });
    return {
      ...b,
      organization: { ...org, slug: org.type === 'VENUE' ? slug : null, photoUrl: mediaThumbUrl(photoId) },
      artist: toArtistCard(b.artist),
      /** Contrato gerado na confirmação (null enquanto não existir); o download é autenticado. */
      contract: b.contract ? toContractSummary(b.contract) : null,
      messages: b.messages.map((m) => ({ ...m, author: m.author ? { name: m.author.name, isMe: m.author.id === userId } : null })),
      /** Avaliação pós-show: cada lado avalia uma vez (contratante → artista; artista → contratante). */
      review: (() => {
        const check = reviewEligibility({
          bookingStatus: b.status,
          performanceAt: agreed?.performanceAt ?? null,
          performanceRegistered: !!b.performance,
          side: sides.size === 1 ? side : null,
          existingSides: b.reviews.map((r) => r.authorSide),
          now: new Date(now),
        });
        return { canReview: check.canReview, reason: check.reason, mine: b.reviews.find((r) => r.authorSide === side) ?? null, received: b.reviews.find((r) => side && r.authorSide !== side) ?? null };
      })(),
      /** Mensagens da outra parte recebidas depois da última leitura desta pessoa. */
      unreadMessages: unreadCount(b.messages, userId, read?.lastReadAt ?? null),
      mySide: side,
      bothSides: sides.size > 1,
      pendingOffer: pending,
      agreedOffer: agreed,
      /** Comparação de rider disponível na negociação (contexto autorizado), quando a contratante é uma casa com inventário. */
      canCompareRider: b.organization.type === 'VENUE',
      allowed: {
        respond: !!side && b.status === 'NEGOTIATING' && !!pending && pending.authorSide !== side,
        confirm: side === 'VENUE' && b.status === 'AGREED',
        cancel: !!side && ['NEGOTIATING', 'AGREED', 'CONFIRMED'].includes(b.status),
        message: !!side && MESSAGE_ALLOWED.includes(b.status),
        registerPerformance: !!side && b.status === 'CONFIRMED' && !b.performance && !!agreed && agreed.performanceAt.getTime() <= now,
      },
    };
  }

  /**
   * Marca a conversa como lida por esta pessoa (abrir o chat). Também marca como lidas as notificações de
   * "nova mensagem" desta negociação, para o sino e o contador do chat ficarem coerentes.
   */
  async markMessagesRead(userId: string, bookingId: string) {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { organizationId: true, artistId: true } });
    if (!b || (await this.sidesFor(userId, b)).size === 0) throw notFound('Negociação não encontrada.');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.bookingRead.upsert({
        where: { bookingId_userId: { bookingId, userId } },
        create: { bookingId, userId, lastReadAt: now },
        update: { lastReadAt: now },
      }),
      this.prisma.notification.updateMany({
        where: { userId, type: 'NEW_MESSAGE', readAt: null, link: `/painel/negociacoes/${bookingId}` },
        data: { readAt: now },
      }),
    ]);
    return { unreadMessages: 0 };
  }

  // ─────────── Ações ───────────

  /** Bloqueia evento (se houver) e depois a negociação — mesma ordem do cancelamento de evento, evitando deadlock. */
  private async act(userId: string, bookingId: string, fn: (tx: Tx, booking: Booking, side: BookingSide) => Promise<void>, afterCommit?: () => Promise<void>) {
    const ref = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { eventId: true } });
    if (!ref) throw notFound('Negociação não encontrada.');
    await this.prisma.$transaction(async (tx) => {
      if (ref.eventId) await this.lifecycle.lock(tx, ref.eventId);
      const booking = await this.lock(tx, bookingId);
      const side = resolveSide(await this.sidesFor(userId, booking, tx));
      await fn(tx, booking, side);
    });
    await this.notifications.flush();
    await afterCommit?.();
    return this.detail(userId, bookingId);
  }

  async respond(userId: string, bookingId: string, offerId: string, response: 'accept' | 'decline' | 'counter', counter?: OfferInput) {
    return this.act(userId, bookingId, async (tx, booking, side) => {
      const offer = await tx.bookingOffer.findFirst({ where: { id: offerId, bookingId } });
      if (!offer) throw notFound('Proposta não encontrada.');
      assertCanRespondToOffer({ bookingStatus: booking.status, offerStatus: offer.status, offerAuthorSide: offer.authorSide, actingSide: side });
      const now = new Date();
      const other: BookingSide = side === 'VENUE' ? 'ARTIST' : 'VENUE';
      if (response === 'accept') {
        await tx.bookingOffer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED', respondedAt: now, respondedById: userId } });
        assertBookingTransition(booking.status, 'AGREED');
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'AGREED' } });
        await this.logStatus(tx, booking.id, booking.status, 'AGREED', userId, side, 'Proposta aceita — aguardando confirmação do contratante');
        await this.notifySide(tx, booking, other, userId, {
          type: 'OFFER_ACCEPTED',
          title: 'Proposta aceita',
          body: side === 'ARTIST' ? `A proposta "${booking.title}" foi aceita. Confirme a contratação.` : `Sua contraproposta em "${booking.title}" foi aceita.`,
          dedupeKey: `offer-accepted:${offer.id}`,
        });
      } else if (response === 'decline') {
        await tx.bookingOffer.update({ where: { id: offer.id }, data: { status: 'DECLINED', respondedAt: now, respondedById: userId } });
        assertBookingTransition(booking.status, 'DECLINED');
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'DECLINED' } });
        await this.logStatus(tx, booking.id, booking.status, 'DECLINED', userId, side, 'Proposta recusada');
        await this.releaseSlot(tx, booking);
        await this.notifySide(tx, booking, other, userId, {
          type: 'OFFER_DECLINED',
          title: 'Proposta recusada',
          body: `A proposta de "${booking.title}" foi recusada e a negociação foi encerrada.`,
          dedupeKey: `offer-declined:${offer.id}`,
        });
      } else {
        if (!counter) throw unprocessable('VALIDATION_ERROR', 'Informe os termos da contraproposta.');
        // A oferta anterior é preservada (apenas marcada como SUPERSEDED); a contraproposta é uma nova linha.
        await tx.bookingOffer.update({ where: { id: offer.id }, data: { status: 'SUPERSEDED', respondedAt: now, respondedById: userId } });
        const created = await tx.bookingOffer.create({ data: { bookingId: booking.id, authorId: userId, authorSide: side, previousOfferId: offer.id, ...counter } });
        await tx.booking.update({ where: { id: booking.id }, data: { updatedAt: now } });
        await this.notifySide(tx, booking, other, userId, {
          type: 'COUNTER_OFFER',
          title: 'Nova contraproposta',
          body: `Há uma contraproposta em "${booking.title}" aguardando sua resposta.`,
          dedupeKey: `counter-offer:${created.id}`,
        });
      }
    });
  }

  /** Confirmação explícita e auditável, feita pelo contratante após termos acordados. */
  async confirm(userId: string, bookingId: string) {
    return this.act(userId, bookingId, async (tx, booking, side) => {
      assertCanConfirm(booking.status, side);
      if (booking.eventId) {
        // O evento já está bloqueado por act(): capacidade e estado não mudam até o commit.
        const event = await tx.event.findUniqueOrThrow({ where: { id: booking.eventId } });
        if (event.status === 'CANCELLED') throw conflict('EVENT_CANCELLED', 'O evento desta negociação foi cancelado.');
        if (event.status === 'COMPLETED') throw conflict('EVENT_NOT_ACTIVE', 'Este evento já foi realizado.');
        await this.lifecycle.assertNotFullyBooked(tx, event);
      }
      // Agenda do artista/banda e do local: com locks por recurso, dentro desta transação.
      await this.agenda.assertNoConflicts(tx, booking);
      const now = new Date();
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED', confirmedAt: now, confirmedById: userId } });
      if (booking.eventId) await this.lifecycle.applySlotChange(tx, await tx.event.findUniqueOrThrow({ where: { id: booking.eventId } }), now);
      await this.logStatus(tx, booking.id, booking.status, 'CONFIRMED', userId, side, 'Contratação confirmada (pagamento é externo à plataforma)');
      await this.notifySide(tx, booking, 'ARTIST', userId, {
        type: 'BOOKING_CONFIRMED',
        title: 'Contratação confirmada',
        body: `"${booking.title}" foi confirmada pelo contratante. O show já aparece na sua agenda.`,
        dedupeKey: `booking-confirmed:${booking.id}`,
      });
    }, () => this.contracts.generateAfterConfirmation(bookingId));
  }

  async cancel(userId: string, bookingId: string, reason?: string) {
    return this.act(userId, bookingId, async (tx, booking, side) => {
      assertBookingTransition(booking.status, 'CANCELLED');
      const perf = await tx.performance.findUnique({ where: { bookingId: booking.id }, select: { id: true } });
      if (perf) throw conflict('PERFORMANCE_REGISTERED', 'A apresentação já foi registrada como realizada.');
      await tx.bookingOffer.updateMany({ where: { bookingId: booking.id, status: 'PENDING' }, data: { status: 'WITHDRAWN', respondedAt: new Date(), respondedById: userId } });
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
      await this.logStatus(tx, booking.id, booking.status, 'CANCELLED', userId, side, reason || 'Negociação encerrada');
      await this.releaseSlot(tx, booking);
      await this.notifySide(tx, booking, side === 'VENUE' ? 'ARTIST' : 'VENUE', userId, {
        type: 'BOOKING_CANCELLED',
        title: booking.status === 'CONFIRMED' ? 'Contratação cancelada' : 'Negociação encerrada',
        body: `"${booking.title}" foi ${booking.status === 'CONFIRMED' ? 'cancelada' : 'encerrada'} pela outra parte.${reason ? ` Motivo: ${reason}` : ''}`,
        dedupeKey: `booking-cancelled:${booking.id}`,
      });
    });
  }

  async message(userId: string, bookingId: string, body: string) {
    return this.act(userId, bookingId, async (tx, booking, side) => {
      if (!MESSAGE_ALLOWED.includes(booking.status)) throw conflict('BOOKING_CLOSED', 'Esta negociação está encerrada.');
      const sentAt = new Date();
      await tx.bookingMessage.create({ data: { bookingId: booking.id, authorId: userId, authorSide: side, body, createdAt: sentAt } });
      await tx.booking.update({ where: { id: booking.id }, data: { updatedAt: sentAt } });
      // Quem escreve leu a conversa até aqui.
      await tx.bookingRead.upsert({
        where: { bookingId_userId: { bookingId: booking.id, userId } },
        create: { bookingId: booking.id, userId, lastReadAt: sentAt },
        update: { lastReadAt: sentAt },
      });
      // Uma notificação por negociação a cada 30 min evita enxurrada de e-mails em conversas ativas.
      const bucket = Math.floor(Date.now() / (30 * 60 * 1000));
      await this.notifySide(tx, booking, side === 'VENUE' ? 'ARTIST' : 'VENUE', userId, {
        type: 'NEW_MESSAGE',
        title: 'Nova mensagem na negociação',
        body: `Você recebeu uma mensagem em "${booking.title}".`,
        dedupeKey: `message:${booking.id}:${bucket}`,
      });
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
      // Show concluído: pede avaliação aos dois lados (quem registrou vê o formulário na hora).
      for (const target of ['VENUE', 'ARTIST'] as const) {
        await this.notifySide(tx, booking, target, userId, {
          type: 'REVIEW_REQUEST',
          title: target === 'VENUE' ? 'Avalie o artista' : 'Avalie o contratante',
          body: `A apresentação "${booking.title}" foi registrada como realizada. Deixe sua nota (0 a 5 estrelas) e um comentário.`,
          dedupeKey: `review-request:${booking.id}:${target}`,
        });
      }
    });
  }
}
