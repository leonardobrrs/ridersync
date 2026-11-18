import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { EventLifecycleService } from '../src/modules/events/event-lifecycle.service';
import { bootApp, Client, createPublicMusician, createVenue, inDays, registerContractor, registerUser } from './helpers';

const offer = (d = 20) => ({ performanceAt: inDays(d), durationMinutes: 60, feeCents: 50000 });

describe('Eventos: visibilidade, vagas e ciclo de vida (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let contractor: Client;
  let venueOwner: Client;
  let artistA: Client;
  let artistB: Client;
  let visitor: Client;
  let venue: { id: string; slug: string };
  let artA: { id: string; slug: string };
  let artB: { id: string; slug: string };

  const newEvent = async (who: Client, orgId: string, over: Record<string, unknown> = {}) => {
    const res = await who.post(`/organizations/${orgId}/events`, { title: 'Show Teste', startsAt: inDays(30), applicationDeadline: inDays(10), slots: 1, ...over });
    expect(res.status).toBe(201);
    await who.post(`/events/${res.body.id}/transition`, { action: 'publish' }).expect(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    app = await bootApp();
    contractor = await registerContractor(app, 'Carla Festa');
    venueOwner = await registerContractor(app, 'Rafa Casa');
    artistA = await registerUser(app, 'Ana Palco');
    artistB = await registerUser(app, 'Beto Palco');
    visitor = new Client(app);
    venue = await createVenue(venueOwner, 'Casa Ciclo');
    artA = await createPublicMusician(artistA, 'Ana Palco Som');
    artB = await createPublicMusician(artistB, 'Beto Palco Som');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('eventos independentes e privados', () => {
    let privateId: string;

    it('contratante independente cria evento sem casa de show (exige cidade de Alagoas)', async () => {
      await artistA.post('/me/independent-events', { title: 'Festa', startsAt: inDays(30), applicationDeadline: inDays(10), slots: 1, locationCity: 'Maceió' }).expect(403);
      const bad = await contractor.post('/me/independent-events', { title: 'Festa', startsAt: inDays(30), applicationDeadline: inDays(10), slots: 1, locationCity: 'Recife' });
      expect(bad.status).toBe(400);
      const res = await contractor.post('/me/independent-events', {
        title: 'Aniversário particular',
        startsAt: inDays(30),
        applicationDeadline: inDays(10),
        slots: 1,
        visibility: 'PRIVATE',
        locationName: 'Salão do prédio',
        locationAddress: 'Rua Teste, 10',
        locationCity: 'maceio',
      });
      expect(res.status).toBe(201);
      expect(res.body.organizer.type).toBe('INDIVIDUAL');
      expect(res.body.organizer.slug).toBeNull();
      expect(res.body.location).toMatchObject({ name: 'Salão do prédio', city: 'Maceió', state: 'AL' });
      privateId = res.body.id;
      await contractor.post(`/events/${privateId}/transition`, { action: 'publish' }).expect(201);
      const me = await contractor.get('/auth/me');
      expect(me.body.organizations.some((o: { type: string }) => o.type === 'INDIVIDUAL')).toBe(true);
      // casa de show não é exigida, e contratante individual não tem inventário
      const org = me.body.organizations.find((o: { type: string }) => o.type === 'INDIVIDUAL');
      expect((await contractor.put(`/organizations/${org.id}/equipment`, { items: [] })).body.code).toBe('NOT_A_VENUE');
    });

    it('evento privado não aparece para visitantes nem contratantes; aparece para artistas', async () => {
      const ids = (r: { body: { id: string }[] }) => r.body.map((e) => e.id);
      expect(ids(await visitor.get('/public/events'))).not.toContain(privateId);
      expect(ids(await venueOwner.get('/public/events'))).not.toContain(privateId);
      expect(ids(await artistA.get('/public/events'))).toContain(privateId);
      expect(ids(await artistA.get('/public/events?visibility=PUBLIC'))).not.toContain(privateId);
      await visitor.get(`/public/events/${privateId}`).expect(404);
      await venueOwner.get(`/public/events/${privateId}`).expect(404);
      expect((await artistA.get(`/public/events/${privateId}`)).body.visibility).toBe('PRIVATE');
      expect(JSON.stringify((await visitor.get('/public/home')).body)).not.toContain(privateId);
    });

    it('artista se candidata ao privado; visitante não', async () => {
      await artistA.post(`/events/${privateId}/applications`, { artistId: artA.id }).expect(201);
      await visitor.post(`/events/${privateId}/applications`, { artistId: artA.id }).expect(401);
    });

    it('show confirmado privado aparece no perfil público só como "Evento privado"', async () => {
      const app1 = (await contractor.get(`/events/${privateId}/manage`)).body.applications[0];
      await contractor.post(`/applications/${app1.id}/accept`).expect(201);
      const b = await contractor.post(`/applications/${app1.id}/booking`, { offer: offer(30) });
      await artistA.post(`/bookings/${b.body.id}/offers/${b.body.pendingOffer.id}/accept`).expect(201);
      await contractor.post(`/bookings/${b.body.id}/confirm`).expect(201);
      const pub = await visitor.get(`/public/artists/${artA.slug}`);
      const ev = pub.body.upcomingEvents.find((e: { private: boolean }) => e.private);
      expect(ev).toEqual({ private: true, startsAt: expect.any(String), title: null, place: null, eventId: null });
      expect(JSON.stringify(pub.body)).not.toContain('Salão do prédio');
      expect(JSON.stringify((await visitor.get('/public/shows')).body)).not.toContain('Aniversário particular');
    });
  });

  describe('vagas', () => {
    it('aceites concorrentes nunca excedem as vagas; evento fica FILLED', async () => {
      const eventId = await newEvent(venueOwner, venue.id, { title: 'Concorrência', slots: 1 });
      const a1 = await artistA.post(`/events/${eventId}/applications`, { artistId: artA.id });
      const a2 = await artistB.post(`/events/${eventId}/applications`, { artistId: artB.id });
      const results = await Promise.all([
        venueOwner.post(`/applications/${a1.body.id}/accept`),
        venueOwner.post(`/applications/${a2.body.id}/accept`),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await prisma.eventApplication.count({ where: { eventId, status: 'ACCEPTED' } })).toBe(1);
      const ev = await venueOwner.get(`/events/${eventId}/manage`);
      expect(ev.body).toMatchObject({ status: 'FILLED', filledSlots: 1, statusLabel: 'Vagas preenchidas' });
      const notes = await venueOwner.get('/me/notifications');
      expect(notes.body.items.map((n: { type: string }) => n.type)).toContain('EVENT_FILLED');
    });

    it('negociação recusada cancela a vaga e reabre o evento automaticamente', async () => {
      const eventId = await newEvent(venueOwner, venue.id, { title: 'Vaga cancelada', slots: 1 });
      const ap = await artistA.post(`/events/${eventId}/applications`, { artistId: artA.id });
      await venueOwner.post(`/applications/${ap.body.id}/accept`).expect(201);
      expect((await venueOwner.get(`/events/${eventId}/manage`)).body.status).toBe('FILLED');
      const b = await venueOwner.post(`/applications/${ap.body.id}/booking`, { offer: offer() });
      await artistA.post(`/bookings/${b.body.id}/offers/${b.body.pendingOffer.id}/decline`).expect(201);
      const ev = await venueOwner.get(`/events/${eventId}/manage`);
      expect(ev.body.status).toBe('OPEN');
      expect(ev.body.applications[0].status).toBe('CANCELLED');
      expect(ev.body.filledSlots).toBe(0);
    });

    it('convite direto vinculado ao evento ocupa vaga; evento lotado recusa novo convite', async () => {
      const eventId = await newEvent(venueOwner, venue.id, { title: 'Convites', slots: 1 });
      const inv = await venueOwner.post('/bookings', { organizationId: venue.id, artistId: artA.id, eventId, offer: offer() });
      expect(inv.status).toBe(201);
      expect((await venueOwner.get(`/events/${eventId}/manage`)).body.status).toBe('FILLED');
      const full = await venueOwner.post('/bookings', { organizationId: venue.id, artistId: artB.id, eventId, offer: offer() });
      expect(full.status).toBe(409);
      expect(full.body.code).toBe('SLOTS_FULL');
      // convite para evento de outra organização é recusado (sem revelar existência)
      const other = await registerContractor(app, 'Outra Casa');
      const otherVenue = await createVenue(other, 'Outra Casa Teste');
      await other.post('/bookings', { organizationId: otherVenue.id, artistId: artB.id, eventId, offer: offer() }).expect(404);
      await venueOwner.post(`/bookings/${inv.body.id}/cancel`, { reason: 'Mudança de planos' }).expect(201);
      expect((await venueOwner.get(`/events/${eventId}/manage`)).body.status).toBe('OPEN');
    });

    it('reduzir vagas abaixo das ocupadas é recusado; aumentar reabre o evento lotado', async () => {
      const eventId = await newEvent(venueOwner, venue.id, { title: 'Ajuste de vagas', slots: 1 });
      const ap = await artistA.post(`/events/${eventId}/applications`, { artistId: artA.id });
      await venueOwner.post(`/applications/${ap.body.id}/accept`).expect(201);
      await venueOwner.patch(`/events/${eventId}`, { slots: 0 }).expect(400);
      const up = await venueOwner.patch(`/events/${eventId}`, { slots: 2 });
      expect(up.body.status).toBe('OPEN');
    });
  });

  describe('adiar, remarcar e cancelar', () => {
    it('adiar e remarcar notificam participantes e restauram estado coerente', async () => {
      const eventId = await newEvent(venueOwner, venue.id, { title: 'Adiamento', slots: 2 });
      await artistA.post(`/events/${eventId}/applications`, { artistId: artA.id }).expect(201);
      const p = await venueOwner.post(`/events/${eventId}/transition`, { action: 'postpone', reason: 'Chuva forte' });
      expect(p.body.status).toBe('POSTPONED');
      await artistB.post(`/events/${eventId}/applications`, { artistId: artB.id }).expect(409);
      const notes = await artistA.get('/me/notifications');
      expect(notes.body.items.find((n: { type: string }) => n.type === 'EVENT_POSTPONED')?.body).toBe('Chuva forte');
      await venueOwner.post(`/events/${eventId}/reschedule`, { startsAt: inDays(40), applicationDeadline: inDays(5) }).expect(201);
      const ev = await venueOwner.get(`/events/${eventId}/manage`);
      expect(ev.body.status).toBe('OPEN');
      expect((await artistA.get('/me/notifications')).body.items.map((n: { type: string }) => n.type)).toContain('EVENT_RESCHEDULED');
    });

    it('cancelar o evento encerra candidaturas e negociações vinculadas', async () => {
      const eventId = await newEvent(venueOwner, venue.id, { title: 'Cancelamento', slots: 2 });
      const a1 = await artistA.post(`/events/${eventId}/applications`, { artistId: artA.id });
      await artistB.post(`/events/${eventId}/applications`, { artistId: artB.id });
      await venueOwner.post(`/applications/${a1.body.id}/accept`).expect(201);
      const b = await venueOwner.post(`/applications/${a1.body.id}/booking`, { offer: offer() });
      await venueOwner.post(`/events/${eventId}/transition`, { action: 'cancel', reason: 'Reforma' }).expect(201);
      const apps = await prisma.eventApplication.findMany({ where: { eventId }, select: { status: true } });
      expect(apps.map((a) => a.status).sort()).toEqual(['CANCELLED', 'REJECTED']);
      expect((await artistA.get(`/bookings/${b.body.id}`)).body.status).toBe('CANCELLED');
      await venueOwner.post(`/events/${eventId}/transition`, { action: 'reopen' }).expect(409);
      expect((await artistB.get('/me/notifications')).body.items.map((n: { type: string }) => n.type)).toContain('EVENT_CANCELLED');
    });
  });

  describe('atualização automática por data', () => {
    it('prazo vencido fecha inscrições; data passada conclui (com contratação) ou encerra (sem)', async () => {
      const deadline = await newEvent(venueOwner, venue.id, { title: 'Prazo vence' });
      const past = await newEvent(venueOwner, venue.id, { title: 'Já aconteceu' });
      await prisma.event.update({ where: { id: deadline }, data: { applicationDeadline: new Date(Date.now() - 60_000) } });
      await prisma.event.update({ where: { id: past }, data: { startsAt: new Date(Date.now() - 3600_000), applicationDeadline: new Date(Date.now() - 7200_000) } });
      await app.get(EventLifecycleService).sweep();
      expect((await prisma.event.findUniqueOrThrow({ where: { id: deadline } })).status).toBe('CLOSED');
      expect((await prisma.event.findUniqueOrThrow({ where: { id: past } })).status).toBe('CLOSED');
      const again = await app.get(EventLifecycleService).sweep();
      expect(again.changed).toBe(0); // idempotente
    });
  });

  describe('agenda pública', () => {
    it('show confirmado em evento público aparece na home e no perfil com local, horário e artista', async () => {
      const eventId = await newEvent(venueOwner, venue.id, { title: 'Show Público Confirmado', slots: 1 });
      const ap = await artistB.post(`/events/${eventId}/applications`, { artistId: artB.id });
      await venueOwner.post(`/applications/${ap.body.id}/accept`).expect(201);
      const b = await venueOwner.post(`/applications/${ap.body.id}/booking`, { offer: offer(25) });
      await artistB.post(`/bookings/${b.body.id}/offers/${b.body.pendingOffer.id}/accept`).expect(201);
      await venueOwner.post(`/bookings/${b.body.id}/confirm`).expect(201);
      const shows = await visitor.get('/public/shows');
      const show = shows.body.find((s: { title: string }) => s.title === 'Show Público Confirmado');
      expect(show).toMatchObject({ artist: { slug: artB.slug }, place: { name: 'Casa Ciclo', city: 'Maceió' }, eventId });
      const profile = await visitor.get(`/public/artists/${artB.slug}`);
      expect(profile.body.upcomingEvents[0]).toMatchObject({ private: false, title: 'Show Público Confirmado' });
      const venuePage = await visitor.get(`/public/venues/${venue.slug}`);
      expect(venuePage.body.upcomingShows.map((s: { title: string }) => s.title)).toContain('Show Público Confirmado');
    });
  });

  describe('imagem do evento (card)', () => {
    const png = () => sharp({ create: { width: 640, height: 360, channels: 3, background: '#ffc83a' } }).png().toBuffer();
    const upload = async (who: Client, eventId: string) =>
      who.agent.put(`/api/events/${eventId}/image`).set('X-Requested-With', 'RiderSync').attach('file', await png(), { filename: 'cartaz.png', contentType: 'image/png' });

    it('organizador envia, todos veem em evento público e só ele altera; remoção apaga', async () => {
      const eventId = await newEvent(venueOwner, venue.id, { title: 'Show com Cartaz' });
      expect((await upload(artistA, eventId)).status).toBe(403);
      const res = await upload(venueOwner, eventId);
      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toMatch(/^\/api\/media\//);
      const pub = await visitor.get(`/public/events/${eventId}`);
      expect(pub.body.imageThumbUrl).toBe(`${res.body.imageUrl}?v=thumb`);
      const list = await visitor.get('/public/events');
      expect(list.body.find((e: { id: string }) => e.id === eventId).imageUrl).toBe(res.body.imageUrl);
      const img = await visitor.agent.get(res.body.imageUrl);
      expect(img.status).toBe(200);
      expect(img.headers['content-type']).toBe('image/webp');
      const removed = await venueOwner.agent.delete(`/api/events/${eventId}/image`).set('X-Requested-With', 'RiderSync');
      expect(removed.body.imageUrl).toBeNull();
      expect((await visitor.agent.get(res.body.imageUrl)).status).toBe(404);
    });

    it('imagem de evento privado: só contas de artista e o organizador; rascunho: só o organizador', async () => {
      const draft = await venueOwner.post(`/organizations/${venue.id}/events`, { title: 'Privado com Cartaz', startsAt: inDays(30), applicationDeadline: inDays(10), slots: 1, visibility: 'PRIVATE' });
      const url = (await upload(venueOwner, draft.body.id)).body.imageUrl as string;
      expect((await artistA.agent.get(url)).status).toBe(404);
      await venueOwner.post(`/events/${draft.body.id}/transition`, { action: 'publish' }).expect(201);
      expect((await visitor.agent.get(url)).status).toBe(404);
      expect((await contractor.agent.get(url)).status).toBe(404);
      expect((await artistA.agent.get(url)).status).toBe(200);
      expect((await venueOwner.agent.get(url)).status).toBe(200);
    });
  });
});
