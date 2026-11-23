import { Injectable } from '@nestjs/common';
import { Event, EventStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { GENRES, PAYMENT_TYPES } from '../../common/domain-lists';
import { conflict, notFound, unprocessable } from '../../common/errors';
import { uniqueSlug } from '../../common/slug';
import { alCity, genres, moneyCents, multiEnum, multiText, optionalText, text, uf } from '../../common/validation';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { publicArtistCardSelect, toArtistCard } from '../artists/artist.presenter';
import { MediaService, mediaThumbUrl, mediaUrl, type UploadedFile } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventLifecycleService } from './event-lifecycle.service';
import {
  acceptsApplications,
  ACTIVE_EVENT_STATUSES,
  assertApplicationTransition,
  assertEventTransition,
  EDITABLE_EVENT_STATUSES,
  EVENT_STATUS_LABEL,
} from './event.rules';

const isoDate = z.iso.datetime({ offset: true, error: 'Data/hora inválida.' }).transform((s) => new Date(s));

const EventFields = {
  title: text(3, 120, 'Título'),
  description: z.string().trim().max(4000),
  startsAt: isoDate,
  durationMinutes: z.number().int().min(15).max(24 * 60).nullable(),
  applicationDeadline: isoDate,
  slots: z.number().int().min(1, 'Informe ao menos 1 vaga.').max(50),
  genres,
  paymentType: z.enum(PAYMENT_TYPES).nullable(),
  feeCents: moneyCents.nullable(),
  conditions: z.string().trim().max(2000),
  notes: z.string().trim().max(2000),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'HIDDEN']),
  venueId: z.uuid().nullable(),
  locationName: optionalText(120, 'Nome do local'),
  locationAddress: optionalText(160, 'Endereço'),
  locationCity: alCity.nullable(),
  locationState: uf.nullable(),
};
const deadlineBeforeStart = (v: { startsAt?: Date; applicationDeadline?: Date }) =>
  !v.startsAt || !v.applicationDeadline || v.applicationDeadline.getTime() <= v.startsAt.getTime();
const deadlineMsg = { message: 'O prazo de candidatura deve ser anterior ou igual à data da apresentação.', path: ['applicationDeadline'] };

export const CreateEventSchema = z
  .object(EventFields)
  .partial()
  .extend({
    title: EventFields.title,
    startsAt: EventFields.startsAt,
    applicationDeadline: EventFields.applicationDeadline,
    slots: EventFields.slots,
  })
  .strict()
  .refine(deadlineBeforeStart, deadlineMsg);
export const UpdateEventSchema = z.object(EventFields).partial().strict().refine(deadlineBeforeStart, deadlineMsg);

/** Evento de contratante independente (ex.: aniversário): sem casa de show, local descrito livremente. */
export const IndependentEventSchema = z
  .object(EventFields)
  .partial()
  .extend({
    title: EventFields.title,
    startsAt: EventFields.startsAt,
    applicationDeadline: EventFields.applicationDeadline,
    slots: EventFields.slots,
    locationCity: alCity,
  })
  .strict()
  .refine(deadlineBeforeStart, deadlineMsg);

export const EventTransitionSchema = z.object({ action: z.enum(['publish', 'close', 'reopen', 'complete', 'cancel', 'postpone']), reason: z.string().trim().max(500).optional() }).strict();
const ACTION_TARGET: Record<z.infer<typeof EventTransitionSchema>['action'], EventStatus> = {
  publish: 'OPEN',
  close: 'CLOSED',
  reopen: 'OPEN',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
  postpone: 'POSTPONED',
};

export const RescheduleSchema = z
  .object({ startsAt: isoDate, applicationDeadline: isoDate, reason: z.string().trim().max(500).optional() })
  .strict()
  .refine(deadlineBeforeStart, deadlineMsg)
  .refine((v) => v.startsAt.getTime() > Date.now(), { path: ['startsAt'], message: 'A nova data deve estar no futuro.' });

export const ApplySchema = z
  .object({
    artistId: z.uuid(),
    message: z.string().trim().max(1500).default(''),
    /** Contraproposta de cachê já na candidatura (centavos). Ausente/nulo = aceita o cachê publicado. */
    proposedFeeCents: moneyCents.nullish().transform((v) => v ?? null),
  })
  .strict();
export const DecisionSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);
export const EventSearchSchema = z.object({
  q: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  genre: multiEnum(GENRES),
  city: multiText(),
  visibility: z.preprocess(emptyToUndef, z.enum(['PUBLIC', 'PRIVATE']).optional()),
  /** open = inscrições abertas (padrão); closed = encerrados (vagas preenchidas, encerrados e realizados). */
  state: z.preprocess(emptyToUndef, z.enum(['open', 'closed']).default('open')),
});

