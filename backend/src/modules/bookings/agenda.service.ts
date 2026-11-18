import { Injectable } from '@nestjs/common';
import { Booking } from '@prisma/client';
import { conflict } from '../../common/errors';
import { Tx } from '../../prisma/prisma.service';
import { describeInterval, Interval, intervalOf, MAX_DURATION_MINUTES, overlaps, sameLineUp, venueKeyOf } from './agenda.rules';

/**
 * Agenda de contratações confirmadas. Só CONFIRMED ocupa agenda: propostas pendentes, acordos ainda não
 * confirmados, recusas e cancelamentos não bloqueiam ninguém.
 *
 * Concorrência: antes de verificar, a transação obtém advisory locks (pg_advisory_xact_lock) dos recursos
 * envolvidos — a identidade artística e o local físico — sempre na mesma ordem. Duas confirmações que
 * disputam o mesmo recurso são serializadas; a segunda só verifica depois do commit da primeira e enxerga
 * a reserva dela. Os locks são liberados automaticamente no fim da transação (commit ou rollback).
 */
@Injectable()
export class AgendaService {
  async lockResources(tx: Tx, keys: string[]) {
    for (const key of [...new Set(keys)].sort()) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text AS locked`;
    }
  }

  /**
   * Garante que a confirmação de `booking` (intervalo da oferta aceita) não colide com outra contratação
   * confirmada do mesmo artista/banda ou do mesmo local. Lança SCHEDULE_CONFLICT. Deve rodar na transação
   * da confirmação, com o booking (e o evento) já bloqueados.
   */
  async assertNoConflicts(tx: Tx, booking: Booking): Promise<Interval> {
    const agreed = await tx.bookingOffer.findFirst({ where: { bookingId: booking.id, status: 'ACCEPTED' } });
    if (!agreed) throw conflict('NO_AGREED_OFFER', 'Não há termos acordados nesta negociação.');
    const interval = intervalOf(agreed.performanceAt, agreed.durationMinutes);

    const [event, org] = await Promise.all([
      booking.eventId ? tx.event.findUnique({ where: { id: booking.eventId }, select: { venueId: true } }) : null,
      tx.organization.findUniqueOrThrow({ where: { id: booking.organizationId }, select: { type: true } }),
    ]);
    const venueKey = venueKeyOf({
      eventId: booking.eventId,
      eventVenueId: event?.venueId ?? null,
      organizationId: booking.organizationId,
      organizationType: org.type,
    });

    await this.lockResources(tx, [`agenda:artist:${booking.artistId}`, ...(venueKey ? [`agenda:venue:${venueKey}`] : [])]);

    // Candidatos: confirmados cujo início cai na janela que pode sobrepor (duração máxima de uma oferta).
    const windowStart = new Date(interval.start.getTime() - MAX_DURATION_MINUTES * 60_000);
    const candidates = await tx.booking.findMany({
      where: {
        id: { not: booking.id },
        status: 'CONFIRMED',
        offers: { some: { status: 'ACCEPTED', performanceAt: { gt: windowStart, lt: interval.end } } },
        OR: [
          { artistId: booking.artistId },
          ...(venueKey ? [{ event: { venueId: venueKey } }, { eventId: null, organizationId: venueKey }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        artistId: true,
        eventId: true,
        organizationId: true,
        organization: { select: { type: true } },
        event: { select: { venueId: true } },
        offers: { where: { status: 'ACCEPTED' }, take: 1, select: { performanceAt: true, durationMinutes: true } },
      },
    });

    for (const other of candidates) {
      const offer = other.offers[0];
      if (!offer) continue;
      const otherInterval = intervalOf(offer.performanceAt, offer.durationMinutes);
      if (!overlaps(interval, otherInterval)) continue;
      if (other.artistId === booking.artistId) {
        // Não revela título nem contratante do outro compromisso: são dados de outra negociação.
        throw conflict(
          'SCHEDULE_CONFLICT',
          `Conflito de agenda: o artista já tem uma apresentação confirmada que se sobrepõe a este horário (${describeInterval(otherInterval)}).`,
        );
      }
      const otherVenue = venueKeyOf({
        eventId: other.eventId,
        eventVenueId: other.event?.venueId ?? null,
        organizationId: other.organizationId,
        organizationType: other.organization.type,
      });
      if (venueKey && otherVenue === venueKey && !sameLineUp(booking, other)) {
        // Título só quando o outro compromisso é da mesma organização (quem confirma tem acesso a ele).
        const which = other.organizationId === booking.organizationId ? ` ("${other.title}")` : '';
        throw conflict(
          'SCHEDULE_CONFLICT',
          `Conflito de agenda: o local já tem outra apresentação confirmada nesse horário${which} (${describeInterval(otherInterval)}).`,
        );
      }
    }
    return interval;
  }
}
