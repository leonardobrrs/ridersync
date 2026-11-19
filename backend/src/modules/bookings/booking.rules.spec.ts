import { assertBookingTransition, assertCanConfirm, assertCanRespondToOffer, resolveSide, unreadCount } from './booking.rules';

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
  it('apenas o contratante (casa ou contratante individual) confirma', () => {
    expect(() => assertCanConfirm('AGREED', 'ARTIST')).toThrow(/contratante/);
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

describe('mensagens não lidas', () => {
  const at = (min: number) => new Date(Date.UTC(2026, 10, 18, 20, min));
  const msgs = [
    { createdAt: at(0), author: { id: 'outro' } },
    { createdAt: at(5), author: { id: 'eu' } },
    { createdAt: at(10), author: { id: 'outro' } },
    { createdAt: at(15), author: null },
  ];
  it('sem leitura registrada conta todas as mensagens da outra parte (e de conta removida)', () => {
    expect(unreadCount(msgs, 'eu', null)).toBe(3);
  });
  it('conta só as da outra parte posteriores à última leitura; as próprias nunca contam', () => {
    expect(unreadCount(msgs, 'eu', at(5))).toBe(2);
    expect(unreadCount(msgs, 'eu', at(15))).toBe(0);
    expect(unreadCount(msgs, 'outro', at(0))).toBe(2);
  });
});
