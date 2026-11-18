import { DEFAULT_PREFERENCES, shouldEmail } from './notification.types';

describe('preferências de e-mail das notificações', () => {
  it('sem preferência registrada, envia todas as categorias', () => {
    for (const c of ['INVITATIONS', 'APPLICATIONS', 'BOOKINGS', 'EVENTS', 'ACCOUNT'] as const) expect(shouldEmail(c, null)).toBe(true);
  });
  it('desativar e-mails bloqueia notificações comuns, mas nunca as de segurança/conta', () => {
    const off = { ...DEFAULT_PREFERENCES, emailEnabled: false };
    expect(shouldEmail('BOOKINGS', off)).toBe(false);
    expect(shouldEmail('INVITATIONS', off)).toBe(false);
    expect(shouldEmail('ACCOUNT', off)).toBe(true);
  });
  it('respeita a preferência por categoria', () => {
    const p = { ...DEFAULT_PREFERENCES, emailBookings: false };
    expect(shouldEmail('BOOKINGS', p)).toBe(false);
    expect(shouldEmail('EVENTS', p)).toBe(true);
  });
});
