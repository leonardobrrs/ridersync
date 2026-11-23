import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { bootApp, Client, createPublicMusician, createVenue, inDays, lastMailTo, registerContractor, registerUser, TEST_PASSWORD, validCpf } from './helpers';

describe('Notificações e LGPD (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  beforeAll(async () => {
    app = await bootApp();
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('central de notificações', () => {
    it('convite gera notificação interna + e-mail; contador, leitura e isolamento entre usuários', async () => {
      const owner = await registerUser(app, 'Nina Dona');
      const guest = await registerUser(app, 'Gael Convidado');
      const intruder = await registerUser(app, 'Ivo Intruso');
      const band = await owner.post('/bands', { name: 'Banda Notifica' });
      await owner.post(`/bands/${band.body.bandId}/invitations`, { email: guest.user!.email }).expect(201);

      expect((await guest.get('/me/notifications/unread-count')).body.unread).toBe(1);
      const list = await guest.get('/me/notifications');
      const n = list.body.items[0];
      expect(n).toMatchObject({ type: 'BAND_INVITE', category: 'INVITATIONS', link: '/painel/convites', readAt: null });
      expect(lastMailTo(guest.user!.email)?.subject).toMatch(/Convite para a banda/);
      const outbox = await prisma.emailOutbox.findFirstOrThrow({ where: { toEmail: guest.user!.email } });
      expect(outbox.status).toBe('SKIPPED'); // driver de desenvolvimento: registra que NÃO enviou
      expect(outbox.html).toContain('descadastrar');

      await intruder.post(`/me/notifications/${n.id}/read`).expect(404);
      expect((await guest.post(`/me/notifications/${n.id}/read`)).body.unread).toBe(0);
      expect((await guest.get('/me/notifications?unread=true')).body.items).toHaveLength(0);
    });

    it('a mesma ocorrência (dedupeKey) nunca gera notificação ou e-mail duplicado', async () => {
      const u = await registerUser(app, 'Duda Dedupe');
      const svc = app.get(NotificationsService);
      const input = { category: 'EVENTS' as const, type: 'TESTE', title: 'Teste', dedupeKey: 'teste:unico' };
      await prisma.$transaction((tx) => svc.notify(tx, [u.user!.id, u.user!.id], input));
      await prisma.$transaction((tx) => svc.notify(tx, [u.user!.id], input));
      expect(await prisma.notification.count({ where: { userId: u.user!.id, dedupeKey: 'teste:unico' } })).toBe(1);
      expect(await prisma.emailOutbox.count({ where: { toEmail: u.user!.email, subject: 'RiderSync: Teste' } })).toBe(1);
    });

    it('desativar e-mails mantém notificações internas; avisos de segurança continuam por e-mail', async () => {
      const u = await registerUser(app, 'Pedro Prefs');
      const svc = app.get(NotificationsService);
      const prefs = await u.put('/me/notification-preferences', { emailEnabled: false });
      expect(prefs.body.emailEnabled).toBe(false);
      await prisma.$transaction((tx) => svc.notify(tx, [u.user!.id], { category: 'BOOKINGS', type: 'X', title: 'Comum', dedupeKey: 'comum' }));
      await prisma.$transaction((tx) => svc.notify(tx, [u.user!.id], { category: 'ACCOUNT', type: 'Y', title: 'Segurança', dedupeKey: 'seg' }));
      expect(await prisma.notification.count({ where: { userId: u.user!.id } })).toBe(2);
      const emails = await prisma.emailOutbox.findMany({ where: { toEmail: u.user!.email }, select: { subject: true, html: true } });
      expect(emails.map((e) => e.subject)).toEqual(['RiderSync: Segurança']);
      expect(emails[0].html).not.toContain('descadastrar');
    });

    it('descadastro com um clique exige assinatura válida', async () => {
      const u = await registerUser(app, 'Ulisses Unsub');
      const svc = app.get(NotificationsService);
      await new Client(app).post('/notifications/unsubscribe', { u: u.user!.id, t: 'assinatura-invalida-123' }).expect(400);
      await new Client(app).post('/notifications/unsubscribe', { u: u.user!.id, t: svc.unsubscribeSignature(u.user!.id) }).expect(200);
      expect((await u.get('/me/notification-preferences')).body.emailEnabled).toBe(false);
    });

    it('marcar todas como lidas', async () => {
      const u = await registerUser(app, 'Tom Todas');
      const svc = app.get(NotificationsService);
      for (const k of ['a', 'b', 'c']) await prisma.$transaction((tx) => svc.notify(tx, [u.user!.id], { category: 'EVENTS', type: 'X', title: k, dedupeKey: k }));
      expect((await u.get('/me/notifications/unread-count')).body.unread).toBe(3);
      expect((await u.post('/me/notifications/read-all')).body.unread).toBe(0);
    });
  });

  describe('direitos do titular (LGPD)', () => {
    it('exportação traz os dados da conta e nunca o hash da senha', async () => {
      const c = await registerUser(app, 'Ester Exporta');
      await createPublicMusician(c, 'Ester Som');
      const res = await c.get('/account/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.body.account.email).toBe(c.user!.email);
      expect(res.body.account.musicianProfile.artist.name).toBe('Ester Som');
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2|tokenHash/);
    });

    it('exclusão exige senha e confirmação; bloqueia dono único de banda com integrantes', async () => {
      const owner = await registerUser(app, 'Otto Exclui');
      const member = await registerUser(app, 'Mia Fica');
      const band = await owner.post('/bands', { name: 'Banda Herança' });
      const inv = await owner.post(`/bands/${band.body.bandId}/invitations`, { email: member.user!.email });
      await member.post(`/me/invitations/band/${inv.body.id}/accept`).expect(201);
      await owner.post('/account/delete', { password: TEST_PASSWORD, confirmation: 'excluir' }).expect(400);
      await owner.post('/account/delete', { password: 'Errada@1', confirmation: 'EXCLUIR' }).expect(401);
      const blocked = await owner.post('/account/delete', { password: TEST_PASSWORD, confirmation: 'EXCLUIR' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('TRANSFER_OWNERSHIP_FIRST');
    });

    it('anonimiza a conta, apaga perfis sem histórico e preserva negociações da contraparte', async () => {
      const artist = await registerUser(app, 'Zeca Sai');
      const venueUser = await registerContractor(app, 'Vania Fica');
      const profile = await createPublicMusician(artist, 'Zeca Som');
      const venue = await createVenue(venueUser, 'Casa Permanece');
      const booking = await venueUser.post('/bookings', {
        organizationId: venue.id,
        artistId: profile.id,
        offer: { performanceAt: inDays(20), durationMinutes: 60, feeCents: 50000 },
      });
      expect(booking.status).toBe(201);
      const email = artist.user!.email;

      await artist.post('/account/delete', { password: TEST_PASSWORD, confirmation: 'EXCLUIR' }).expect(204);
      await artist.get('/auth/me').expect(401);
      await new Client(app).post('/auth/login', { email, password: TEST_PASSWORD }).expect(401);
      await new Client(app).get(`/public/artists/${profile.slug}`).expect(404);

      const user = await prisma.user.findFirstOrThrow({ where: { id: artist.user!.id } });
      expect(user).toMatchObject({ name: 'Usuário removido', passwordHash: null, googleSub: null });
      expect(user.email).not.toBe(email);
      expect(user.anonymizedAt).not.toBeNull();
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

      // a contraparte mantém o registro, encerrado e auditado, e é avisada
      const detail = await venueUser.get(`/bookings/${booking.body.id}`);
      expect(detail.body.status).toBe('CANCELLED');
      expect(detail.body.artist.name).toBe('Artista removido');
      const notes = await venueUser.get('/me/notifications');
      expect(notes.body.items.map((n: { type: string }) => n.type)).toContain('BOOKING_CANCELLED');

      // o e-mail fica livre para um novo cadastro
      await new Client(app)
        .post('/auth/register', { accountType: 'ARTIST', name: 'Novo', cpf: validCpf(), email, password: TEST_PASSWORD, passwordConfirmation: TEST_PASSWORD, acceptTerms: true })
        .expect(201);
    });

    it('conta sem histórico: perfil e banda são apagados de fato', async () => {
      const c = await registerUser(app, 'Lu Limpa');
      const p = await createPublicMusician(c, 'Lu Som');
      const band = await c.post('/bands', { name: 'Banda Solo Lu' });
      await c.post('/account/delete', { password: TEST_PASSWORD, confirmation: 'EXCLUIR' }).expect(204);
      expect(await prisma.artist.count({ where: { id: { in: [p.id, band.body.artist.id] } } })).toBe(0);
    });
  });
});
