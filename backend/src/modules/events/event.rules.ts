import { ApplicationStatus, EventStatus } from '@prisma/client';
import { conflict, unprocessable } from '../../common/errors';

/** Transições permitidas de Event. */
export const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['OPEN', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertEventTransition(
  from: EventStatus,
  to: EventStatus,
  ctx: { now: Date; startsAt: Date; applicationDeadline: Date },
) {
  if (!EVENT_TRANSITIONS[from].includes(to)) {
    throw conflict('INVALID_TRANSITION', `Não é possível mudar a publicação de ${from} para ${to}.`);
  }
  if (to === 'OPEN' && ctx.applicationDeadline.getTime() <= ctx.now.getTime()) {
    throw unprocessable('DEADLINE_PASSED', 'O prazo de candidatura já passou. Ajuste o prazo antes de abrir inscrições.');
  }
  if (to === 'OPEN' && ctx.startsAt.getTime() <= ctx.now.getTime()) {
    throw unprocessable('EVENT_IN_PAST', 'A data da apresentação já passou.');
  }
  if (to === 'COMPLETED' && ctx.startsAt.getTime() > ctx.now.getTime()) {
    throw unprocessable('EVENT_NOT_HAPPENED', 'Só é possível concluir após a data da apresentação.');
  }
}

export const EDITABLE_EVENT_STATUSES: EventStatus[] = ['DRAFT', 'OPEN', 'CLOSED'];

/** Inscrições abertas = estado OPEN e prazo ainda não vencido. */
export function acceptsApplications(e: { status: EventStatus; applicationDeadline: Date }, now: Date) {
  return e.status === 'OPEN' && e.applicationDeadline.getTime() >= now.getTime();
}

export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: ['REJECTED', 'WITHDRAWN'],
  REJECTED: [],
  WITHDRAWN: ['PENDING'], // reenvio pela própria identidade enquanto as inscrições estiverem abertas
};

export function assertApplicationTransition(from: ApplicationStatus, to: ApplicationStatus) {
  if (!APPLICATION_TRANSITIONS[from].includes(to)) {
    throw conflict('INVALID_TRANSITION', `Candidatura em estado ${from} não pode passar para ${to}.`);
  }
}
