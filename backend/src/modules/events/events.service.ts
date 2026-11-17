import { Injectable } from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { GENRES, PAYMENT_TYPES } from '../../common/domain-lists';
import { conflict, notFound, unprocessable } from '../../common/errors';
import { genres, moneyCents, text } from '../../common/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { publicArtistCardSelect, toArtistCard } from '../artists/artist.presenter';
import { mediaUrl } from '../media/media.service';
import {
  acceptsApplications,
  assertApplicationTransition,
  assertEventTransition,
  EDITABLE_EVENT_STATUSES,
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
  requirements: z.string().trim().max(2000),
  venueId: z.uuid().nullable(),
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

export const EventTransitionSchema = z.object({ action: z.enum(['publish', 'close', 'reopen', 'complete', 'cancel']) });
const ACTION_TARGET: Record<z.infer<typeof EventTransitionSchema>['action'], EventStatus> = {
  publish: 'OPEN',
  close: 'CLOSED',
  reopen: 'OPEN',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
};

export const ApplySchema = z.object({ artistId: z.uuid(), message: z.string().trim().max(1500).default('') }).strict();
export const DecisionSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);
export const EventSearchSchema = z.object({
  q: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  genre: z.preprocess(emptyToUndef, z.enum(GENRES).optional()),
  city: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
});

const orgPublicSelect = { id: true, slug: true, name: true, city: true, state: true, neighborhood: true, venueKind: true, photoId: true } as const;

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
  requirements: true,
  status: true,
  publishedAt: true,
  organizer: { select: orgPublicSelect },
  venue: { select: orgPublicSelect },
} satisfies Prisma.EventSelect;

type OrgPublic = Prisma.OrganizationGetPayload<{ select: typeof orgPublicSelect }>;
const orgOut = (o: OrgPublic | null) => (o ? { ...o, photoId: undefined, photoUrl: mediaUrl(o.photoId) } : null);

