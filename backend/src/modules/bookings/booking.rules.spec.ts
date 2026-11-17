import { assertBookingTransition, assertCanConfirm, assertCanRespondToOffer, resolveSide } from './booking.rules';

describe('regras de Booking', () => {
  it('fluxo NEGOTIATING → AGREED → CONFIRMED', () => {
    expect(() => assertBookingTransition('NEGOTIATING', 'AGREED')).not.toThrow();
    expect(() => assertBookingTransition('AGREED', 'CONFIRMED')).not.toThrow();
  });
  it('não confirma diretamente de NEGOTIATING (confirmação é explícita após acordo)', () => {
    expect(() => assertBookingTransition('NEGOTIATING', 'CONFIRMED')).toThrow();
  });
  it('estados encerrados são finais', () => {
    expect(() => assertBookingTransition('DECLINED', 'NEGOTIATING')).toThrow();
    expect(() => assertBookingTransition('CANCELLED', 'CONFIRMED')).toThrow();
  });
  it('apenas a casa confirma', () => {
    expect(() => assertCanConfirm('AGREED', 'ARTIST')).toThrow(/casa/);
    expect(() => assertCanConfirm('AGREED', 'VENUE')).not.toThrow();
  });
  it('não responde à própria proposta nem a proposta já respondida', () => {
    expect(() =>
      assertCanRespondToOffer({ bookingStatus: 'NEGOTIATING', offerStatus: 'PENDING', offerAuthorSide: 'VENUE', actingSide: 'VENUE' }),
    ).toThrow();
    expect(() =>
      assertCanRespondToOffer({ bookingStatus: 'NEGOTIATING', offerStatus: 'SUPERSEDED', offerAuthorSide: 'VENUE', actingSide: 'ARTIST' }),
    ).toThrow();
    expect(() =>
      assertCanRespondToOffer({ bookingStatus: 'NEGOTIATING', offerStatus: 'PENDING', offerAuthorSide: 'VENUE', actingSide: 'ARTIST' }),
    ).not.toThrow();
  });
  it('sem lado → não encontrado; dois lados → bloqueado', () => {
    expect(() => resolveSide(new Set())).toThrow(/não encontrada/);
    expect(() => resolveSide(new Set(['VENUE', 'ARTIST']))).toThrow(/dois lados/);
    expect(resolveSide(new Set(['ARTIST']))).toBe('ARTIST');
  });
});