const orgPublicSelect = { id: true, slug: true, name: true, type: true, city: true, state: true, neighborhood: true, venueKind: true, photoId: true } as const;

const eventPublicSelect = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  durationMinutes: true,
  applicationDeadline: true,
  slots: true,
  genres: true,
  paymentType: true,
  feeCents: true,
  conditions: true,
  notes: true,
  status: true,
  visibility: true,
  publishedAt: true,
  postponedAt: true,
  locationName: true,
  locationAddress: true,
  locationCity: true,
  locationState: true,
  imageId: true,
  organizer: { select: orgPublicSelect },
  venue: { select: orgPublicSelect },
} satisfies Prisma.EventSelect;

type OrgPublic = Prisma.OrganizationGetPayload<{ select: typeof orgPublicSelect }>;
type EventPublicRow = Prisma.EventGetPayload<{ select: typeof eventPublicSelect }>;

/** Contratante individual não expõe slug/página pública: só nome e cidade. */
const orgOut = (o: OrgPublic | null) =>
  o ? { id: o.id, slug: o.type === 'VENUE' ? o.slug : null, name: o.name, type: o.type, city: o.city, state: o.state, neighborhood: o.neighborhood, venueKind: o.venueKind, photoUrl: mediaThumbUrl(o.photoId) } : null;

export function eventLocation(e: Pick<EventPublicRow, 'venue' | 'locationName' | 'locationAddress' | 'locationCity' | 'locationState'>) {
  if (e.venue) return { name: e.venue.name, address: null, city: e.venue.city, state: e.venue.state, venueSlug: e.venue.type === 'VENUE' ? e.venue.slug : null };
  return { name: e.locationName, address: e.locationAddress, city: e.locationCity, state: e.locationState, venueSlug: null };
}

function eventOut(e: EventPublicRow, filledSlots?: number) {
  const { organizer, venue, imageId, locationName: _n, locationAddress: _a, locationCity: _c, locationState: _s, ...rest } = e;
  return {
    ...rest,
    imageUrl: mediaUrl(imageId),
    imageThumbUrl: mediaThumbUrl(imageId),
    statusLabel: EVENT_STATUS_LABEL[e.status],
    organizer: orgOut(organizer)!,
    venue: orgOut(venue),
    location: eventLocation(e),
    acceptingApplications: acceptsApplications(e, new Date()),
    ...(filledSlots !== undefined ? { filledSlots } : {}),
  };
}

