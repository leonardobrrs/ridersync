import { isPublicShow } from './public-agenda.service';

const org = (type: 'VENUE' | 'INDIVIDUAL') => ({ type, name: 'X', slug: 'x', city: 'Maceió', state: 'AL', addressLine: null, neighborhood: null });
const event = (visibility: 'PUBLIC' | 'PRIVATE', status: 'OPEN' | 'CANCELLED' | 'FILLED' = 'FILLED') => ({
  id: 'e',
  title: 'T',
  visibility,
  status,
  locationName: null,
  locationCity: null,
  locationState: null,
  venue: null,
});

describe('publicidade dos shows confirmados', () => {
  it('evento público é exibido; privado ou cancelado nunca', () => {
    expect(isPublicShow({ event: event('PUBLIC'), organization: org('VENUE') })).toBe(true);
    expect(isPublicShow({ event: event('PRIVATE'), organization: org('VENUE') })).toBe(false);
    expect(isPublicShow({ event: event('PUBLIC', 'CANCELLED'), organization: org('VENUE') })).toBe(false);
  });
  it('proposta direta: pública em casa de show; contratante individual (festa particular) nunca', () => {
    expect(isPublicShow({ event: null, organization: org('VENUE') })).toBe(true);
    expect(isPublicShow({ event: null, organization: org('INDIVIDUAL') })).toBe(false);
  });
});
