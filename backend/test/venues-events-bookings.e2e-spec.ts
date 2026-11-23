import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootApp, Client, createPublicMusician, createVenue, inDays, registerUser } from './helpers';

describe('Casas, inventário, comparação, eventos, candidaturas e bookings (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let venueOwner: Client;
  let venueAdmin: Client;
  let artistUser: Client;
  let bandAdmin: Client;
  let stranger: Client;
  let venue: { id: string; slug: string };
  let artist: { id: string; slug: string };

  beforeAll(async () => {
    app = await bootApp();
    venueOwner = await registerUser(app, 'Vera Venue', 'CONTRACTOR');
    venueAdmin = await registerUser(app, 'Vitor Admin', 'CONTRACTOR');
    artistUser = await registerUser(app, 'Ana Artista');
    bandAdmin = await registerUser(app, 'Beto Banda');
    stranger = await registerUser(app, 'Sara Estranha');
    venue = await createVenue(venueOwner, 'Galpão Teste');
    artist = await createPublicMusician(artistUser, 'Ana Lins Teste');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('organização (VENUE) e responsáveis', () => {
    it('apenas responsáveis gerenciam a casa', async () => {
      await stranger.patch(`/organizations/${venue.id}`, { capacity: 10 }).expect(403);
      await stranger.get(`/organizations/${venue.id}/manage`).expect(403);
      await stranger.put(`/organizations/${venue.id}/equipment`, { items: [] }).expect(403);
      await venueOwner.patch(`/organizations/${venue.id}`, { description: 'Casa de shows no Jaraguá.' }).expect(200);
    });

    it('convite de ADMIN, aceite e proteção do último OWNER', async () => {
      const inv = await venueOwner.post(`/organizations/${venue.id}/invitations`, { email: venueAdmin.user!.email });
      expect(inv.status).toBe(201);
      await venueAdmin.get(`/organizations/${venue.id}/manage`).expect(403); // pendente ≠ ativo
      await venueAdmin.post(`/me/invitations/organization/${inv.body.id}/accept`).expect(201);
      const detail = await venueAdmin.get(`/organizations/${venue.id}/manage`);
      expect(detail.body.myRole).toBe('ADMIN');
      // ADMIN não altera papéis; OWNER único não sai
      const ownerRow = detail.body.members.find((m: { role: string }) => m.role === 'OWNER');
      await venueAdmin.patch(`/organizations/${venue.id}/members/${ownerRow.id}`, { role: 'ADMIN' }).expect(403);
      await venueOwner.post(`/organizations/${venue.id}/leave`).expect(409);
      const demote = await venueOwner.patch(`/organizations/${venue.id}/members/${ownerRow.id}`, { role: 'ADMIN' });
      expect(demote.body.code).toBe('LAST_OWNER');
    });

    it('perfil público da casa não expõe responsáveis', async () => {
      const pub = await new Client(app).get(`/public/venues/${venue.slug}`);
      expect(pub.status).toBe(200);
      const raw = JSON.stringify(pub.body);
      expect(raw).not.toContain(venueOwner.user!.email);
      expect(raw).not.toMatch(/members|passwordHash/);
    });
  });

  describe('rider × inventário', () => {
    it('compara de forma determinística com quantidades e justificativas', async () => {
      await artistUser
        .put(`/artists/${artist.id}/rider`, {
          notes: 'Voz e violão',
          items: [
            { catalogItemId: 'mic-din', quantity: 2 },
            { catalogItemId: 'di', quantity: 2 },
            { catalogItemId: 'bateria', quantity: 1 },
            { catalogItemId: 'iem', quantity: 1 },
            { customName: 'Pedal de efeitos', quantity: 1 },
          ],
        })
        .expect(200);
      await venueOwner
        .put(`/organizations/${venue.id}/equipment`, {
          items: [
            { catalogItemId: 'mic-din', quantity: 6, notes: 'SM58' },
            { catalogItemId: 'di', quantity: 1 },
            { catalogItemId: 'iem', quantity: 0 },
            { catalogItemId: 'mic-cond', quantity: 3 },
            { customName: 'Pedal de efeitos', quantity: 1 },
          ],
        })
        .expect(200);
      const res = await artistUser.get(`/artists/${artist.id}/compatibility/${venue.id}`);
      expect(res.status).toBe(200);
      const byName = Object.fromEntries(res.body.items.map((i: { name: string; status: string }) => [i.name, i]));
      expect(byName['Microfone dinâmico']).toMatchObject({ status: 'COMPATIBLE', required: 2, available: 6, unit: 'un' });
      expect(byName['Caixa direta (DI)']).toMatchObject({ status: 'PARTIALLY_AVAILABLE', available: 1, missing: 1 });
      expect(byName['Bateria completa']).toMatchObject({ status: 'UNAVAILABLE', available: 0 });
      expect(byName['Retorno auricular (in-ear)']).toMatchObject({ status: 'UNAVAILABLE' });
      // item personalizado NÃO casa com item personalizado de mesmo nome
      expect(byName['Pedal de efeitos']).toMatchObject({ status: 'NEEDS_CHECK', available: null });
      expect(res.body.summary).toMatchObject({ COMPATIBLE: 1, PARTIALLY_AVAILABLE: 1, UNAVAILABLE: 2, NEEDS_CHECK: 1 });
      expect(res.body.venueCustomItems).toHaveLength(1);
    });

    it('quantidade que o artista já possui entra na comparação e fica evidente quanto ele deve levar', async () => {
      // precisa de 2 amplificadores e já possui 1; a casa tem 1 → 1 da casa + 1 do artista
      await artistUser
        .put(`/artists/${artist.id}/rider`, { notes: '', items: [{ catalogItemId: 'amp-gtr', quantity: 2, ownedQuantity: 1 }, { catalogItemId: 'mic-din', quantity: 2 }] })
        .expect(200);
      const saved = await artistUser.get(`/artists/${artist.id}/rider`);
      expect(saved.body.items.find((i: { catalogItemId: string }) => i.catalogItemId === 'amp-gtr')).toMatchObject({ quantity: 2, ownedQuantity: 1 });
      await venueOwner
        .put(`/organizations/${venue.id}/equipment`, { items: [{ catalogItemId: 'amp-gtr', quantity: 1 }, { catalogItemId: 'mic-din', quantity: 6 }] })
        .expect(200);
      const res = await artistUser.get(`/artists/${artist.id}/compatibility/${venue.id}`);
      expect(res.status).toBe(200);
      const amp = res.body.items.find((i: { catalogItemId: string }) => i.catalogItemId === 'amp-gtr');
      expect(amp).toMatchObject({ status: 'COMPATIBLE', required: 2, owned: 1, available: 1, venueProvides: 1, artistProvides: 1, missing: 0 });
      expect(amp.reason).toContain('artista precisa levar 1 un');
      expect(res.body.fullyCompatible).toBe(true);
      expect(res.body.artistSuppliedItems).toBe(1);
      // sem possuir nenhum, o mesmo item fica parcial
      await artistUser.put(`/artists/${artist.id}/rider`, { notes: '', items: [{ catalogItemId: 'amp-gtr', quantity: 2 }] }).expect(200);
      const semPosse = await artistUser.get(`/artists/${artist.id}/compatibility/${venue.id}`);
      expect(semPosse.body.items[0]).toMatchObject({ status: 'PARTIALLY_AVAILABLE', artistProvides: 0, missing: 1 });
    });

    it('não aceita possuir mais do que o rider pede nem quantidade possuída negativa', async () => {
      await artistUser.put(`/artists/${artist.id}/rider`, { notes: '', items: [{ catalogItemId: 'amp-gtr', quantity: 1, ownedQuantity: 2 }] }).expect(400);
      await artistUser.put(`/artists/${artist.id}/rider`, { notes: '', items: [{ catalogItemId: 'amp-gtr', quantity: 1, ownedQuantity: -1 }] }).expect(400);
      await artistUser.put(`/artists/${artist.id}/rider`, { notes: '', items: [{ customName: 'Pedal', quantity: 2, ownedQuantity: 3 }] }).expect(400);
    });

    it('inventário não altera o rider do artista', async () => {
      const before = await artistUser.get(`/artists/${artist.id}/rider`);
      await venueOwner.put(`/organizations/${venue.id}/equipment`, { items: [{ catalogItemId: 'bateria', quantity: 2 }] }).expect(200);
      const after = await artistUser.get(`/artists/${artist.id}/rider`);
      expect(after.body.items).toEqual(before.body.items);
    });

    it('comparação só em contexto autorizado: terceiros e casa sem vínculo não comparam', async () => {
      const priv = await bandAdmin.post('/me/musician-profile', { name: 'Beto Privado' });
      await stranger.get(`/artists/${priv.body.id}/compatibility/${venue.id}`).expect(403);
      await venueOwner.get(`/artists/${priv.body.id}/compatibility/${venue.id}`).expect(403);
      // perfil público não basta: a casa só compara na negociação/análise de candidatura
      const res = await venueOwner.get(`/artists/${artist.id}/compatibility/${venue.id}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/negociação/);
    });
  });

  describe('eventos, candidaturas e booking', () => {
    let eventId: string;
    let applicationId: string;
    let bookingId: string;

    it('rascunho não é público; publicação abre inscrições', async () => {
      const ev = await venueOwner.post(`/organizations/${venue.id}/events`, {
        title: 'Sexta Acústica',
        description: 'Noite de voz e violão.',
        startsAt: inDays(20),
        applicationDeadline: inDays(10),
        slots: 1,
        genres: ['MPB'],
        paymentType: 'Cachê fixo',
        feeCents: 80000,
      });
      expect(ev.status).toBe(201);
      expect(ev.body.status).toBe('DRAFT');
      eventId = ev.body.id;
      await new Client(app).get(`/public/events/${eventId}`).expect(404);
      await stranger.post(`/events/${eventId}/transition`, { action: 'publish' }).expect(403);
      const pub = await venueAdmin.post(`/events/${eventId}/transition`, { action: 'publish' });
      expect(pub.body.status).toBe('OPEN');
      const list = await new Client(app).get('/public/events');
      expect(list.body.map((e: { id: string }) => e.id)).toContain(eventId);
      // transição inválida
      await venueOwner.post(`/events/${eventId}/transition`, { action: 'complete' }).expect(409);
    });

    it('candidatura: só quem administra o artista; duplicidade impedida; retirada e reenvio', async () => {
      await stranger.post(`/events/${eventId}/applications`, { artistId: artist.id, message: 'oi' }).expect(403);
      const app1 = await artistUser.post(`/events/${eventId}/applications`, { artistId: artist.id, message: 'Tenho repertório para a noite.' });
      expect(app1.status).toBe(201);
      expect(app1.body.status).toBe('PENDING');
      applicationId = app1.body.id;
      const dup = await artistUser.post(`/events/${eventId}/applications`, { artistId: artist.id, message: 'de novo' });
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('DUPLICATE_APPLICATION');
      await artistUser.post(`/applications/${applicationId}/withdraw`).expect(201);
      const again = await artistUser.post(`/events/${eventId}/applications`, { artistId: artist.id, message: 'Reenvio' });
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(applicationId);
      const count = await prisma.eventApplication.count({ where: { eventId, artistId: artist.id } });
      expect(count).toBe(1);
    });

    it('perfil privado não se candidata', async () => {
      const priv = await stranger.post('/me/musician-profile', { name: 'Sara Privada' });
      const res = await stranger.post(`/events/${eventId}/applications`, { artistId: priv.body.id });
      expect(res.status).toBe(422);
    });

    it('apenas a casa analisa; aceitar NÃO cria nem confirma contratação', async () => {
      await artistUser.post(`/applications/${applicationId}/accept`).expect(403);
      await stranger.get(`/events/${eventId}/manage`).expect(403);
      const res = await venueOwner.post(`/applications/${applicationId}/accept`, { note: 'Selecionada' });
      expect(res.status).toBe(201);
      const accepted = res.body.applications.find((a: { id: string }) => a.id === applicationId);
      expect(accepted.status).toBe('ACCEPTED');
      expect(accepted.booking).toBeNull();
      expect(await prisma.booking.count({ where: { applicationId } })).toBe(0);
    });

    it('selecionar candidatura não ocupa a vaga: o evento segue aberto até uma contratação ser confirmada', async () => {
      const manage = await venueOwner.get(`/events/${eventId}/manage`);
      expect(manage.body.status).toBe('OPEN');
      expect(manage.body.filledSlots).toBe(0);
      const other = await registerUser(app, 'Caio Extra');
      const otherArtist = await createPublicMusician(other, 'Caio Extra Som');
      const a2 = await other.post(`/events/${eventId}/applications`, { artistId: otherArtist.id });
      expect(a2.status).toBe(201);
    });

    it('inicia booking a partir da candidatura aceita (estado inicial NEGOTIATING)', async () => {
      const res = await venueOwner.post(`/applications/${applicationId}/booking`, {
        offer: { performanceAt: inDays(20), durationMinutes: 90, feeCents: 80000, terms: 'Som da casa.' },
        message: 'Bem-vinda! Seguem os termos.',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ origin: 'APPLICATION', status: 'NEGOTIATING', applicationId });
      bookingId = res.body.id;
      await venueOwner.post(`/applications/${applicationId}/booking`, { offer: { performanceAt: inDays(20), durationMinutes: 90, feeCents: 1 } }).expect(409);
      // candidatura continua registrada como ACCEPTED
      const appRow = await prisma.eventApplication.findUniqueOrThrow({ where: { id: applicationId } });
      expect(appRow.status).toBe('ACCEPTED');
      // retirada bloqueada enquanto há negociação
      await artistUser.post(`/applications/${applicationId}/withdraw`).expect(409);
    });

    it('negociação: contraproposta preserva histórico; quem fez a proposta não responde a si mesmo', async () => {
      const b = await artistUser.get(`/bookings/${bookingId}`);
      const firstOffer = b.body.pendingOffer;
      await venueOwner.post(`/bookings/${bookingId}/offers/${firstOffer.id}/accept`).expect(403);
      const counter = await artistUser.post(`/bookings/${bookingId}/offers/${firstOffer.id}/counter`, {
        performanceAt: inDays(20),
        durationMinutes: 90,
        feeCents: 100000,
        terms: 'Preciso de 2 DIs.',
      });
      expect(counter.status).toBe(201);
      expect(counter.body.offers).toHaveLength(2);
      expect(counter.body.offers[0]).toMatchObject({ status: 'SUPERSEDED', feeCents: 80000, authorSide: 'VENUE' });
      expect(counter.body.offers[1]).toMatchObject({ status: 'PENDING', feeCents: 100000, authorSide: 'ARTIST' });
      // responder a oferta já superada falha
      await venueOwner.post(`/bookings/${bookingId}/offers/${firstOffer.id}/accept`).expect(409);
    });

    it('mensagens: apenas participantes leem e enviam', async () => {
      await artistUser.post(`/bookings/${bookingId}/messages`, { body: 'Posso chegar às 18h para passagem de som?' }).expect(201);
      await venueAdmin.post(`/bookings/${bookingId}/messages`, { body: 'Pode sim.' }).expect(201);
      await stranger.get(`/bookings/${bookingId}`).expect(404);
      await stranger.post(`/bookings/${bookingId}/messages`, { body: 'intruso' }).expect(404);
      await new Client(app).get(`/bookings/${bookingId}`).expect(401);
      const d = await artistUser.get(`/bookings/${bookingId}`);
      expect(d.body.messages.map((m: { body: string }) => m.body)).toEqual([
        'Bem-vinda! Seguem os termos.',
        'Posso chegar às 18h para passagem de som?',
        'Pode sim.',
      ]);
      const list = await stranger.get('/bookings');
      expect(list.body.map((x: { id: string }) => x.id)).not.toContain(bookingId);
    });

    it('aceite leva a AGREED; apenas a casa confirma explicitamente; confirmação é auditada', async () => {
      const b = await venueOwner.get(`/bookings/${bookingId}`);
      const res = await venueOwner.post(`/bookings/${bookingId}/offers/${b.body.pendingOffer.id}/accept`);
      expect(res.body.status).toBe('AGREED');
      await artistUser.post(`/bookings/${bookingId}/confirm`).expect(403);
      const conf = await venueAdmin.post(`/bookings/${bookingId}/confirm`);
      expect(conf.status).toBe(201);
      expect(conf.body.status).toBe('CONFIRMED');
      expect(conf.body.confirmedAt).toBeTruthy();
      expect(conf.body.statusChanges.map((s: { toStatus: string }) => s.toStatus)).toEqual(['NEGOTIATING', 'AGREED', 'CONFIRMED']);
      // confirmado ≠ realizado
      expect(conf.body.performance).toBeNull();
      expect(await prisma.performance.count({ where: { bookingId } })).toBe(0);
      const schedule = await artistUser.get('/me/schedule');
      expect(schedule.body.upcoming.map((u: { id: string }) => u.id)).toContain(bookingId);
      expect(schedule.body.history).toHaveLength(0);
    });

    it('registro de apresentação só após a data; cria Performance distinta do booking', async () => {
      await artistUser.post(`/bookings/${bookingId}/performance`, { notes: '' }).expect(422);
      // simula a passagem do tempo para a data acordada
      await prisma.bookingOffer.updateMany({ where: { bookingId, status: 'ACCEPTED' }, data: { performanceAt: new Date(Date.now() - 3600_000) } });
      const res = await artistUser.post(`/bookings/${bookingId}/performance`, { notes: 'Casa cheia.' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.performance).toMatchObject({ notes: 'Casa cheia.' });
      await venueOwner.post(`/bookings/${bookingId}/performance`, { notes: '' }).expect(409);
      const schedule = await venueOwner.get('/me/schedule');
      expect(schedule.body.history.map((h: { bookingId: string }) => h.bookingId)).toContain(bookingId);
    });

    it('proposta direta pelo marketplace usa o mesmo fluxo de Booking', async () => {
      await stranger.post('/bookings', { organizationId: venue.id, artistId: artist.id, offer: { performanceAt: inDays(30), durationMinutes: 60, feeCents: 50000 } }).expect(403);
      const res = await venueOwner.post('/bookings', {
        organizationId: venue.id,
        artistId: artist.id,
        offer: { performanceAt: inDays(30), durationMinutes: 60, feeCents: 50000, terms: 'Abertura' },
        message: 'Queremos você na abertura.',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ origin: 'DIRECT', status: 'NEGOTIATING', applicationId: null });
      const id = res.body.id;
      const list = await artistUser.get('/bookings');
      const row = list.body.find((x: { id: string }) => x.id === id);
      expect(row.awaitingMe).toBe(true);
      const decline = await artistUser.post(`/bookings/${id}/offers/${res.body.pendingOffer.id}/decline`);
      expect(decline.body.status).toBe('DECLINED');
      await artistUser.post(`/bookings/${id}/messages`, { body: 'depois de encerrada' }).expect(409);
      await venueOwner.post(`/bookings/${id}/confirm`).expect(409);
    });

    it('não permite proposta para perfil privado; contratante não cria perfil artístico', async () => {
      const blocked = await venueOwner.post('/me/musician-profile', { name: 'Vera Canta' });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('WRONG_ACCOUNT_TYPE');
      const privUser = await registerUser(app, 'Paula Privada');
      const priv = await privUser.post('/me/musician-profile', { name: 'Paula Canta' });
      await venueOwner
        .post('/bookings', { organizationId: venue.id, artistId: priv.body.id, offer: { performanceAt: inDays(30), durationMinutes: 60, feeCents: 1 } })
        .expect(404);
    });

    it('cancelamento retira oferta pendente e fica auditado', async () => {
      const res = await venueOwner.post('/bookings', {
        organizationId: venue.id,
        artistId: artist.id,
        offer: { performanceAt: inDays(40), durationMinutes: 60, feeCents: 40000 },
      });
      const c = await artistUser.post(`/bookings/${res.body.id}/cancel`, { reason: 'Data indisponível' });
      expect(c.body.status).toBe('CANCELLED');
      expect(c.body.offers[0].status).toBe('WITHDRAWN');
      expect(c.body.statusChanges.at(-1)).toMatchObject({ toStatus: 'CANCELLED', note: 'Data indisponível', actorSide: 'ARTIST' });
    });

    it('painel resume pendências sem vazar dados de terceiros', async () => {
      const d = await venueOwner.get('/me/dashboard');
      expect(d.status).toBe(200);
      expect(d.body.managesVenues).toBe(true);
      const s = await stranger.get('/me/dashboard');
      expect(s.body.awaitingMe).toHaveLength(0);
      expect(s.body.applicationsToReview).toHaveLength(0);
    });
  });
});
