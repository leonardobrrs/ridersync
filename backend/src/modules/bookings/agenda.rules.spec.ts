import { describeInterval, intervalOf, overlaps, sameLineUp, venueKeyOf } from './agenda.rules';

const at = (hhmm: string, day = '2026-12-20') => new Date(`${day}T${hhmm}:00-03:00`);

describe('regras de agenda', () => {
  it('detecta sobreposição real de horários (19h–22h × 21h–23h)', () => {
    expect(overlaps(intervalOf(at('19:00'), 180), intervalOf(at('21:00'), 120))).toBe(true);
  });

  it('eventos consecutivos não conflitam (19h–22h × 22h–23h)', () => {
    expect(overlaps(intervalOf(at('19:00'), 180), intervalOf(at('22:00'), 60))).toBe(false);
  });

  it('mesmo dia em horários diferentes não conflita; dias diferentes também não', () => {
    expect(overlaps(intervalOf(at('14:00'), 60), intervalOf(at('19:00'), 120))).toBe(false);
    expect(overlaps(intervalOf(at('19:00'), 180), intervalOf(at('19:00', '2026-12-21'), 180))).toBe(false);
  });

  it('um intervalo contido no outro conflita', () => {
    expect(overlaps(intervalOf(at('18:00'), 300), intervalOf(at('20:00'), 30))).toBe(true);
  });

  it('atravessa a meia-noite corretamente', () => {
    expect(overlaps(intervalOf(at('23:00'), 120), intervalOf(at('00:30', '2026-12-21'), 60))).toBe(true);
  });

  it('local: evento usa o local do evento; proposta direta só ocupa local se a organização for uma casa', () => {
    expect(venueKeyOf({ eventId: 'e1', eventVenueId: 'v1', organizationId: 'o1', organizationType: 'VENUE' })).toBe('v1');
    expect(venueKeyOf({ eventId: 'e1', eventVenueId: null, organizationId: 'o1', organizationType: 'VENUE' })).toBeNull();
    expect(venueKeyOf({ eventId: null, eventVenueId: null, organizationId: 'o1', organizationType: 'VENUE' })).toBe('o1');
    expect(venueKeyOf({ eventId: null, eventVenueId: null, organizationId: 'o1', organizationType: 'INDIVIDUAL' })).toBeNull();
  });

  it('artistas do mesmo evento formam o line-up (não disputam o local entre si)', () => {
    expect(sameLineUp({ eventId: 'e1' }, { eventId: 'e1' })).toBe(true);
    expect(sameLineUp({ eventId: 'e1' }, { eventId: 'e2' })).toBe(false);
    expect(sameLineUp({ eventId: null }, { eventId: null })).toBe(false);
  });

  it('descreve o intervalo no fuso de Maceió', () => {
    expect(describeInterval(intervalOf(at('19:00'), 180))).toBe('20/12/2026, 19:00–22:00');
  });
});