interface Viewer {
  id: string;
  accountType: 'ARTIST' | 'CONTRACTOR' | null;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly lifecycle: EventLifecycleService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
  ) {}

  /** Imagem do evento (exibida no card). Só responsáveis do organizador; eventos encerrados/cancelados não mudam. */
  async setImage(userId: string, eventId: string, file: UploadedFile | undefined) {
    const event = await this.loadForManage(userId, eventId);
    if (!EDITABLE_EVENT_STATUSES.includes(event.status)) throw conflict('EVENT_LOCKED', 'Eventos realizados ou cancelados não podem ser editados.');
    const asset = await this.media.store(file, userId, 'image');
    await this.prisma.event.update({ where: { id: eventId }, data: { imageId: asset.id } });
    if (event.imageId) await this.media.remove(event.imageId);
    return this.manageDetail(userId, eventId);
  }

  async removeImage(userId: string, eventId: string) {
    const event = await this.loadForManage(userId, eventId);
    if (event.imageId) {
      await this.prisma.event.update({ where: { id: eventId }, data: { imageId: null } });
      await this.media.remove(event.imageId);
    }
    return this.manageDetail(userId, eventId);
  }

  private async viewer(userId: string | null): Promise<Viewer | null> {
    if (!userId) return null;
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, accountType: true } });
    return u ? { id: u.id, accountType: u.accountType } : null;
  }

  private async assertVenue(venueId: string | null | undefined) {
    if (!venueId) return;
    const v = await this.prisma.organization.findFirst({ where: { id: venueId, type: 'VENUE' }, select: { id: true } });
    if (!v) throw unprocessable('INVALID_VENUE', 'Local informado não encontrado.');
  }

  private async loadForManage(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw notFound('Evento não encontrado.');
    await this.access.assertOrgMember(userId, event.organizerId);
    return event;
  }

  /** Pessoas a avisar sobre mudanças do evento: responsáveis das identidades com candidatura ativa ou negociação. */
  private async participantUserIds(tx: Tx, eventId: string) {
    const [apps, bookings] = await Promise.all([
      tx.eventApplication.findMany({ where: { eventId, status: { in: ['PENDING', 'ACCEPTED'] } }, select: { artistId: true } }),
      tx.booking.findMany({ where: { eventId, status: { in: ['NEGOTIATING', 'AGREED', 'CONFIRMED'] } }, select: { artistId: true } }),
    ]);
    const artistIds = [...new Set([...apps, ...bookings].map((r) => r.artistId))];
    const users = await Promise.all(artistIds.map((id) => this.access.artistManagerUserIds(id, tx)));
    return users.flat();
  }

  // ─────────── Criação ───────────

  async create(userId: string, organizerId: string, input: z.infer<typeof CreateEventSchema>) {
    await this.access.assertOrgMember(userId, organizerId);
    const organizer = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizerId }, select: { type: true, city: true, state: true } });
    const venueId = input.venueId === undefined ? (organizer.type === 'VENUE' ? organizerId : null) : input.venueId;
    await this.assertVenue(venueId);
    if (!venueId && !input.locationCity) {
      throw unprocessable('LOCATION_REQUIRED', 'Informe o local do evento (cidade e, se quiser, endereço).');
    }
    const event = await this.prisma.event.create({ data: this.createData(userId, organizerId, venueId, input), select: { id: true } });
    return this.manageDetail(userId, event.id);
  }

  /** Contratante independente: cria (na primeira vez) o perfil de contratação individual e o evento. */
  async createIndependent(userId: string, input: z.infer<typeof IndependentEventSchema>) {
    await this.access.assertAccountType(userId, 'CONTRACTOR');
    const id = await this.prisma.$transaction(async (tx) => {
      const orgId = await this.ensureIndividualOrganization(tx, userId, input.locationCity);
      if (input.venueId) await this.assertVenue(input.venueId);
      const e = await tx.event.create({ data: this.createData(userId, orgId, input.venueId ?? null, input), select: { id: true } });
      return e.id;
    });
    return this.manageDetail(userId, id);
  }

  async ensureIndividualOrganization(tx: Tx, userId: string, city: string) {
    const existing = await tx.organizationMember.findFirst({
      where: { userId, status: 'ACTIVE', organization: { type: 'INDIVIDUAL' } },
      select: { organizationId: true },
    });
    if (existing) return existing.organizationId;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    const slug = await uniqueSlug(`contratante-${user.name}`, async (s) => !!(await tx.organization.findUnique({ where: { slug: s }, select: { id: true } })));
    const org = await tx.organization.create({ data: { type: 'INDIVIDUAL', slug, name: user.name, city, state: 'AL' } });
    await tx.organizationMember.create({ data: { organizationId: org.id, userId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() } });
    return org.id;
  }

  private createData(userId: string, organizerId: string, venueId: string | null, input: z.infer<typeof CreateEventSchema>): Prisma.EventUncheckedCreateInput {
    return {
      organizerId,
      venueId,
      createdById: userId,
      title: input.title,
      description: input.description ?? '',
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes ?? null,
      applicationDeadline: input.applicationDeadline,
      slots: input.slots,
      genres: input.genres ?? [],
      paymentType: input.paymentType ?? null,
      feeCents: input.feeCents ?? null,
      conditions: input.conditions ?? '',
      notes: input.notes ?? '',
      visibility: input.visibility ?? 'PUBLIC',
      locationName: venueId ? null : (input.locationName ?? null),
      locationAddress: venueId ? null : (input.locationAddress ?? null),
      locationCity: venueId ? null : (input.locationCity ?? null),
      locationState: venueId ? null : 'AL',
      status: 'DRAFT',
    };
  }

  // ─────────── Gestão pelo organizador ───────────

  async listForOrg(userId: string, organizerId: string) {
    await this.access.assertOrgMember(userId, organizerId);
    await this.lifecycle.sweepIfStale();
    const rows = await this.prisma.event.findMany({
      where: { organizerId },
      orderBy: [{ startsAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        visibility: true,
        startsAt: true,
        applicationDeadline: true,
        slots: true,
        imageId: true,
        applications: { select: { status: true } },
        bookings: { where: { status: 'CONFIRMED' }, select: { id: true } },
      },
    });
    return rows.map(({ applications, bookings, imageId, ...e }) => ({
      ...e,
      imageThumbUrl: mediaThumbUrl(imageId),
      statusLabel: EVENT_STATUS_LABEL[e.status],
      filledSlots: bookings.length,
      applicationCounts: {
        total: applications.filter((a) => a.status !== 'WITHDRAWN').length,
        pending: applications.filter((a) => a.status === 'PENDING').length,
        accepted: applications.filter((a) => a.status === 'ACCEPTED').length,
      },
    }));
  }

  async manageDetail(userId: string, eventId: string) {
    await this.loadForManage(userId, eventId);
    const e = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: {
        ...eventPublicSelect,
        organizerId: true,
        venueId: true,
        createdAt: true,
        updatedAt: true,
        closedAt: true,
        completedAt: true,
        cancelledAt: true,
        filledAt: true,
        applications: {
          where: { status: { not: 'WITHDRAWN' } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            message: true,
            proposedFeeCents: true,
            createdAt: true,
            decidedAt: true,
            decisionNote: true,
            artist: { select: publicArtistCardSelect },
            booking: { select: { id: true, status: true } },
          },
        },
        bookings: {
          where: { origin: 'DIRECT' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, status: true, artist: { select: { name: true, slug: true } } },
        },
      },
    });
    const { applications, bookings, ...rest } = e;
    const filled = await this.lifecycle.filledSlots(this.prisma, eventId);
    return {
      ...eventOut(rest, filled),
      organizerId: rest.organizerId,
      venueId: rest.venueId,
      locationFields: { locationName: rest.locationName, locationAddress: rest.locationAddress, locationCity: rest.locationCity },
      createdAt: rest.createdAt,
      closedAt: rest.closedAt,
      completedAt: rest.completedAt,
      cancelledAt: rest.cancelledAt,
      filledAt: rest.filledAt,
      applications: applications.map((a) => ({ ...a, artist: toArtistCard(a.artist) })),
      invitations: bookings,
    };
  }

  async update(userId: string, eventId: string, input: z.infer<typeof UpdateEventSchema>) {
    await this.loadForManage(userId, eventId);
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lifecycle.lock(tx, eventId);
      if (!EDITABLE_EVENT_STATUSES.includes(event.status)) {
        throw conflict('EVENT_LOCKED', 'Eventos realizados ou cancelados não podem ser editados.');
      }
      const startsAt = input.startsAt ?? event.startsAt;
      const deadline = input.applicationDeadline ?? event.applicationDeadline;
      if (deadline.getTime() > startsAt.getTime()) {
        throw unprocessable('VALIDATION_ERROR', 'O prazo de candidatura deve ser anterior ou igual à data da apresentação.');
      }
      if (event.status === 'OPEN' && deadline.getTime() <= Date.now()) {
        throw unprocessable('DEADLINE_PASSED', 'Com inscrições abertas, o prazo precisa estar no futuro. Encerre as inscrições antes.');
      }
      if (input.slots !== undefined) {
        const filled = await this.lifecycle.filledSlots(tx, eventId);
        if (input.slots < filled) throw unprocessable('SLOTS_BELOW_FILLED', `Já há ${filled} vaga(s) ocupada(s).`);
      }
      if (input.venueId !== undefined) await this.assertVenue(input.venueId);
      const venueId = input.venueId === undefined ? event.venueId : input.venueId;
      const locationCity = input.locationCity === undefined ? event.locationCity : input.locationCity;
      if (!venueId && !locationCity) throw unprocessable('LOCATION_REQUIRED', 'Informe o local do evento.');
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { ...input, ...(venueId ? { locationName: null, locationAddress: null, locationCity: null, locationState: null } : { locationState: 'AL' }) },
      });
      await this.lifecycle.applySlotChange(tx, updated);
      if (input.startsAt && input.startsAt.getTime() !== event.startsAt.getTime()) {
        await this.notifyParticipants(tx, event, 'EVENT_RESCHEDULED', `Nova data: ${event.title}`, 'A data do evento foi alterada pelo organizador.');
      }
    });
    await this.notifications.flush();
    return this.manageDetail(userId, eventId);
  }

  async transition(userId: string, eventId: string, input: z.infer<typeof EventTransitionSchema>) {
    await this.loadForManage(userId, eventId);
    const to = ACTION_TARGET[input.action];
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lifecycle.lock(tx, eventId);
      const now = new Date();
      assertEventTransition(event.status, to, {
        now,
        startsAt: event.startsAt,
        applicationDeadline: event.applicationDeadline,
        filledSlots: await this.lifecycle.filledSlots(tx, eventId),
        slots: event.slots,
      });
      const stamp: Prisma.EventUpdateInput =
        to === 'OPEN'
          ? { publishedAt: event.publishedAt ?? now, closedAt: null }
          : to === 'CLOSED'
            ? { closedAt: now }
            : to === 'COMPLETED'
              ? { completedAt: now }
              : to === 'POSTPONED'
                ? { postponedAt: now }
                : { cancelledAt: now };
      await tx.event.update({ where: { id: eventId }, data: { status: to, ...stamp } });
      if (to === 'CANCELLED') await this.cascadeCancellation(tx, event, userId, input.reason);
      if (to === 'POSTPONED') {
        await this.notifyParticipants(tx, event, 'EVENT_POSTPONED', `Evento adiado: ${event.title}`, input.reason || 'O organizador adiou o evento. Uma nova data será informada.');
      }
    });
    await this.notifications.flush();
    return this.manageDetail(userId, eventId);
  }

  /** Define nova data para evento adiado (ou ativo) e devolve ao estado coerente com prazo e vagas. */
  async reschedule(userId: string, eventId: string, input: z.infer<typeof RescheduleSchema>) {
    await this.loadForManage(userId, eventId);
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lifecycle.lock(tx, eventId);
      if (!ACTIVE_EVENT_STATUSES.includes(event.status)) throw conflict('EVENT_LOCKED', 'Este evento não pode ser remarcado.');
      const filled = await this.lifecycle.filledSlots(tx, eventId);
      const deadlineOpen = input.applicationDeadline.getTime() > Date.now();
      const next: EventStatus = filled >= event.slots ? 'FILLED' : deadlineOpen && event.status !== 'CLOSED' ? 'OPEN' : 'CLOSED';
      await tx.event.update({
        where: { id: eventId },
        data: { startsAt: input.startsAt, applicationDeadline: input.applicationDeadline, status: next, ...(next === 'OPEN' ? { closedAt: null } : {}) },
      });
      await this.notifyParticipants(tx, event, 'EVENT_RESCHEDULED', `Nova data: ${event.title}`, input.reason || 'O organizador definiu uma nova data para o evento.');
    });
    await this.notifications.flush();
    return this.manageDetail(userId, eventId);
  }

  /** Cancelar o evento encerra candidaturas e negociações vinculadas, com registro e aviso às partes. */
  private async cascadeCancellation(tx: Tx, event: Event, userId: string, reason?: string) {
    const recipients = await this.participantUserIds(tx, event.id);
    const now = new Date();
    await tx.eventApplication.updateMany({
      where: { eventId: event.id, status: 'PENDING' },
      data: { status: 'REJECTED', decidedAt: now, decidedById: userId, decisionNote: 'Evento cancelado pelo organizador' },
    });
    await tx.eventApplication.updateMany({ where: { eventId: event.id, status: 'ACCEPTED' }, data: { status: 'CANCELLED' } });
    const bookings = await tx.booking.findMany({ where: { eventId: event.id, status: { in: ['NEGOTIATING', 'AGREED', 'CONFIRMED'] } }, select: { id: true, status: true } });
    for (const b of bookings) {
      await tx.bookingOffer.updateMany({ where: { bookingId: b.id, status: 'PENDING' }, data: { status: 'WITHDRAWN', respondedAt: now, respondedById: userId } });
      await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED' } });
      await tx.bookingStatusChange.create({
        data: { bookingId: b.id, fromStatus: b.status, toStatus: 'CANCELLED', actorId: userId, actorSide: 'VENUE', note: `Evento cancelado${reason ? `: ${reason}` : ''}` },
      });
    }
    await this.notifications.notify(tx, recipients, {
      category: 'EVENTS',
      type: 'EVENT_CANCELLED',
      title: `Evento cancelado: ${event.title}`,
      body: reason || 'O organizador cancelou o evento. Candidaturas e negociações vinculadas foram encerradas.',
      link: '/painel/candidaturas',
      dedupeKey: `event-cancelled:${event.id}`,
    });
  }

  private async notifyParticipants(tx: Tx, event: Event, type: string, title: string, body: string) {
    await this.notifications.notify(tx, await this.participantUserIds(tx, event.id), {
      category: 'EVENTS',
      type,
      title,
      body,
      link: `/oportunidades/${event.id}`,
      dedupeKey: `${type}:${event.id}:${Date.now()}`,
    });
  }

  // ─────────── Consulta (pública e de artistas) ───────────

  /** Visitantes e contratantes veem só eventos públicos; contas de artista também veem os privados. */
  /** Listagens: públicos para todos; privados só para contas de artista; ocultos nunca (só por convite). */
  private visibilityFilter(viewer: Viewer | null, requested?: 'PUBLIC' | 'PRIVATE'): Prisma.EventWhereInput {
    const canSeePrivate = viewer?.accountType === 'ARTIST';
    if (!canSeePrivate || requested === 'PUBLIC') return { visibility: 'PUBLIC' };
    return requested === 'PRIVATE' ? { visibility: 'PRIVATE' } : { visibility: { in: ['PUBLIC', 'PRIVATE'] } };
  }

  async search(f: z.infer<typeof EventSearchSchema>, userId: string | null) {
    await this.lifecycle.sweepIfStale();
    const viewer = await this.viewer(userId);
    const now = new Date();
    const rows = await this.prisma.event.findMany({
      where: {
        ...(f.state === 'closed' ? { status: { in: ['FILLED', 'CLOSED', 'COMPLETED'] as EventStatus[] } } : { status: 'OPEN' as EventStatus, applicationDeadline: { gte: now } }),
        ...this.visibilityFilter(viewer, f.visibility),
        ...(f.genre?.length ? { genres: { hasSome: f.genre } } : {}),
        // Cidade: qualquer uma das escolhidas (da casa de show ou, sem casa, do local informado).
        ...(f.city?.length
          ? {
              OR: f.city.flatMap((c) => [
                { venue: { city: { equals: c, mode: 'insensitive' as const } } },
                { venueId: null, locationCity: { equals: c, mode: 'insensitive' as const } },
              ]),
            }
          : {}),
        ...(f.q
          ? {
              AND: [
                {
                  OR: [
                    { title: { contains: f.q, mode: 'insensitive' } },
                    { description: { contains: f.q, mode: 'insensitive' } },
                    { organizer: { name: { contains: f.q, mode: 'insensitive' } } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: f.state === 'closed' ? { startsAt: 'desc' } : { applicationDeadline: 'asc' },
      take: 100,
      select: eventPublicSelect,
    });
    return rows.map((e) => eventOut(e));
  }

  /**
   * Detalhe: rascunhos nunca aparecem. Evento privado só para contas de artista, responsáveis do organizador
   * ou identidades que já têm candidatura/negociação no evento. Caso contrário, 404 (não revela existência).
   */
  async detail(eventId: string, userId: string | null) {
    await this.lifecycle.sweepIfStale();
    const e = await this.prisma.event.findFirst({ where: { id: eventId, status: { not: 'DRAFT' } }, select: { ...eventPublicSelect, organizerId: true } });
    if (!e) throw notFound('Oportunidade não encontrada.');
    if (e.visibility === 'PRIVATE' && !(await this.canSeePrivate(e, userId))) throw notFound('Oportunidade não encontrada.');
    if (e.visibility === 'HIDDEN' && !(await this.canSeeHidden(e, userId))) throw notFound('Oportunidade não encontrada.');
    const { organizerId: _o, ...rest } = e;
    // Atrações confirmadas (perfis públicos) — o evento fechado continua mostrando quem toca.
    const lineup = await this.prisma.booking.findMany({
      where: { eventId, status: 'CONFIRMED', artist: { visibility: 'PUBLIC' } },
      orderBy: { confirmedAt: 'asc' },
      select: { artist: { select: publicArtistCardSelect } },
    });
    return { ...eventOut(rest, await this.lifecycle.filledSlots(this.prisma, eventId)), lineup: lineup.map((b) => toArtistCard(b.artist)) };
  }

  /** Evento oculto: só responsáveis do organizador e artistas convidados (com negociação ou candidatura no evento). */
  private async canSeeHidden(e: { id: string; organizerId: string }, userId: string | null) {
    if (!userId) return false;
    if (await this.access.orgRole(userId, e.organizerId)) return true;
    const artistIds = await this.access.managedArtistIds(userId);
    if (!artistIds.length) return false;
    const [bookings, apps] = await Promise.all([
      this.prisma.booking.count({ where: { eventId: e.id, artistId: { in: artistIds } } }),
      this.prisma.eventApplication.count({ where: { eventId: e.id, artistId: { in: artistIds } } }),
    ]);
    return bookings + apps > 0;
  }

  private async canSeePrivate(e: { id: string; organizerId: string }, userId: string | null) {
    const viewer = await this.viewer(userId);
    if (!viewer) return false;
    if (viewer.accountType === 'ARTIST') return true;
    return !!(await this.access.orgRole(viewer.id, e.organizerId));
  }

  // ─────────── Candidaturas (artista/banda) ───────────

  async apply(userId: string, eventId: string, input: z.infer<typeof ApplySchema>) {
    await this.access.assertCanManageArtist(userId, input.artistId);
    const [event, artist] = await Promise.all([
      this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, status: true, visibility: true, applicationDeadline: true, organizerId: true, feeCents: true } }),
      this.prisma.artist.findUniqueOrThrow({ where: { id: input.artistId }, select: { visibility: true, name: true } }),
    ]);
    if (!event || event.status === 'DRAFT') throw notFound('Oportunidade não encontrada.');
    if (event.visibility === 'PRIVATE' && !(await this.canSeePrivate(event, userId))) throw notFound('Oportunidade não encontrada.');
    if (event.visibility === 'HIDDEN') {
      if (!(await this.canSeeHidden(event, userId))) throw notFound('Oportunidade não encontrada.');
      throw conflict('INVITE_ONLY', 'Este evento é só por convite: responda ao convite recebido na negociação.');
    }
    if (!acceptsApplications(event, new Date())) throw conflict('APPLICATIONS_CLOSED', 'As inscrições desta oportunidade estão encerradas.');
    if (artist.visibility !== 'PUBLIC') {
      throw unprocessable('PROFILE_NOT_PUBLIC', 'Publique o perfil artístico antes de se candidatar — o contratante precisa conseguir vê-lo.');
    }
    // Contraproposta igual ao cachê publicado não é contraproposta.
    const proposedFeeCents = input.proposedFeeCents !== null && input.proposedFeeCents === event.feeCents ? null : input.proposedFeeCents;
    const id = await this.prisma.$transaction(async (tx) => {
      // Revalida com o evento bloqueado: uma confirmação concorrente pode ter esgotado o evento.
      const locked = await this.lifecycle.lock(tx, eventId);
      await this.lifecycle.assertNotFullyBooked(tx, locked);
      if (!acceptsApplications(locked, new Date())) throw conflict('APPLICATIONS_CLOSED', 'As inscrições desta oportunidade estão encerradas.');
      const existing = await tx.eventApplication.findUnique({ where: { eventId_artistId: { eventId, artistId: input.artistId } } });
      let applicationId: string;
      if (existing) {
        if (existing.status !== 'WITHDRAWN') throw conflict('DUPLICATE_APPLICATION', 'Esta identidade artística já se candidatou a esta oportunidade.');
        assertApplicationTransition('WITHDRAWN', 'PENDING');
        const res = await tx.eventApplication.updateMany({
          where: { id: existing.id, status: 'WITHDRAWN' },
          data: { status: 'PENDING', message: input.message, proposedFeeCents, submittedById: userId, withdrawnAt: null, decidedAt: null, decidedById: null, decisionNote: null },
        });
        if (res.count !== 1) throw conflict('DUPLICATE_APPLICATION', 'Esta identidade artística já se candidatou a esta oportunidade.');
        applicationId = existing.id;
      } else {
        // Unicidade (eventId, artistId) garantida pelo banco; P2002 vira 409.
        const created = await tx.eventApplication.create({
          data: { eventId, artistId: input.artistId, submittedById: userId, message: input.message, proposedFeeCents },
          select: { id: true },
        });
        applicationId = created.id;
      }
      await this.notifications.notify(tx, await this.access.organizationMemberUserIds(event.organizerId, tx), {
        category: 'APPLICATIONS',
        type: 'APPLICATION_RECEIVED',
        title: `Nova candidatura: ${event.title}`,
        body: proposedFeeCents !== null ? `${artist.name} se candidatou ao evento com uma contraproposta de cachê.` : `${artist.name} se candidatou ao evento.`,
        link: `/painel/eventos/${event.id}`,
        dedupeKey: `application-received:${applicationId}:${Date.now()}`,
      });
      return applicationId;
    });
    await this.notifications.flush();
    return this.applicationForArtist(userId, id);
  }

  private async applicationForArtist(userId: string, applicationId: string) {
    const list = await this.myApplications(userId, applicationId);
    return list[0];
  }

  async myApplications(userId: string, onlyId?: string) {
    const artistIds = await this.access.managedArtistIds(userId);
    const rows = await this.prisma.eventApplication.findMany({
      where: { artistId: { in: artistIds }, ...(onlyId ? { id: onlyId } : {}) },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        message: true,
        proposedFeeCents: true,
        createdAt: true,
        decidedAt: true,
        decisionNote: true,
        withdrawnAt: true,
        artist: { select: { id: true, name: true, slug: true, kind: true } },
        event: { select: { id: true, title: true, startsAt: true, applicationDeadline: true, status: true, visibility: true, feeCents: true, organizer: { select: orgPublicSelect } } },
        booking: { select: { id: true, status: true } },
      },
    });
    return rows.map((r) => ({ ...r, event: { ...r.event, statusLabel: EVENT_STATUS_LABEL[r.event.status], organizer: orgOut(r.event.organizer) } }));
  }

  async withdraw(userId: string, applicationId: string) {
    const app = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, artistId: true, eventId: true, status: true, booking: { select: { status: true } }, artist: { select: { name: true } } },
    });
    if (!app) throw notFound('Candidatura não encontrada.');
    await this.access.assertCanManageArtist(userId, app.artistId);
    if (app.booking && !['DECLINED', 'CANCELLED'].includes(app.booking.status)) {
      throw conflict('BOOKING_IN_PROGRESS', 'Há uma negociação vinculada a esta candidatura. Encerre a negociação antes de retirar.');
    }
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lifecycle.lock(tx, app.eventId);
      const fresh = await tx.eventApplication.findUniqueOrThrow({ where: { id: applicationId }, select: { status: true } });
      assertApplicationTransition(fresh.status, 'WITHDRAWN');
      await tx.eventApplication.update({ where: { id: applicationId }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
      if (fresh.status === 'ACCEPTED') await this.lifecycle.applySlotChange(tx, event);
      await this.notifications.notify(tx, await this.access.organizationMemberUserIds(event.organizerId, tx), {
        category: 'APPLICATIONS',
        type: 'APPLICATION_WITHDRAWN',
        title: `Candidatura retirada: ${event.title}`,
        body: `${app.artist.name} retirou a candidatura.`,
        link: `/painel/eventos/${event.id}`,
        dedupeKey: `application-withdrawn:${applicationId}:${Date.now()}`,
      });
    });
    await this.notifications.flush();
    return this.applicationForArtist(userId, applicationId);
  }

  // ─────────── Análise pelo organizador ───────────

  /**
   * Aceitar ≠ contratar: nenhuma negociação é criada nem confirmada automaticamente.
   * Selecionar candidatura NÃO ocupa vaga (várias podem ser selecionadas e negociadas em paralelo); a vaga só
   * fecha quando uma contratação é confirmada. Com o evento já esgotado por confirmações, não há nova seleção.
   */
  async decide(userId: string, applicationId: string, decision: 'ACCEPTED' | 'REJECTED', note?: string) {
    const app = await this.prisma.eventApplication.findUnique({ where: { id: applicationId }, select: { eventId: true, event: { select: { organizerId: true } } } });
    if (!app) throw notFound('Candidatura não encontrada.');
    await this.access.assertOrgMember(userId, app.event.organizerId);
    await this.prisma.$transaction(async (tx) => {
      const event = await this.lifecycle.lock(tx, app.eventId);
      if (!ACTIVE_EVENT_STATUSES.includes(event.status)) throw conflict('EVENT_NOT_ACTIVE', 'Este evento não está mais ativo.');
      const current = await tx.eventApplication.findUniqueOrThrow({
        where: { id: applicationId },
        select: { status: true, artistId: true, booking: { select: { status: true } } },
      });
      assertApplicationTransition(current.status, decision);
      if (decision === 'ACCEPTED') await this.lifecycle.assertNotFullyBooked(tx, event);
      if (decision === 'REJECTED' && current.booking && !['DECLINED', 'CANCELLED'].includes(current.booking.status)) {
        throw conflict('BOOKING_IN_PROGRESS', 'Há uma negociação em andamento com esta candidatura. Encerre-a antes.');
      }
      await tx.eventApplication.update({
        where: { id: applicationId },
        data: { status: decision, decidedAt: new Date(), decidedById: userId, decisionNote: note ?? null },
      });
      await this.notifications.notify(tx, await this.access.artistManagerUserIds(current.artistId, tx), {
        category: 'APPLICATIONS',
        type: decision === 'ACCEPTED' ? 'APPLICATION_ACCEPTED' : 'APPLICATION_REJECTED',
        title: decision === 'ACCEPTED' ? `Candidatura aceita: ${event.title}` : `Candidatura não selecionada: ${event.title}`,
        body:
          decision === 'ACCEPTED'
            ? 'O organizador selecionou sua candidatura. A proposta com os termos chegará em uma negociação.'
            : note || 'O organizador não selecionou sua candidatura desta vez.',
        link: '/painel/candidaturas',
        dedupeKey: `application-${decision}:${applicationId}`,
      });
    });
    await this.notifications.flush();
    return this.manageDetail(userId, app.eventId);
  }

  /** Candidaturas das identidades que o usuário administra para um evento (botão "Candidatar"). */
  async myApplicationsForEvent(userId: string, eventId: string) {
    const ids = await this.access.managedArtistIds(userId);
    return this.prisma.eventApplication.findMany({
      where: { eventId, artistId: { in: ids } },
      select: { id: true, artistId: true, status: true, proposedFeeCents: true, booking: { select: { id: true, status: true } } },
    });
  }
}
