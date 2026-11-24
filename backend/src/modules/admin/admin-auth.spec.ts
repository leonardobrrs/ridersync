import { loadEnv } from '../../config/env';
import { adminConfig, issueAdminToken, verifyAdminToken } from './admin-auth';

const HASH = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA';
const env = (over: Record<string, string> = {}) =>
  loadEnv({ DATABASE_URL: 'postgres://x', APP_SECRET: 'x'.repeat(40), ADMIN_USERNAME: 'adm', ADMIN_PASSWORD_HASH: HASH, ...over } as NodeJS.ProcessEnv);

describe('sessão do painel de administração', () => {
  it('desativado sem usuário ou com hash que não é Argon2', () => {
    expect(adminConfig(env({ ADMIN_USERNAME: '' }))).toBeNull();
    expect(adminConfig(env({ ADMIN_PASSWORD_HASH: 'ridersync2026' }))).toBeNull();
    expect(adminConfig(env())).toEqual({ username: 'adm', hash: HASH });
    expect(verifyAdminToken(issueAdminToken(env()), env({ ADMIN_USERNAME: '' }))).toBe(false);
  });

  it('token válido; adulterado, vencido, de outro segredo ou de outra senha é recusado', () => {
    const now = Date.now();
    const t = issueAdminToken(env(), now);
    expect(verifyAdminToken(t, env(), now + 1000)).toBe(true);
    expect(verifyAdminToken(t, env(), now + 9 * 3600_000)).toBe(false);
    expect(verifyAdminToken(t.slice(0, -2) + 'xx', env(), now)).toBe(false);
    expect(verifyAdminToken(t, env({ APP_SECRET: 'y'.repeat(40) }), now)).toBe(false);
    expect(verifyAdminToken(t, env({ ADMIN_PASSWORD_HASH: HASH.replace('aGFz', 'bGFz') }), now)).toBe(false);
    expect(verifyAdminToken(undefined, env(), now)).toBe(false);
    expect(verifyAdminToken('lixo', env(), now)).toBe(false);
  });
});
