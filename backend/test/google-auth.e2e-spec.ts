import type { INestApplication } from '@nestjs/common';
import type { Client as ClientT } from './helpers';

// Variáveis definidas antes de carregar a aplicação (o loadEnv lê o ambiente uma vez por arquivo de teste).
process.env.GOOGLE_CLIENT_ID = 'cliente-teste.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'segredo-de-teste';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5173/api/auth/google/callback';

/* eslint-disable @typescript-eslint/no-require-imports */
const { bootApp, Client, registerUser, uniqueEmail } = require('./helpers') as typeof import('./helpers');
const { GoogleAuthService } = require('../src/modules/auth/google-auth.service') as typeof import('../src/modules/auth/google-auth.service');
const { GoogleAuthError } = require('../src/modules/auth/google-oauth') as typeof import('../src/modules/auth/google-oauth');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('Login com Google (integração, Google simulado)', () => {
  let app: INestApplication;
  let exchange: jest.SpyInstance;

  beforeAll(async () => {
    app = await bootApp();
    exchange = jest.spyOn(app.get(GoogleAuthService), 'exchangeCode');
  });
  afterAll(async () => {
    await app.close();
  });

  /** Inicia o fluxo e devolve o state emitido (o cookie fica no agente). */
  async function start(c: ClientT, next = '/painel/perfil') {
    const res = await c.get(`/auth/google?next=${encodeURIComponent(next)}`);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location);
    expect(loc.hostname).toBe('accounts.google.com');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/rs_oauth_google=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/google/);
    return loc.searchParams.get('state')!;
  }

  it('informa que o provedor está habilitado', async () => {
    const res = await new Client(app).get('/auth/providers');
    expect(res.body).toEqual({ google: true });
  });

  it('cria conta nova pelo e-mail verificado, abre sessão e volta ao destino pedido', async () => {
    const c = new Client(app);
    const email = uniqueEmail('google');
    exchange.mockResolvedValueOnce({ sub: 'g-1', email, name: 'Conta Google' });
    const state = await start(c, '/painel/perfil');
    const cb = await c.get(`/auth/google/callback?code=codigo-ok&state=${state}`);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('/painel/perfil');
    expect(String(cb.headers['set-cookie'])).toMatch(/rs_session=/);
    const me = await c.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email, name: 'Conta Google' });
    // conta criada pelo Google não aceita login por senha (senha aleatória desconhecida)
    const pw = await new Client(app).post('/auth/login', { email, password: 'qualquer-senha-123' });
    expect(pw.status).toBe(401);
  });

  it('reutiliza conta existente com o mesmo e-mail (sem duplicar)', async () => {
    const existing = await registerUser(app, 'Pessoa Existente');
    const c = new Client(app);
    exchange.mockResolvedValueOnce({ sub: 'g-2', email: existing.user!.email, name: 'Outro Nome' });
    const state = await start(c);
    await c.get(`/auth/google/callback?code=codigo-ok&state=${state}`).expect(302);
    const me = await c.get('/auth/me');
    expect(me.body.user.id).toBe(existing.user!.id);
    expect(me.body.user.name).toBe('Pessoa Existente');
  });

  it('recusa state divergente ou ausente (CSRF de login) sem chamar o Google', async () => {
    exchange.mockClear();
    const c = new Client(app);
    await start(c);
    const res = await c.get('/auth/google/callback?code=x&state=forjado');
    expect(res.headers.location).toBe('/entrar?erro=google_sessao_expirada');
    const noCookie = await new Client(app).get('/auth/google/callback?code=x&state=qualquer');
    expect(noCookie.headers.location).toBe('/entrar?erro=google_sessao_expirada');
    expect(exchange).not.toHaveBeenCalled();
  });

  it('o state só vale uma vez (cookie é removido no retorno)', async () => {
    const c = new Client(app);
    exchange.mockResolvedValueOnce({ sub: 'g-3', email: uniqueEmail('replay'), name: 'Replay' });
    const state = await start(c);
    await c.get(`/auth/google/callback?code=a&state=${state}`).expect(302);
    const again = await c.get(`/auth/google/callback?code=a&state=${state}`);
    expect(again.headers.location).toBe('/entrar?erro=google_sessao_expirada');
  });

  it('cancelamento e falhas de validação voltam ao login com o motivo, sem criar sessão', async () => {
    const c = new Client(app);
    let state = await start(c);
    const cancel = await c.get(`/auth/google/callback?error=access_denied&state=${state}`);
    expect(cancel.headers.location).toBe('/entrar?erro=google_cancelado');

    exchange.mockRejectedValueOnce(new GoogleAuthError('email_nao_verificado'));
    state = await start(c);
    const unverified = await c.get(`/auth/google/callback?code=x&state=${state}`);
    expect(unverified.headers.location).toBe('/entrar?erro=google_email_nao_verificado');
    await c.get('/auth/me').expect(401);
  });

  it('não permite redirecionar para outro site depois do login', async () => {
    const c = new Client(app);
    exchange.mockResolvedValueOnce({ sub: 'g-4', email: uniqueEmail('redir'), name: 'Redir' });
    const state = await start(c, '//evil.com');
    const cb = await c.get(`/auth/google/callback?code=x&state=${state}`);
    expect(cb.headers.location).toBe('/painel');
  });
});
