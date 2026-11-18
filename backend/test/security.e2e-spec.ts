import { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';
import { bootApp, Client, createPublicMusician, createVenue, inDays, registerContractor, registerUser, TEST_PASSWORD } from './helpers';

describe('Segurança: IDOR, permissões, CSRF/CORS, arquivos (integração)', () => {
  let app: INestApplication;
  let venueA: Client;
  let venueB: Client;
  let artist: Client;
  let outsider: Client;
  let orgA: { id: string; slug: string };
  let orgB: { id: string; slug: string };
  let art: { id: string; slug: string };
  let bookingId: string;
  let eventId: string;

  beforeAll(async () => {
    app = await bootApp();
    venueA = await registerContractor(app, 'Ana Casa A');
    venueB = await registerContractor(app, 'Beto Casa B');
    artist = await registerUser(app, 'Caio Artista');
    outsider = await registerUser(app, 'Duda Fora');
    orgA = await createVenue(venueA, 'Casa A');
    orgB = await createVenue(venueB, 'Casa B');
    art = await createPublicMusician(artist, 'Caio Som');
    const b = await venueA.post('/bookings', { organizationId: orgA.id, artistId: art.id, offer: { performanceAt: inDays(20), durationMinutes: 60, feeCents: 1000 } });
    bookingId = b.body.id;
    const e = await venueA.post(`/organizations/${orgA.id}/events`, { title: 'Evento A', startsAt: inDays(30), applicationDeadline: inDays(10), slots: 2 });
    eventId = e.body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('isolamento entre usuários e organizações (IDOR)', () => {
    it('negociação de terceiros responde 404 (não revela existência)', async () => {
      await outsider.get(`/bookings/${bookingId}`).expect(404);
      await venueB.get(`/bookings/${bookingId}`).expect(404);
      await venueB.post(`/bookings/${bookingId}/messages`, { body: 'oi' }).expect(404);
      await venueB.post(`/bookings/${bookingId}/confirm`).expect(404);
    });

    it('casa B não gerencia evento, inventário nem dados da casa A', async () => {
      await venueB.get(`/events/${eventId}/manage`).expect(403);
      await venueB.patch(`/events/${eventId}`, { title: 'Hackeado' }).expect(403);
      await venueB.post(`/events/${eventId}/transition`, { action: 'cancel' }).expect(403);
      await venueB.put(`/organizations/${orgA.id}/equipment`, { items: [] }).expect(403);
      await venueB.get(`/organizations/${orgA.id}/manage`).expect(403);
      await venueB.post(`/organizations/${orgA.id}/events`, { title: 'Intruso', startsAt: inDays(30), applicationDeadline: inDays(10), slots: 1 }).expect(403);
      // propor em nome de outra organização
      await venueB.post('/bookings', { organizationId: orgA.id, artistId: art.id, offer: { performanceAt: inDays(20), durationMinutes: 60, feeCents: 1 } }).expect(403);
    });

    it('rascunho não é público e IDs malformados são rejeitados', async () => {
      await new Client(app).get(`/public/events/${eventId}`).expect(404);
      await outsider.get('/bookings/nao-e-uuid').expect(400);
      await outsider.get('/events/1/manage').expect(400);
    });

    it('perfil artístico de terceiro não é editável nem visível no painel', async () => {
      await outsider.patch(`/artists/${art.id}`, { name: 'Trocado' }).expect(403);
      await outsider.get(`/artists/${art.id}/manage`).expect(403);
      await outsider.put(`/artists/${art.id}/rider`, { notes: '', items: [] }).expect(403);
      await venueA.put(`/artists/${art.id}/visibility`, { visibility: 'PRIVATE' }).expect(403);
    });

    it('rider: exigências do local não entram no rider do artista', async () => {
      const res = await artist.put(`/artists/${art.id}/rider`, { notes: '', items: [{ catalogItemId: 'energia', quantity: 1 }] });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VENUE_ONLY_ITEM');
      const catalog = await new Client(app).get('/catalog/equipment');
      expect(catalog.body.find((i: { id: string }) => i.id === 'palco').artistRequirement).toBe(false);
    });

    it('comparação de rider: casa só compara artista com quem negocia', async () => {
      await venueA.get(`/artists/${art.id}/compatibility/${orgA.id}`).expect(200);
      await venueB.get(`/artists/${art.id}/compatibility/${orgB.id}`).expect(403);
      await artist.get(`/artists/${art.id}/compatibility/${orgB.id}`).expect(200);
    });
  });

  describe('permissões de membros de banda', () => {
    it('MEMBER não convida, não muda papéis nem transfere; muda apenas a própria função', async () => {
      const owner = await registerUser(app, 'Olivia Dona');
      const member = await registerUser(app, 'Mateus Membro');
      const band = await owner.post('/bands', { name: 'Banda Segura' });
      const bandId = band.body.bandId;
      const inv = await owner.post(`/bands/${bandId}/invitations`, { email: member.user!.email, instrument: 'Bateria' });
      await member.post(`/me/invitations/band/${inv.body.id}/accept`).expect(201);
      const detail = await owner.get(`/bands/${bandId}`);
      const ownerRow = detail.body.members.find((m: { role: string }) => m.role === 'OWNER');
      const memberRow = detail.body.members.find((m: { role: string }) => m.role === 'MEMBER');
      expect(memberRow.instrument).toBe('Bateria');
      await member.post(`/bands/${bandId}/invitations`, { email: outsider.user!.email }).expect(403);
      await member.patch(`/bands/${bandId}/members/${ownerRow.id}`, { role: 'MEMBER' }).expect(403);
      await member.post(`/bands/${bandId}/transfer-ownership`, { memberId: memberRow.id, password: TEST_PASSWORD }).expect(403);
      await member.patch(`/bands/${bandId}/members/${ownerRow.id}/position`, { instrument: 'Vocal' }).expect(403);
      expect((await member.patch(`/bands/${bandId}/members/${memberRow.id}/position`, { instrument: 'Percussão' })).status).toBe(200);
      await member.patch(`/bands/${bandId}/members/${memberRow.id}/position`, { instrument: 'Função inventada' }).expect(400);
      // convite para conta de contratante é recusado
      const res = await owner.post(`/bands/${bandId}/invitations`, { email: venueA.user!.email });
      expect(res.body.code).toBe('WRONG_ACCOUNT_TYPE');
    });
  });

  describe('CSRF e CORS', () => {
    it('escrita sem cabeçalho anti-CSRF ou com origem estranha é recusada', async () => {
      const res = await artist.agent.post('/api/me/notifications/read-all').send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF');
      const evil = await artist.agent.post('/api/me/notifications/read-all').set('X-Requested-With', 'RiderSync').set('Origin', 'https://evil.example').send({});
      expect(evil.status).toBe(403);
    });

    it('preflight CORS só libera origens permitidas', async () => {
      const server = app.getHttpServer();
      const ok = await request(server).options('/api/auth/login').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST');
      expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(ok.headers['access-control-allow-credentials']).toBe('true');
      const bad = await request(server).options('/api/auth/login').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
      expect(bad.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('cabeçalhos de segurança e erros sem detalhes internos', async () => {
      const res = await new Client(app).get('/public/artists/nao-existe');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(Object.keys(res.body).sort()).toEqual(['code', 'message', 'statusCode']);
    });
  });

  describe('arquivos', () => {
    const upload = (c: Client, url: string, buf: Buffer, name: string, type: string) =>
      c.agent.put(`/api${url}`).set('X-Requested-With', 'RiderSync').attach('file', buf, { filename: name, contentType: type });

    it('recusa HTML/SVG/script disfarçado de imagem e PDF em campo de foto', async () => {
      for (const [buf, name] of [
        [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.png'],
        [Buffer.from('<html><script>alert(1)</script></html>'), 'x.jpg'],
        [Buffer.from('%PDF-1.7 fake'), 'foto.png'],
      ] as [Buffer, string][]) {
        const res = await upload(artist, `/artists/${art.id}/photo`, buf, name, 'image/png');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('FILE_TYPE');
      }
    });

    it('PNG com cabeçalho válido mas corrompido é recusado', async () => {
      const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
      const res = await upload(artist, `/artists/${art.id}/photo`, broken, 'x.png', 'image/png');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FILE_INVALID');
    });

    it('foto do perfil vira WebP e é a foto da pessoa no app; não existe mais foto de conta separada', async () => {
      const jpg = await sharp({ create: { width: 900, height: 900, channels: 3, background: '#123456' } }).jpeg().toBuffer();
      expect((await upload(artist, '/account/avatar', jpg, 'eu.jpg', 'image/jpeg')).status).toBe(404);
      const res = await upload(artist, `/artists/${art.id}/photo`, jpg, 'eu.jpg', 'image/jpeg');
      expect(res.status).toBe(200);
      const me = await artist.get('/auth/me');
      expect(me.body.user.profilePhotoUrl).toMatch(/^\/api\/media\/[0-9a-f-]+\?v=thumb$/);
      expect(me.body.user).not.toHaveProperty('avatarUrl');
      const seen = await artist.get(me.body.user.profilePhotoUrl.replace('/api', ''));
      expect(seen.status).toBe(200);
      expect(seen.headers['content-type']).toBe('image/webp');
    });
  });

  it('rota de manutenção não existe sem o segredo do cron', async () => {
    await new Client(app).get('/internal/maintenance').expect(404);
    await request(app.getHttpServer()).get('/api/internal/maintenance').set('Authorization', 'Bearer errado').expect(404);
  });
});
