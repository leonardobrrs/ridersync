import { INestApplication } from '@nestjs/common';
import { bootApp, Client, createPublicMusician, registerUser, uniqueEmail } from './helpers';

describe('Auth, conta e perfil individual (integração)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await bootApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('cadastro cria sessão por cookie HttpOnly e /auth/me retorna a conta sem hash', async () => {
    const c = new Client(app);
    const email = uniqueEmail('ana');
    const res = await c.post('/auth/register', { name: 'Ana Teste', email, password: 'senha-segura-123' });
    expect(res.status).toBe(201);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/rs_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const me = await c.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|scrypt/);
  });

  it('rejeita e-mail duplicado, senha curta e credenciais inválidas', async () => {
    const c = await registerUser(app, 'Bruno Dup');
    const dup = await new Client(app).post('/auth/register', { name: 'Outro', email: c.user!.email, password: 'senha-segura-123' });
    expect(dup.status).toBe(409);
    const short = await new Client(app).post('/auth/register', { name: 'Curto', email: uniqueEmail('x'), password: '123' });
    expect(short.status).toBe(400);
    expect(short.body.code).toBe('VALIDATION_ERROR');
    const bad = await new Client(app).post('/auth/login', { email: c.user!.email, password: 'errada-0000' });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('/auth/session retorna null para visitante e a conta para usuário logado', async () => {
    const visitor = await new Client(app).get('/auth/session');
    expect(visitor.status).toBe(200);
    expect(visitor.body).toEqual({});
    const c = await registerUser(app, 'Sofia Sessao');
    const res = await c.get('/auth/session');
    expect(res.body.user.email).toBe(c.user!.email);
  });

  it('login, logout e acesso não autenticado', async () => {
    const c = await registerUser(app, 'Carla Login');
    await c.post('/auth/logout').expect(204);
    await c.get('/auth/me').expect(401);
    const login = await c.post('/auth/login', { email: c.user!.email, password: 'senha-segura-123' });
    expect(login.status).toBe(200);
    await c.get('/auth/me').expect(200);
  });

  it('bloqueia requisição de escrita sem cabeçalho anti-CSRF', async () => {
    const c = await registerUser(app, 'Davi Csrf');
    const res = await c.agent.post('/api/me/musician-profile').send({ name: 'Sem header' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF');
  });

  it('troca de senha exige senha atual e revoga outras sessões', async () => {
    const c = await registerUser(app, 'Elis Senha');
    const other = new Client(app);
    await other.post('/auth/login', { email: c.user!.email, password: 'senha-segura-123' }).expect(200);
    await c.post('/account/password', { currentPassword: 'errada', newPassword: 'nova-senha-456' }).expect(401);
    await c.post('/account/password', { currentPassword: 'senha-segura-123', newPassword: 'nova-senha-456' }).expect(204);
    await c.get('/auth/me').expect(200);
    await other.get('/auth/me').expect(401);
    await new Client(app).post('/auth/login', { email: c.user!.email, password: 'nova-senha-456' }).expect(200);
  });

  it('perfil individual: privado por padrão, requisitos de publicação, visibilidade pública aplicada no backend', async () => {
    const c = await registerUser(app, 'Fabi Perfil');
    const created = await c.post('/me/musician-profile', { name: 'Fabi Lins' });
    expect(created.status).toBe(201);
    expect(created.body.visibility).toBe('PRIVATE');
    const artistId = created.body.id;

    // privado: não aparece no marketplace nem na página pública
    const visitor = new Client(app);
    await visitor.get(`/public/artists/${created.body.slug}`).expect(404);

    const notReady = await c.put(`/artists/${artistId}/visibility`, { visibility: 'PUBLIC' });
    expect(notReady.status).toBe(422);
    expect(notReady.body.code).toBe('PUBLICATION_REQUIREMENTS');

    await c
      .patch(`/artists/${artistId}`, {
        city: 'Maceió',
        genres: ['MPB'],
        bio: 'Cantora maceioense com repertório de MPB e forró pé-de-serra.',
        contactEmail: 'contato@fabi.exemplo',
        instagram: '@fabi.lins',
      })
      .expect(200);
    await c.put(`/artists/${artistId}/visibility`, { visibility: 'PUBLIC' }).expect(200);

    const pub = await visitor.get(`/public/artists/${created.body.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.contacts.instagram).toBe('fabi.lins');
    // nunca expõe e-mail da conta, hash ou dados internos
    const raw = JSON.stringify(pub.body);
    expect(raw).not.toContain(c.user!.email);
    expect(raw).not.toMatch(/passwordHash|userId|musicianProfileId/);

    // perfil público não pode perder requisitos mínimos
    const broken = await c.patch(`/artists/${artistId}`, { genres: [] });
    expect(broken.status).toBe(422);
  });

  it('usuário não pode editar o perfil de outra pessoa; visitante não acessa dados privados', async () => {
    const owner = await registerUser(app, 'Gil Dono');
    const artist = await createPublicMusician(owner, 'Gil Músico');
    const intruder = await registerUser(app, 'Ivo Intruso');
    const res = await intruder.patch(`/artists/${artist.id}`, { name: 'Hackeado' });
    expect(res.status).toBe(403);
    await intruder.get(`/artists/${artist.id}/manage`).expect(403);
    await intruder.put(`/artists/${artist.id}/rider`, { notes: '', items: [] }).expect(403);
    await new Client(app).get(`/artists/${artist.id}/manage`).expect(401);
    await new Client(app).get('/me/dashboard').expect(401);
  });

  it('portfólio: links validados (https), upload de imagem validado por assinatura, remoção', async () => {
    const c = await registerUser(app, 'Hugo Portfolio');
    const artist = await createPublicMusician(c, 'Hugo Som');
    await c.post(`/artists/${artist.id}/portfolio`, { kind: 'VIDEO', title: 'Ao vivo', url: 'javascript:alert(1)' }).expect(400);
    const link = await c.post(`/artists/${artist.id}/portfolio`, { kind: 'VIDEO', title: 'Ao vivo', url: 'https://www.youtube.com/watch?v=x' });
    expect(link.status).toBe(201);

    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const up = await c.agent
      .post(`/api/artists/${artist.id}/portfolio/upload`)
      .set('X-Requested-With', 'RiderSync')
      .field('kind', 'PHOTO')
      .field('title', 'Foto de palco')
      .attach('file', png, { filename: 'palco.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.isUpload).toBe(true);

    const fake = await c.agent
      .post(`/api/artists/${artist.id}/portfolio/upload`)
      .set('X-Requested-With', 'RiderSync')
      .field('kind', 'PHOTO')
      .field('title', 'Falso')
      .attach('file', Buffer.from('<svg/>'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    expect(fake.body.code).toBe('FILE_TYPE');

    // perfil público → arquivo do portfólio visível ao visitante
    const media = await new Client(app).get(up.body.url.replace('/api', ''));
    expect(media.status).toBe(200);
    expect(media.headers['content-type']).toBe('image/png');

    const pub = await new Client(app).get(`/public/artists/${artist.slug}`);
    expect(pub.body.portfolio).toHaveLength(2);
    await c.delete(`/artists/${artist.id}/portfolio/${up.body.id}`).expect(204);
    await new Client(app).get(up.body.url.replace('/api', '')).expect(404);
  });
});
