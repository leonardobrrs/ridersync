import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';
import { bootApp, Client, lastMailTo, registerContractor, registerUser, TEST_PASSWORD, tokenFrom, uniqueEmail } from './helpers';

const NEW_PASSWORD = 'Nova@Senha456';
const body = (email: string, over: Record<string, unknown> = {}) => ({
  accountType: 'ARTIST',
  name: 'Pessoa Nova',
  email,
  password: TEST_PASSWORD,
  passwordConfirmation: TEST_PASSWORD,
  acceptTerms: true,
  ...over,
});

describe('Autenticação e conta (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  beforeAll(async () => {
    app = await bootApp();
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('cadastro', () => {
    it('exige tipo de conta, aceite dos termos, senha forte e confirmação idêntica', async () => {
      const c = new Client(app);
      const cases: [Record<string, unknown>, string][] = [
        [{ accountType: undefined }, 'accountType'],
        [{ accountType: 'VENUE' }, 'accountType'],
        [{ acceptTerms: false }, 'acceptTerms'],
        [{ password: 'fraca', passwordConfirmation: 'fraca' }, 'password'],
        [{ password: 'semespecial1A', passwordConfirmation: 'semespecial1A' }, 'password'],
        [{ passwordConfirmation: 'Diferente@123' }, 'passwordConfirmation'],
      ];
      for (const [over, path] of cases) {
        const res = await c.post('/auth/register', body(uniqueEmail('val'), over));
        expect(res.status).toBe(400);
        expect(res.body.details.map((d: { path: string }) => d.path)).toContain(path);
      }
    });

    it('cria sessão (cookie HttpOnly/SameSite), registra consentimento e envia e-mail de confirmação', async () => {
      const c = new Client(app);
      const email = uniqueEmail('cad');
      const res = await c.post('/auth/register', body(email, { accountType: 'CONTRACTOR' }));
      expect(res.status).toBe(201);
      expect(res.body.verificationRequired).toBe(false);
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/rs_session=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      const me = await c.get('/auth/me');
      expect(me.body.user).toMatchObject({ email, accountType: 'CONTRACTOR', emailVerified: false, hasPassword: true, needsTermsAcceptance: false });
      expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|argon2|scrypt/);
      const row = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(row.termsAcceptedAt).not.toBeNull();
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);
      const mail = lastMailTo(email);
      expect(mail?.subject).toMatch(/Confirme seu e-mail/);
      expect(tokenFrom(mail)).toBeTruthy();
      // o token nunca é gravado em claro
      expect(JSON.stringify(await prisma.userToken.findMany({ where: { userId: row.id } }))).not.toContain(tokenFrom(mail)!);
    });

    it('rejeita e-mail duplicado', async () => {
      const c = await registerUser(app, 'Bruno Dup');
      const dup = await new Client(app).post('/auth/register', body(c.user!.email));
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('confirmação de e-mail', () => {
    it('confirma com token de uso único; token reutilizado ou inválido é recusado', async () => {
      const c = await registerUser(app, 'Vera Verifica');
      const token = tokenFrom(lastMailTo(c.user!.email))!;
      await new Client(app).post('/auth/email-verification/confirm', { token }).expect(200);
      expect((await c.get('/auth/me')).body.user.emailVerified).toBe(true);
      const again = await new Client(app).post('/auth/email-verification/confirm', { token });
      expect(again.status).toBe(422);
      expect(again.body.code).toBe('INVALID_TOKEN');
      await new Client(app).post('/auth/email-verification/confirm', { token: 'x'.repeat(43) }).expect(422);
    });

    it('reenvio invalida o link anterior; conta já confirmada não recebe novo e-mail', async () => {
      const c = await registerUser(app, 'Rui Reenvio');
      const first = tokenFrom(lastMailTo(c.user!.email))!;
      const res = await c.post('/auth/email-verification/resend');
      expect(res.body.alreadyVerified).toBe(false);
      const second = tokenFrom(lastMailTo(c.user!.email))!;
      expect(second).not.toBe(first);
      await new Client(app).post('/auth/email-verification/confirm', { token: first }).expect(422);
      await new Client(app).post('/auth/email-verification/confirm', { token: second }).expect(200);
      expect((await c.post('/auth/email-verification/resend')).body.alreadyVerified).toBe(true);
    });
  });

  describe('login', () => {
    it('credenciais inválidas e e-mail inexistente respondem igual', async () => {
      const c = await registerUser(app, 'Lia Login');
      const wrong = await new Client(app).post('/auth/login', { email: c.user!.email, password: 'Errada@123' });
      const ghost = await new Client(app).post('/auth/login', { email: uniqueEmail('ghost'), password: 'Errada@123' });
      expect(wrong.status).toBe(401);
      expect(ghost.status).toBe(401);
      expect(wrong.body).toEqual(ghost.body);
    });

    it('bloqueia a conta após tentativas abusivas, mesmo com a senha correta depois', async () => {
      const c = await registerUser(app, 'Bia Bloqueio');
      for (let i = 0; i < 5; i++) await new Client(app).post('/auth/login', { email: c.user!.email, password: 'Errada@123' }).expect(401);
      const locked = await new Client(app).post('/auth/login', { email: c.user!.email, password: TEST_PASSWORD });
      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe('ACCOUNT_LOCKED');
      await prisma.user.update({ where: { email: c.user!.email }, data: { lockedUntil: new Date(Date.now() - 1000) } });
      await new Client(app).post('/auth/login', { email: c.user!.email, password: TEST_PASSWORD }).expect(200);
    });

    it('migra hash scrypt legado para Argon2id no login, sem invalidar sessões', async () => {
      const email = uniqueEmail('legado');
      const salt = randomBytes(16);
      const legacy = ['scrypt', 16384, 8, 1, salt.toString('base64url'), scryptSync('senha-antiga-123', salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('base64url')].join('$');
      await prisma.user.create({ data: { email, name: 'Conta Legada', passwordHash: legacy } });
      const c = new Client(app);
      await c.post('/auth/login', { email, password: 'senha-antiga-123' }).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { email } })).passwordHash).toMatch(/^\$argon2id\$/);
      await c.get('/auth/me').expect(200);
      await new Client(app).post('/auth/login', { email, password: 'senha-antiga-123' }).expect(200);
    });

    it('logout encerra a sessão; /auth/session devolve null para visitante', async () => {
      const c = await registerUser(app, 'Carla Logout');
      await c.post('/auth/logout').expect(204);
      await c.get('/auth/me').expect(401);
      const visitor = await new Client(app).get('/auth/session');
      expect(visitor.status).toBe(200);
      expect(visitor.body).toEqual({});
    });
  });

  describe('recuperação de senha', () => {
    it('resposta idêntica para e-mail existente ou não; e-mail só vai para conta real', async () => {
      const ghost = uniqueEmail('ninguem');
      await new Client(app).post('/auth/password/forgot', { email: ghost }).expect(204);
      expect(lastMailTo(ghost)).toBeNull();
    });

    it('redefine com token de uso único, encerra todas as sessões e notifica', async () => {
      const c = await registerUser(app, 'Rita Reset');
      await new Client(app).post('/auth/password/forgot', { email: c.user!.email }).expect(204);
      const mail = lastMailTo(c.user!.email)!;
      expect(mail.subject).toMatch(/Redefinição/);
      const token = tokenFrom(mail)!;
      await new Client(app).post('/auth/password/reset', { token, password: NEW_PASSWORD, passwordConfirmation: 'Outra@123' }).expect(400);
      await new Client(app).post('/auth/password/reset', { token, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD }).expect(204);
      await c.get('/auth/me').expect(401);
      await new Client(app).post('/auth/password/reset', { token, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD }).expect(422);
      await new Client(app).post('/auth/login', { email: c.user!.email, password: TEST_PASSWORD }).expect(401);
      const fresh = new Client(app);
      await fresh.post('/auth/login', { email: c.user!.email, password: NEW_PASSWORD }).expect(200);
      const me = await fresh.get('/auth/me');
      expect(me.body.user.emailVerified).toBe(true);
      const notes = await fresh.get('/me/notifications');
      expect(notes.body.items.map((n: { type: string }) => n.type)).toContain('PASSWORD_CHANGED');
    });
  });

  describe('troca e definição de senha', () => {
    it('exige a senha atual, aplica a política e revoga as outras sessões', async () => {
      const c = await registerUser(app, 'Elis Senha');
      const other = new Client(app);
      await other.post('/auth/login', { email: c.user!.email, password: TEST_PASSWORD }).expect(200);
      await c.post('/account/password', { currentPassword: 'Errada@1', newPassword: NEW_PASSWORD, newPasswordConfirmation: NEW_PASSWORD }).expect(401);
      await c.post('/account/password', { currentPassword: TEST_PASSWORD, newPassword: 'fraca', newPasswordConfirmation: 'fraca' }).expect(400);
      await c.post('/account/password', { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, newPasswordConfirmation: NEW_PASSWORD }).expect(204);
      await c.get('/auth/me').expect(200);
      await other.get('/auth/me').expect(401);
    });

    it('conta criada só com Google define a primeira senha sem senha atual', async () => {
      const email = uniqueEmail('google');
      await prisma.user.create({ data: { email, name: 'Só Google', googleSub: `sub-${email}`, accountType: 'ARTIST', emailVerifiedAt: new Date() } });
      const c = new Client(app);
      await c.post('/auth/login', { email, password: 'Qualquer@1' }).expect(401);
      // sem senha não há login por senha; simula a sessão criada pelo callback do Google
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const { SessionService } = await import('../src/modules/auth/session.service');
      const sessions = app.get(SessionService);
      const cookies: string[] = [];
      await sessions.create(user.id, 'teste', { cookie: (_n: string, v: string) => cookies.push(v) } as never);
      c.agent.set('Cookie', `rs_session=${cookies[0]}`);
      expect((await c.get('/auth/me')).body.user.hasPassword).toBe(false);
      await c.post('/account/password', { newPassword: NEW_PASSWORD, newPasswordConfirmation: NEW_PASSWORD }).expect(204);
      await new Client(app).post('/auth/login', { email, password: NEW_PASSWORD }).expect(200);
    });
  });

  describe('tipo de conta', () => {
    it('contratante não cria perfil artístico nem banda; artista não cria casa', async () => {
      const contractor = await registerContractor(app, 'Caio Contratante');
      const artist = await registerUser(app, 'Ana Artista');
      expect((await contractor.post('/me/musician-profile', { name: 'Perfil X' })).body.code).toBe('WRONG_ACCOUNT_TYPE');
      expect((await contractor.post('/bands', { name: 'Banda Xis' })).body.code).toBe('WRONG_ACCOUNT_TYPE');
      expect((await artist.post('/organizations', { name: 'Casa X', city: 'Maceió' })).body.code).toBe('WRONG_ACCOUNT_TYPE');
    });

    it('conta legada sem tipo escolhe uma única vez', async () => {
      const email = uniqueEmail('semtipo');
      const { hashPassword } = await import('../src/modules/auth/password');
      await prisma.user.create({ data: { email, name: 'Sem Tipo', passwordHash: await hashPassword(TEST_PASSWORD) } });
      const c = new Client(app);
      await c.post('/auth/login', { email, password: TEST_PASSWORD }).expect(200);
      expect((await c.get('/auth/me')).body.user.accountType).toBeNull();
      expect((await c.post('/me/musician-profile', { name: 'Perfil X' })).body.code).toBe('ACCOUNT_TYPE_REQUIRED');
      expect((await c.post('/account/account-type', { accountType: 'ARTIST' })).body.user.accountType).toBe('ARTIST');
      await c.post('/account/account-type', { accountType: 'CONTRACTOR' }).expect(409);
    });

    it('termos desatualizados exigem novo aceite', async () => {
      const c = await registerUser(app, 'Tina Termos');
      await prisma.user.update({ where: { email: c.user!.email }, data: { termsVersion: '2020-01-01' } });
      expect((await c.get('/auth/me')).body.user.needsTermsAcceptance).toBe(true);
      await c.post('/account/accept-terms', { version: '2020-01-01' }).expect(400);
      const { PRIVACY_POLICY_VERSION } = await import('../src/modules/auth/auth.service');
      expect((await c.post('/account/accept-terms', { version: PRIVACY_POLICY_VERSION })).body.user.needsTermsAcceptance).toBe(false);
    });
  });

  describe('Google', () => {
    it('sem credenciais configuradas, o login com Google fica indisponível (sem simulação)', async () => {
      const cfg = await new Client(app).get('/auth/config');
      expect(cfg.body.googleLogin).toBe(false);
      // Navegação de página inteira: volta ao login com aviso, em vez de exibir erro JSON.
      const start = await new Client(app).get('/auth/google/start');
      expect(start.status).toBe(302);
      expect(start.headers.location).toBe('/entrar?erro=google-indisponivel');
      const cb = await new Client(app).get('/auth/google/callback?code=x&state=y');
      expect(cb.status).toBe(302);
      expect(cb.headers.location).toBe('/entrar?erro=google');
    });
  });
});
