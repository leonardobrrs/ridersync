/**
 * Regras puras de agenda. Um compromisso ocupa o intervalo semiaberto [início, início + duração):
 * shows consecutivos (um termina às 22h e o outro começa às 22h) NÃO conflitam.
 */
export interface Interval {
  start: Date;
  end: Date;
}

/** Maior duração aceita numa oferta (OfferSchema: até 720 min). Usada para limitar a busca de candidatos. */
export const MAX_DURATION_MINUTES = 720;

export function intervalOf(performanceAt: Date, durationMinutes: number): Interval {
  return { start: performanceAt, end: new Date(performanceAt.getTime() + durationMinutes * 60_000) };
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Local físico ocupado por um compromisso: o local do evento ou, em proposta direta sem evento,
 * a própria organização quando ela é uma casa (VENUE). Sem local conhecido, não há disputa de local.
 */
export function venueKeyOf(b: { eventId: string | null; eventVenueId: string | null; organizationId: string; organizationType: string }): string | null {
  if (b.eventId) return b.eventVenueId;
  return b.organizationType === 'VENUE' ? b.organizationId : null;
}

/**
 * Dois compromissos no mesmo local só conflitam se forem de eventos diferentes (ou sem evento):
 * vários artistas do MESMO evento compõem o line-up e dividem o local de propósito.
 */
export function sameLineUp(a: { eventId: string | null }, b: { eventId: string | null }): boolean {
  return !!a.eventId && a.eventId === b.eventId;
}

const fmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Maceio',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const fmtTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });

export function describeInterval(i: Interval): string {
  return `${fmt.format(i.start)}–${fmtTime.format(i.end)}`;
}
