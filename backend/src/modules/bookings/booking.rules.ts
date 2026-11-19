import { BookingSide, BookingStatus, OfferStatus } from '@prisma/client';
import { conflict, forbidden, notFound } from '../../common/errors';

/** Transições de Booking. CONFIRMED não implica apresentação realizada nem pagamento. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  NEGOTIATING: ['AGREED', 'DECLINED', 'CANCELLED'],
  AGREED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  DECLINED: [],
  CANCELLED: [],
};

export function assertBookingTransition(from: BookingStatus, to: BookingStatus) {
  if (!BOOKING_TRANSITIONS[from].includes(to)) {
    throw conflict('INVALID_TRANSITION', `A negociação está em ${from} e não pode passar para ${to}.`);
  }
}

/**
 * Lado em que o usuário atua. Sem lado → 404 (não revela a existência da negociação).
 * Nos dois lados (administra a casa e o artista) → bloqueia ações para evitar autonegociação.
 */
export function resolveSide(sides: Set<BookingSide>): BookingSide {
  if (sides.size === 0) throw notFound('Negociação não encontrada.');
  if (sides.size > 1) {
    throw conflict('BOTH_SIDES', 'Você administra os dois lados desta negociação; a ação precisa ser feita por outra pessoa.');
  }
  return [...sides][0];
}

export function assertCanRespondToOffer(params: {
  bookingStatus: BookingStatus;
  offerStatus: OfferStatus;
  offerAuthorSide: BookingSide;
  actingSide: BookingSide;
}) {
  if (params.bookingStatus !== 'NEGOTIATING') throw conflict('NOT_NEGOTIATING', 'A negociação não está mais aberta a respostas.');
  if (params.offerStatus !== 'PENDING') throw conflict('OFFER_NOT_PENDING', 'Esta proposta já foi respondida.');
  if (params.offerAuthorSide === params.actingSide) {
    throw forbidden('Você não pode responder à sua própria proposta; aguarde a outra parte.');
  }
}

export function assertCanConfirm(status: BookingStatus, side: BookingSide) {
  if (side !== 'VENUE') throw forbidden('A confirmação da contratação é feita pelo contratante.');
  assertBookingTransition(status, 'CONFIRMED');
}

export const MESSAGE_ALLOWED: BookingStatus[] = ['NEGOTIATING', 'AGREED', 'CONFIRMED'];

/**
 * Mensagens não lidas por uma pessoa: as da outra parte (ou de conta removida) enviadas depois da última leitura.
 * Sem registro de leitura, todas as mensagens da outra parte contam.
 */
export function unreadCount(messages: { createdAt: Date; author: { id: string } | null }[], userId: string, lastReadAt: Date | null): number {
  return messages.filter((m) => m.author?.id !== userId && (!lastReadAt || m.createdAt.getTime() > lastReadAt.getTime())).length;
}
