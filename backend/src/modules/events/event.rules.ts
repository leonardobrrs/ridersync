import { ApplicationStatus, EventStatus } from '@prisma/client';
import { conflict, unprocessable } from '../../common/errors';

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Inscrições abertas',
  FILLED: 'Vagas preenchidas',
  CLOSED: 'Inscrições encerradas',
  POSTPONED: 'Adiado',
  COMPLETED: 'Realizado',
  CANCELLED: 'Cancelado',
};

/**
 * Transições disparadas por ação do organizador. As automáticas (vagas e datas) ficam em
 * `statusAfterSlotChange` e `sweepTarget` e nunca dependem do frontend.
 */
export const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'POSTPONED', 'CANCELLED'],
  FILLED: ['CLOSED', 'POSTPONED', 'COMPLETED', 'CANCELLED'],
  CLOSED: ['OPEN', 'POSTPONED', 'COMPLETED', 'CANCELLED'],
  POSTPONED: ['OPEN', 'CLOSED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertEventTransition(
  from: EventStatus,
  to: EventStatus,
  ctx: { now: Date; startsAt: Date; applicationDeadline: Date; filledSlots: number; slots: number },
) {
  if (!EVENT_TRANSITIONS[from].includes(to)) {
    throw conflict('INVALID_TRANSITION', `Não é possível mudar de "${EVENT_STATUS_LABEL[from]}" para "${EVENT_STATUS_LABEL[to]}".`);
  }
  if (to === 'OPEN') {
    if (ctx.applicationDeadline.getTime() <= ctx.now.getTime()) {
      throw unprocessable('DEADLINE_PASSED', 'O prazo de candidatura já passou. Ajuste o prazo antes de abrir inscrições.');
    }
    if (ctx.startsAt.getTime() <= ctx.now.getTime()) throw unprocessable('EVENT_IN_PAST', 'A data da apresentação já passou.');
    if (ctx.filledSlots >= ctx.slots) throw conflict('SLOTS_FULL', 'Todas as vagas estão preenchidas. Aumente o número de vagas para reabrir.');
  }
  if (to === 'COMPLETED' && ctx.startsAt.getTime() > ctx.now.getTime()) {
    throw unprocessable('EVENT_NOT_HAPPENED', 'Só é possível concluir após a data da apresentação.');
  }
}

export const EDITABLE_EVENT_STATUSES: EventStatus[] = ['DRAFT', 'OPEN', 'FILLED', 'CLOSED', 'POSTPONED'];
/** Estados em que o organizador ainda decide candidaturas e negocia. */
export const ACTIVE_EVENT_STATUSES: EventStatus[] = ['OPEN', 'FILLED', 'CLOSED', 'POSTPONED'];

/** Inscrições abertas = estado OPEN e prazo ainda não vencido. */
export function acceptsApplications(e: { status: EventStatus; applicationDeadline: Date }, now: Date) {
  return e.status === 'OPEN' && e.applicationDeadline.getTime() >= now.getTime();
}

/**
 * Estado após ocupar/liberar vagas (executado na mesma transação, com o evento bloqueado).
 * OPEN → FILLED quando todas as vagas estão ocupadas; FILLED → OPEN (ou CLOSED se o prazo venceu) ao liberar.
 */
export function statusAfterSlotChange(e: { status: EventStatus; slots: number; applicationDeadline: Date }, filledSlots: number, now: Date): EventStatus {
  if (e.status === 'OPEN' && filledSlots >= e.slots) return 'FILLED';
  if (e.status === 'FILLED' && filledSlots < e.slots) return e.applicationDeadline.getTime() >= now.getTime() ? 'OPEN' : 'CLOSED';
  return e.status;
}

/**
 * Atualização automática por tempo. Passada a data: COMPLETED se houve contratação confirmada,
 * senão CLOSED (encerrado sem contratação). Prazo de inscrição vencido: OPEN → CLOSED.
 */
export function sweepTarget(
  e: { status: EventStatus; startsAt: Date; applicationDeadline: Date },
  hasConfirmedBooking: boolean,
  now: Date,
): EventStatus {
  const t = now.getTime();
  if (['OPEN', 'FILLED', 'CLOSED'].includes(e.status) && e.startsAt.getTime() <= t) {
    return hasConfirmedBooking ? 'COMPLETED' : 'CLOSED';
  }
  if (e.status === 'OPEN' && e.applicationDeadline.getTime() < t) return 'CLOSED';
  return e.status;
}

export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: ['REJECTED', 'WITHDRAWN', 'CANCELLED'],
  REJECTED: [],
  WITHDRAWN: ['PENDING'], // reenvio pela própria identidade enquanto as inscrições estiverem abertas
  CANCELLED: [],
};

export function assertApplicationTransition(from: ApplicationStatus, to: ApplicationStatus) {
  if (!APPLICATION_TRANSITIONS[from].includes(to)) {
    throw conflict('INVALID_TRANSITION', `Candidatura em estado ${from} não pode passar para ${to}.`);
  }
}

/** Candidatura que ocupa vaga. */
export const SLOT_OCCUPYING: ApplicationStatus[] = ['ACCEPTED'];
