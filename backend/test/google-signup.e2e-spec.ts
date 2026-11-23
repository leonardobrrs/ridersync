import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Google habilitado só neste arquivo (o loadEnv lê o ambiente uma vez por arquivo de teste).
process.env.GOOGLE_CLIENT_ID = 'cliente-teste.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'segredo-de-teste';

/* eslint-disable @typescript-eslint/no-require-imports */
const { bootApp, Client, uniqueEmail } = require('./helpers') as typeof import('./helpers');
/* eslint-enable @typescript-eslint/no-require-imports */

/** Cadastro com Google sem escolha prévia (o botão aparece desde o primeiro carregamento). */
describe('Cadastro com Google sem escolha prévia de perfil (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const realFetch = globalThis.fetch;
  let fetchSpy: jest.SpyInstance;

  /** Simula apenas o token endpoint do Google; o restante (Supertest) usa a rede local normalmente. */
  function googleWillReturn(email: string, sub: string) {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const idToken = [
      b64({ alg: 'RS256' }),
      b64({ iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 600, sub, email, email_verified: true, name: 'Pessoa Google' }),
      'assinatura',
    ].join('.');
    fetchSpy.mockImplementation((url: string | URL | Request, init?: RequestInit) =>
      String(url).startsWith('https://oauth2.googleapis.com/token')
        ? Promise.resolve(new Response(JSON.stringify({ id_token: idToken }), { status: 200 }))
        : realFetch(url, init),
    );
  }

  async function signup(query: string) {
    const c = new Client(app);
    const start = await c.get(`/auth/google/start?${query}`);
    expect(start.status).toBe(302);
    const state = new URL(start.headers.location).searchParams.get('state')!;
    const cb = await c.get(`/auth/google/callback?code=codigo&state=${encodeURIComponent(state)}`);
    expect(cb.status).toBe(302);
    return { c, location: cb.headers.location as string };
  }

  beforeAll(async () => {
    app = await bootApp();
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });
  afterAll(async () => {
    fetchSpy.mockRestore();
    await prisma.$disconnect();
    await app.close();
  });

  it('inicia o cadastro com Google sem tipo de conta nem aceite (antes: SIGNUP_INCOMPLETE)', async () => {
    const res = await new Client(app).get('/auth/google/start?intent=signup');
    expect(res.status).toBe(302);
    expect(new URL(res.headers.location).hostname).toBe('accounts.google.com');
  });

  it('cria a conta e deixa tipo de conta e termos como pendências do primeiro acesso', async () => {
    const email = uniqueEmail('google-livre');
    googleWillReturn(email, `sub-${email}`);
    const { c, location } = await signup('intent=signup');
    expect(location).toBe('/painel');
    const me = await c.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email, accountType: null, needsTermsAcceptance: true, needsCpf: true, googleLinked: true, emailVerified: true });
    // CPF é obrigatório no cadastro: quem entra pelo Google informa no primeiro acesso.
    expect((await c.post('/account/cpf', { cpf: '111.111.111-11' })).status).toBe(400);
    const withCpf = await c.post('/account/cpf', { cpf: '529.982.247-25' });
    expect(withCpf.status).toBe(201);
    expect(withCpf.body.user.needsCpf).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).cpf).toBe('52998224725');
    // e não pode ser removido depois (só corrigido)
    expect((await c.put('/account/legal-profile', { legalName: 'Pessoa Google', cpf: '' })).body.code).toBe('CPF_REQUIRED');
    // Pendências resolvidas pelo fluxo existente (AccountGate).
    await c.post('/account/account-type', { accountType: 'ARTIST' }).expect(201);
    const { privacyPolicyVersion } = (await c.get('/auth/config')).body;
    await c.post('/account/accept-terms', { version: privacyPolicyVersion }).expect(201);
    const after = await c.get('/auth/me');
    expect(after.body.user).toMatchObject({ accountType: 'ARTIST', needsTermsAcceptance: false });
  });

  it('com o tipo escolhido no modal, a conta já nasce com tipo e aceite dos termos', async () => {
    const email = uniqueEmail('google-modal');
    googleWillReturn(email, `sub-${email}`);
    const { c } = await signup('intent=signup&accountType=CONTRACTOR&acceptTerms=1');
    const me = await c.get('/auth/me');
    expect(me.body.user).toMatchObject({ accountType: 'CONTRACTOR', needsTermsAcceptance: false });
  });

  it('login com Google sem conta continua levando ao cadastro (não cria conta sem intenção)', async () => {
    const email = uniqueEmail('google-login');
    googleWillReturn(email, `sub-${email}`);
    const { location } = await signup('intent=login');
    expect(location).toBe('/cadastro?google=sem-conta');
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });
});
