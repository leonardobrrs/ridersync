import sharp from 'sharp';
import { INestApplication } from '@nestjs/common';
import { bootApp, Client, createPublicMusician, registerUser } from './helpers';

describe('Perfil individual e portfólio (integração)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await bootApp();
  });
  afterAll(async () => {
    await app.close();
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

    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#ffc83a' } }).png().toBuffer();
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
    expect(media.headers['content-type']).toBe('image/webp'); // reencodada no upload (sem metadados)
    const thumb = await new Client(app).get(up.body.thumbnailUrl.replace('/api', ''));
    expect(thumb.status).toBe(200);
    expect(thumb.headers['content-type']).toBe('image/webp');

    const pub = await new Client(app).get(`/public/artists/${artist.slug}`);
    expect(pub.body.portfolio).toHaveLength(2);
    await c.delete(`/artists/${artist.id}/portfolio/${up.body.id}`).expect(204);
    await new Client(app).get(up.body.url.replace('/api', '')).expect(404);
  });
});
