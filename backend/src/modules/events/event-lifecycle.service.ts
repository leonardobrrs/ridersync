import { Injectable, Logger } from '@nestjs/common';
import { Event, EventStatus } from '@prisma/client';
import { notFound } from '../../common/errors';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_STATUS_LABEL, statusAfterSlotChange, sweepTarget } from './event.rules';

const ACTIVE_DIRECT_BOOKING = ['NEGOTIATING', 'AGREED', 'CONFIRMED'] as const;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Vagas e transições automáticas de eventos.
 * Vaga ocupada = candidatura ACCEPTED ou convite direto ativo (negociação DIRECT vinculada ao evento).
 * Toda ocupação/liberação acontece com o evento bloqueado (SELECT ... FOR UPDATE) na transação do chamador.
 */
@Injectable()
export class EventLifecycleService {
  private readonly logger = new Logger(EventLifecycleService.name);
  private lastSweep = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async lock(tx: Tx, eventId: string): Promise<Event> {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`;
    if (!rows.length) throw notFound('Evento não encontrado.');
    return tx.event.findUniqueOrThrow({ where: { id: eventId } });
  }

  async filledSlots(tx: Tx | PrismaService, eventId: string) {
    const [accepted, invites] = await Promise.all([
      tx.eventApplication.count({ where: { eventId, status: 'ACCEPTED' } }),
      tx.booking.count({ where: { eventId, origin: 'DIRECT', status: { in: [...ACTIVE_DIRECT_BOOKING] } } }),
    ]);
    return accepted + invites;
  }

  /** Recalcula o estado após ocupar/liberar vaga. O evento já deve estar bloqueado pelo chamador. */
  async applySlotChange(tx: Tx, event: Event, now = new Date()): Promise<EventStatus> {
    const filled = await this.filledSlots(tx, event.id);
    const next = statusAfterSlotChange(event, filled, now);
    if (next === event.status) return next;
    await tx.event.update({
      where: { id: event.id },
      data: { status: next, ...(next === 'FILLED' ? { filledAt: now } : {}), ...(next === 'CLOSED' ? { closedAt: now } : {}) },
    });
    await this.notifications.notify(tx, await this.access.organizationMemberUserIds(event.organizerId, tx), {
      category: 'EVENTS',
      type: next === 'FILLED' ? 'EVENT_FILLED' : 'EVENT_SLOT_RELEASED',
      title: next === 'FILLED' ? `Vagas preenchidas: ${event.title}` : `Vaga liberada: ${event.title}`,
      body:
        next === 'FILLED'
          ? 'Todas as vagas foram ocupadas e as inscrições foram fechadas automaticamente.'
          : `Uma vaga foi liberada. Situação atual: ${EVENT_STATUS_LABEL[next]}.`,
      link: `/painel/eventos/${event.id}`,
      dedupeKey: `event-slots:${event.id}:${next}:${now.getTime()}`,
    });
    return next;
  }

  /**
   * Transições por data/prazo. Executada pelo cron diário e, no máximo uma vez por minuto por instância,
   * antes de consultas de eventos — os estados exibidos nunca dependem do frontend.
   */
  async sweepIfStale(now = new Date()) {
    if (now.getTime() - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now.getTime();
    await this.sweep(now).catch((e) => this.logger.error(`Falha na atualização automática de eventos: ${e}`));
  }

  async sweep(now = new Date()) {
    const candidates = await this.prisma.event.findMany({
      where: {
        OR: [
          { status: { in: ['OPEN', 'FILLED', 'CLOSED'] }, startsAt: { lte: now } },
          { status: 'OPEN', applicationDeadline: { lt: now } },
        ],
      },
      take: 500,
      select: { id: true, status: true, startsAt: true, applicationDeadline: true, organizerId: true, title: true, _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } } },
    });
    let changed = 0;
    for (const e of candidates) {
      const target = sweepTarget(e, e._count.bookings > 0, now);
      if (target === e.status) continue;
      await this.prisma.$transaction(async (tx) => {
        const res = await tx.event.updateMany({
          where: { id: e.id, status: e.status },
          data: { status: target, ...(target === 'COMPLETED' ? { completedAt: now } : { closedAt: now }) },
        });
        if (res.count !== 1) return;
        changed++;
        if (target === 'CLOSED' && e.startsAt.getTime() > now.getTime()) {
          await this.notifications.notify(tx, await this.access.organizationMemberUserIds(e.organizerId, tx), {
            category: 'EVENTS',
            type: 'EVENT_DEADLINE_CLOSED',
            title: `Inscrições encerradas: ${e.title}`,
            body: 'O prazo de candidatura terminou e as inscrições foram encerradas automaticamente.',
            link: `/painel/eventos/${e.id}`,
            dedupeKey: `event-deadline:${e.id}`,
          });
        }
      });
    }
    if (changed) await this.notifications.flush();
    return { checked: candidates.length, changed };
  }
}
