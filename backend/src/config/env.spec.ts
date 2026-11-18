import { loadEnv, originMatcher } from './env';

describe('originMatcher (CORS/CSRF)', () => {
  const allowed = originMatcher(['https://ridersync-front.vercel.app', 'https://ridersync-front-*-projetao2.vercel.app', 'http://localhost:5173']);

  it('aceita origens exatas', () => {
    expect(allowed('https://ridersync-front.vercel.app')).toBe(true);
    expect(allowed('http://localhost:5173')).toBe(true);
  });

  it('aceita URLs de Preview e alias de branch do projeto no time', () => {
    expect(allowed('https://ridersync-front-a1b2c3d4e-projetao2.vercel.app')).toBe(true);
    expect(allowed('https://ridersync-front-git-main-projetao2.vercel.app')).toBe(true);
  });

  it('recusa origens de terceiros e tentativas de burlar o curinga', () => {
    for (const o of [
      'https://evil.com',
      'https://ridersync-front.vercel.app.evil.com',
      'https://ridersync-front-x.evil.com-projetao2.vercel.app',
      'https://ridersync-front--projetao2.vercel.app',
      'http://ridersync-front-abc-projetao2.vercel.app',
      'https://ridersync-front-abc-projetao2.vercel.app:8443',
      'https://ridersync-front-abc-outrotime.vercel.app',
    ]) {
      expect(allowed(o)).toBe(false);
    }
  });

  it('sem curingas, comporta-se como lista exata', () => {
    const only = originMatcher(['http://localhost:5173']);
    expect(only('http://localhost:5173')).toBe(true);
    expect(only('http://localhost:5174')).toBe(false);
  });
});

describe('configuração de e-mail e segredos por ambiente', () => {
  const base = { DATABASE_URL: 'postgresql://x' };
  it('desenvolvimento usa o driver de log por padrão; produção usa "disabled" (nunca simula envio)', () => {
    expect(loadEnv({ ...base, NODE_ENV: 'development' }).MAIL_DRIVER).toBe('log');
    expect(loadEnv({ ...base, NODE_ENV: 'production', APP_SECRET: 'x'.repeat(32) }).MAIL_DRIVER).toBe('disabled');
  });
  it('produção exige APP_SECRET e recusa o driver de log', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/APP_SECRET/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', APP_SECRET: 'x'.repeat(32), MAIL_DRIVER: 'log' })).toThrow(/MAIL_DRIVER/);
  });
  it('Resend exige chave; Google exige ID e segredo juntos', () => {
    expect(() => loadEnv({ ...base, MAIL_DRIVER: 'resend' })).toThrow(/RESEND_API_KEY/);
    expect(() => loadEnv({ ...base, GOOGLE_CLIENT_ID: 'abc' })).toThrow(/GOOGLE/);
    expect(loadEnv({ ...base, MAIL_DRIVER: 'resend', RESEND_API_KEY: 're_x' }).MAIL_DRIVER).toBe('resend');
  });
  it('Brevo exige chave e remetente no formato "Nome <email>"', () => {
    expect(() => loadEnv({ ...base, MAIL_DRIVER: 'brevo' })).toThrow(/BREVO_API_KEY/);
    expect(() => loadEnv({ ...base, MAIL_DRIVER: 'brevo', BREVO_API_KEY: 'k', MAIL_FROM: 'sem-email' })).toThrow(/MAIL_FROM/);
    const env = loadEnv({ ...base, MAIL_DRIVER: 'brevo', BREVO_API_KEY: 'k', MAIL_FROM: 'RiderSync <contato@exemplo.com>' });
    expect(env.MAIL_DRIVER).toBe('brevo');
  });
  it('confirmação de e-mail obrigatória é opcional (padrão: não bloqueia o primeiro acesso)', () => {
    expect(loadEnv(base).EMAIL_VERIFICATION_REQUIRED).toBe(false);
    expect(loadEnv({ ...base, EMAIL_VERIFICATION_REQUIRED: 'true' }).EMAIL_VERIFICATION_REQUIRED).toBe(true);
  });
});

describe('variáveis vazias', () => {
  it('valor vazio (copiado do .env.example) equivale a variável não definida', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://x', APP_SECRET: '', CRON_SECRET: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
    expect(env.APP_SECRET).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });
});
