import { ADMIN_TEST_PASSWORD, ADMIN_TEST_USER } from './admin-env';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { bootApp, Client, createPublicMusician, createVenue, inDays, PUBLISHABLE_PROFILE, registerContractor, registerUser } from './helpers';

/** Painel de administração: login próprio (fora das contas de usuário) e exclusões definitivas para limpar testes. */
describe('painel de administração', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adm: Client;

  beforeAll(async () => {
    app = await bootApp();
    prisma = app.get(PrismaService);
    adm = new Client(app);
  });
  afterAll(() => app.close());

  it('exige login próprio: sem sessão 401, senha errada 401, conta de usuário não serve', async () => {
    await new Client(app).get('/admin/overview').expect(401);
    await adm.post('/admin/login', { username: ADMIN_TEST_USER, password: 'errada' }).expect(401);
    await adm.post('/admin/login', { username: 'outro', password: ADMIN_TEST_PASSWORD }).expect(401);
    // sem o cabeçalho anti-CSRF
    await adm.agent.post('/api/admin/login').send({ username: ADMIN_TEST_USER, password: ADMIN_TEST_PASSWORD }).expect(403);
    const user = await registerUser(app, 'Usuária Comum');
    await user.get('/admin/overview').expect(401);
    await user.get('/admin/users').expect(401);

    const res = await adm.post('/admin/login', { username: ADMIN_TEST_USER, password: ADMIN_TEST_PASSWORD }).expect(204);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/rs_admin=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/admin/);
    const ov = await adm.get('/admin/overview').expect(200);
    expect(ov.body.users).toBeGreaterThan(0);
    await adm.get('/admin/session').expect(200);
  });

  it('exclui evento (com candidaturas e negociações), negociação, banda e casa', async () => {
    const owner = await registerContractor(app, 'Dona da Casa');
    const venue = await createVenue(owner, 'Casa Para Apagar');
    const artistUser = await registerUser(app, 'Artista Candidata');
    const artist = await createPublicMusician(artistUser, 'Artista Para Apagar');

    const ev = await owner.post(`/organizations/${venue.id}/events`, {
      title: 'Evento Para Apagar',
      startsAt: inDays(20),
      applicationDeadline: inDays(10),
      slots: 1,
      genres: ['MPB'],
      paymentType: 'Cachê fixo',
      feeCents: 80000,
    });
    await owner.post(`/events/${ev.body.id}/transition`, { action: 'publish' }).expect(201);
    const appl = await artistUser.post(`/events/${ev.body.id}/applications`, { artistId: artist.id, message: 'oi' });
    expect(appl.status).toBe(201);
    const direct = await owner.post('/bookings', { organizationId: venue.id, artistId: artist.id, eventId: ev.body.id, offer: { performanceAt: inDays(20), durationMinutes: 60, feeCents: 80000 } });
    expect(direct.status).toBe(201);

    // listagem com busca
    const found = await adm.get('/admin/events?q=Para Apagar').expect(200);
    expect(found.body.map((e: { id: string }) => e.id)).toContain(ev.body.id);

    await adm.delete(`/admin/events/${ev.body.id}`).expect(200);
    expect(await prisma.event.count({ where: { id: ev.body.id } })).toBe(0);
    expect(await prisma.eventApplication.count({ where: { eventId: ev.body.id } })).toBe(0);
    expect(await prisma.booking.count({ where: { id: direct.body.id } })).toBe(0);
    await adm.delete(`/admin/events/${ev.body.id}`).expect(404);

    // negociação avulsa
    const b2 = await owner.post('/bookings', { organizationId: venue.id, artistId: artist.id, offer: { performanceAt: inDays(25), durationMinutes: 60, feeCents: 50000 } });
    await adm.delete(`/admin/bookings/${b2.body.id}`).expect(200);
    expect(await prisma.booking.count({ where: { id: b2.body.id } })).toBe(0);

    // perfil de artista (a conta continua)
    await adm.delete(`/admin/artists/${artist.id}`).expect(200);
    expect(await prisma.artist.count({ where: { id: artist.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: artistUser.user!.id } })).toBe(1);

    // casa
    await adm.delete(`/admin/organizations/${venue.id}`).expect(200);
    expect(await prisma.organization.count({ where: { id: venue.id } })).toBe(0);
    await adm.delete('/admin/organizations/not-a-uuid').expect(400);
  });

  it('exclui conta: grupo só dela sai junto; com outros integrantes, a propriedade passa adiante', async () => {
    const owner = await registerUser(app, 'Dono da Banda');
    const member = await registerUser(app, 'Integrante Fica');
    const shared = await owner.post('/bands', { name: 'Banda Compartilhada', ...PUBLISHABLE_PROFILE });
    const inv = await owner.post(`/bands/${shared.body.bandId}/invitations`, { email: member.user!.email, role: 'MEMBER' });
    await member.post(`/me/invitations/band/${inv.body.id}/accept`).expect(201);
    const solo = await owner.post('/bands', { name: 'Banda Só Dele', ...PUBLISHABLE_PROFILE });
    const contractor = await registerContractor(app, 'Contratante Sozinha');
    const ownVenue = await createVenue(contractor, 'Casa Só Dela');

    const list = await adm.get('/admin/users?q=Dono da Banda').expect(200);
    expect(list.body[0].bands.length).toBe(2);

    await adm.delete(`/admin/users/${owner.user!.id}`).expect(200);
    expect(await prisma.user.count({ where: { id: owner.user!.id } })).toBe(0);
    expect(await prisma.band.count({ where: { id: solo.body.bandId } })).toBe(0);
    const heir = await prisma.bandMember.findFirst({ where: { bandId: shared.body.bandId, userId: member.user!.id } });
    expect(heir?.role).toBe('OWNER');
    // quem ficou continua administrando a banda
    await member.get(`/bands/${shared.body.bandId}`).expect(200);

    await adm.delete(`/admin/users/${contractor.user!.id}`).expect(200);
    expect(await prisma.organization.count({ where: { id: ownVenue.id } })).toBe(0);
    await adm.delete(`/admin/users/${contractor.user!.id}`).expect(404);
  });

  it('logout encerra a sessão do painel', async () => {
    await adm.post('/admin/logout').expect(204);
    await adm.get('/admin/overview').expect(401);
  });
});