function eventOut<T extends { organizer: OrgPublic; venue: OrgPublic | null; status: EventStatus; applicationDeadline: Date }>(e: T) {
  return { ...e, organizer: orgOut(e.organizer)!, venue: orgOut(e.venue), acceptingApplications: acceptsApplications(e, new Date()) };
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private async assertVenue(venueId: string | null | undefined) {
    if (!venueId) return;
    const v = await this.prisma.organization.findFirst({ where: { id: venueId, type: 'VENUE' }, select: { id: true } });
    if (!v) throw unprocessable('INVALID_VENUE', 'Local informado não encontrado.');
  }

  private async loadForManage(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw notFound('Publicação não encontrada.');
    await this.access.assertOrgMember(userId, event.organizerId);
    return event;
  }

  // ─────────── Gestão pela casa ───────────

  async create(userId: string, organizerId: string, input: z.infer<typeof CreateEventSchema>) {
    await this.access.assertOrgMember(userId, organizerId);
    const venueId = input.venueId === undefined ? organizerId : input.venueId;
    await this.assertVenue(venueId);
    const event = await this.prisma.event.create({
      data: {
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
        requirements: input.requirements ?? '',
        status: 'DRAFT',
      },
      select: { id: true },
    });
    return this.manageDetail(userId, event.id);
  }

  async listForOrg(userId: string, organizerId: string) {
    await this.access.assertOrgMember(userId, organizerId);
    const rows = await this.prisma.event.findMany({
      where: { organizerId },
      orderBy: [{ startsAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        applicationDeadline: true,
        slots: true,
        applications: { select: { status: true } },
      },
    });
    return rows.map(({ applications, ...e }) => ({
      ...e,
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
        applications: {
          where: { status: { not: 'WITHDRAWN' } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            message: true,
            createdAt: true,
            decidedAt: true,
            decisionNote: true,
            artist: { select: publicArtistCardSelect },
            booking: { select: { id: true, status: true } },
          },
        },
      },
    });
    const { applications, ...rest } = e;
    return {
      ...eventOut(rest),
      applications: applications.map((a) => ({ ...a, artist: toArtistCard(a.artist) })),
    };
  }

  async update(userId: string, eventId: string, input: z.infer<typeof UpdateEventSchema>) {
    const event = await this.loadForManage(userId, eventId);
    if (!EDITABLE_EVENT_STATUSES.includes(event.status)) {
      throw conflict('EVENT_LOCKED', 'Publicações concluídas ou canceladas não podem ser editadas.');
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
      const accepted = await this.prisma.eventApplication.count({ where: { eventId, status: 'ACCEPTED' } });
      if (input.slots < accepted) throw unprocessable('SLOTS_BELOW_ACCEPTED', `Já há ${accepted} candidatura(s) aceita(s).`);
    }
    if (input.venueId !== undefined) await this.assertVenue(input.venueId);
    await this.prisma.event.update({ where: { id: eventId }, data: input });
    return this.manageDetail(userId, eventId);
  }

  async transition(userId: string, eventId: string, action: z.infer<typeof EventTransitionSchema>['action']) {
    const event = await this.loadForManage(userId, eventId);
    const to = ACTION_TARGET[action];
    const now = new Date();
    assertEventTransition(event.status, to, { now, startsAt: event.startsAt, applicationDeadline: event.applicationDeadline });
    const stamp: Prisma.EventUpdateInput =
      to === 'OPEN'
        ? { publishedAt: event.publishedAt ?? now, closedAt: null }
        : to === 'CLOSED'
          ? { closedAt: now }
          : to === 'COMPLETED'
            ? { completedAt: now }
            : { cancelledAt: now };
    // Atualização condicional ao estado lido (evita corrida entre duas transições simultâneas).
    const res = await this.prisma.event.updateMany({ where: { id: eventId, status: event.status }, data: { status: to, ...(stamp as object) } });
    if (res.count !== 1) throw conflict('CONCURRENT_UPDATE', 'A publicação foi alterada por outra pessoa. Recarregue a página.');
    return this.manageDetail(userId, eventId);
  }

  // ─────────── Consulta pública ───────────

  async searchPublic(f: z.infer<typeof EventSearchSchema>) {
    const now = new Date();
    const rows = await this.prisma.event.findMany({
      where: {
        status: 'OPEN',
        applicationDeadline: { gte: now },
        ...(f.genre ? { genres: { has: f.genre } } : {}),
        ...(f.city
          ? {
              OR: [
                { venue: { city: { equals: f.city, mode: 'insensitive' } } },
                { venueId: null, organizer: { city: { equals: f.city, mode: 'insensitive' } } },
              ],
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
      orderBy: { applicationDeadline: 'asc' },
      take: 100,
      select: eventPublicSelect,
    });
    return rows.map(eventOut);
  }

  /** Detalhe público: rascunhos não são exibidos. */
  async publicDetail(eventId: string) {
    const e = await this.prisma.event.findFirst({ where: { id: eventId, status: { not: 'DRAFT' } }, select: eventPublicSelect });
    if (!e) throw notFound('Oportunidade não encontrada.');
    return eventOut(e);
  }

  // ─────────── Candidaturas (artista/banda) ───────────

  async apply(userId: string, eventId: string, input: z.infer<typeof ApplySchema>) {
    await this.access.assertCanManageArtist(userId, input.artistId);
    const [event, artist] = await Promise.all([
      this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true, applicationDeadline: true } }),
      this.prisma.artist.findUniqueOrThrow({ where: { id: input.artistId }, select: { visibility: true } }),
    ]);
    if (!event || event.status === 'DRAFT') throw notFound('Oportunidade não encontrada.');
    if (!acceptsApplications(event, new Date())) throw conflict('APPLICATIONS_CLOSED', 'As inscrições desta oportunidade estão encerradas.');
    if (artist.visibility !== 'PUBLIC') {
      throw unprocessable('PROFILE_NOT_PUBLIC', 'Publique o perfil artístico antes de se candidatar — a casa precisa conseguir vê-lo.');
    }
    const existing = await this.prisma.eventApplication.findUnique({ where: { eventId_artistId: { eventId, artistId: input.artistId } } });
    if (existing) {
      if (existing.status !== 'WITHDRAWN') throw conflict('DUPLICATE_APPLICATION', 'Esta identidade artística já se candidatou a esta oportunidade.');
      assertApplicationTransition('WITHDRAWN', 'PENDING');
      const res = await this.prisma.eventApplication.updateMany({
        where: { id: existing.id, status: 'WITHDRAWN' },
        data: { status: 'PENDING', message: input.message, submittedById: userId, withdrawnAt: null, decidedAt: null, decidedById: null, decisionNote: null },
      });
      if (res.count !== 1) throw conflict('DUPLICATE_APPLICATION', 'Esta identidade artística já se candidatou a esta oportunidade.');
      return this.applicationForArtist(userId, existing.id);
    }
    // Unicidade (eventId, artistId) garantida pelo banco; P2002 vira 409.
    const created = await this.prisma.eventApplication.create({
      data: { eventId, artistId: input.artistId, submittedById: userId, message: input.message },
      select: { id: true },
    });
    return this.applicationForArtist(userId, created.id);
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
        createdAt: true,
        decidedAt: true,
        decisionNote: true,
        withdrawnAt: true,
        artist: { select: { id: true, name: true, slug: true, kind: true } },
        event: { select: { id: true, title: true, startsAt: true, applicationDeadline: true, status: true, organizer: { select: orgPublicSelect } } },
        booking: { select: { id: true, status: true } },
      },
    });
    return rows.map((r) => ({ ...r, event: { ...r.event, organizer: orgOut(r.event.organizer) } }));
  }

  async withdraw(userId: string, applicationId: string) {
    const app = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, artistId: true, status: true, booking: { select: { status: true } } },
    });
    if (!app) throw notFound('Candidatura não encontrada.');
    await this.access.assertCanManageArtist(userId, app.artistId);
    assertApplicationTransition(app.status, 'WITHDRAWN');
    if (app.booking && !['DECLINED', 'CANCELLED'].includes(app.booking.status)) {
      throw conflict('BOOKING_IN_PROGRESS', 'Há uma negociação vinculada a esta candidatura. Encerre a negociação antes de retirar.');
    }
    const res = await this.prisma.eventApplication.updateMany({
      where: { id: applicationId, status: app.status },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    });
    if (res.count !== 1) throw conflict('CONCURRENT_UPDATE', 'A candidatura mudou de estado. Recarregue a página.');
    return this.applicationForArtist(userId, applicationId);
  }

  // ─────────── Análise pela casa ───────────

  /** Aceitar ≠ contratar: nenhuma negociação é criada nem confirmada automaticamente. */
  async decide(userId: string, applicationId: string, decision: 'ACCEPTED' | 'REJECTED', note?: string) {
    const app = await this.prisma.eventApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, eventId: true, event: { select: { organizerId: true, status: true, slots: true } }, booking: { select: { status: true } } },
    });
    if (!app) throw notFound('Candidatura não encontrada.');
    await this.access.assertOrgMember(userId, app.event.organizerId);
    if (['CANCELLED', 'COMPLETED', 'DRAFT'].includes(app.event.status)) {
      throw conflict('EVENT_NOT_ACTIVE', 'Esta publicação não está mais ativa.');
    }
    assertApplicationTransition(app.status, decision);
    if (decision === 'ACCEPTED') {
      const accepted = await this.prisma.eventApplication.count({ where: { eventId: app.eventId, status: 'ACCEPTED' } });
      if (accepted >= app.event.slots) throw conflict('SLOTS_FULL', 'Todas as vagas já foram preenchidas por candidaturas aceitas.');
    }
    if (decision === 'REJECTED' && app.booking && !['DECLINED', 'CANCELLED'].includes(app.booking.status)) {
      throw conflict('BOOKING_IN_PROGRESS', 'Há uma negociação em andamento com esta candidatura. Encerre-a antes.');
    }
    const res = await this.prisma.eventApplication.updateMany({
      where: { id: applicationId, status: app.status },
      data: { status: decision, decidedAt: new Date(), decidedById: userId, decisionNote: note ?? null },
    });
    if (res.count !== 1) throw conflict('CONCURRENT_UPDATE', 'A candidatura mudou de estado. Recarregue a página.');
    return this.manageDetail(userId, app.eventId);
  }

  /** Candidaturas das identidades que o usuário administra para um evento (botão "Candidatar"). */
  async myApplicationsForEvent(userId: string, eventId: string) {
    const ids = await this.access.managedArtistIds(userId);
    return this.prisma.eventApplication.findMany({
      where: { eventId, artistId: { in: ids } },
      select: { id: true, artistId: true, status: true, booking: { select: { id: true, status: true } } },
    });
  }
}
