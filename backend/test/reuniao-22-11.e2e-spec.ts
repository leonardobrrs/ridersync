import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootApp, Client, createPublicMusician, createVenue, inDays, registerContractor, registerUser, validCnpj } from './helpers';

/** Reunião 22/11 (PostgreSQL real): CNPJ obrigatório, negociação com o cachê do evento, contraproposta, pulso, histórico. */
describe('Reunião 22/11 (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let owner: Client;
  let artist: Client;
  let venue: { id: string; slug: string };
  let art: { id: string; slug: string };
  let day = 40;

  const newEvent = async (over: Record<string, unknown> = {}) => {
    const d = (day += 3);
    const res = await owner.post(`/organizations/${venue.id}/events`, { title: `Evento 22/11 ${d}`, startsAt: inDays(d), applicationDeadline: inDays(d - 5), slots: 1, feeCents: 80000, durationMinutes: 60, ...over });
    expect(res.status).toBe(201);
    await owner.post(`/events/${res.body.id}/transition`, { action: 'publish' }).expect(201);
    return res.body as { id: string; startsAt: string };
  };
  const applyTo = async (eventId: string, extra: Record<string, unknown> = {}) => {
    const res = await artist.post(`/events/${eventId}/applications`, { artistId: art.id, message: 'Quero tocar.', ...extra });
    expect(res.status).toBe(201);
    return res.body as { id: string; proposedFeeCents: number | null };
  };

  beforeAll(async () => {
    app = await bootApp();
    owner = await registerContractor(app, 'Dona Casa 2211');
    artist = await registerUser(app, 'Ana 2211');
    venue = await createVenue(owner, 'Casa 2211');
    art = await createPublicMusician(artist, 'Ana 2211 Som');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('casa de show exige CNPJ válido na criação e não permite removê-lo na edição', async () => {
    const base = { name: 'Casa Sem CNPJ', city: 'Maceió' };
    for (const cnpj of [undefined, '', '11.111.111/1111-11', '11.222.333/0001-82']) {
      const res = await owner.post('/organizations', cnpj === undefined ? base : { ...base, cnpj });
      expect(res.status).toBe(400);
      expect(res.body.details.map((d: { path: string }) => d.path)).toContain('cnpj');
    }
    const ok = await owner.post('/organizations', { ...base, cnpj: '11.222.333/0001-81' });
    expect(ok.status).toBe(201);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: ok.body.id } })).cnpj).toBe('11222333000181');
    expect((await owner.patch(`/organizations/${ok.body.id}`, { cnpj: '' })).status).toBe(400);
    expect((await owner.patch(`/organizations/${ok.body.id}`, { cnpj: validCnpj() })).status).toBe(200);
  });

  it('selecionar candidatura inicia a negociação com o cachê publicado, sem redigitar a proposta', async () => {
    const ev = await newEvent();
    const app1 = await applyTo(ev.id);
    const res = await owner.post(`/applications/${app1.id}/booking`, {});
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('NEGOTIATING');
    expect(res.body.offers).toHaveLength(1);
    expect(res.body.offers[0]).toMatchObject({ authorSide: 'VENUE', status: 'PENDING', feeCents: 80000, durationMinutes: 60 });
    expect(new Date(res.body.offers[0].performanceAt).toISOString()).toBe(new Date(ev.startsAt).toISOString());
  });

  it('evento "a combinar" sem contraproposta exige a proposta do contratante', async () => {
    const ev = await newEvent({ feeCents: null });
    const a = await applyTo(ev.id);
    const res = await owner.post(`/applications/${a.id}/booking`, {});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('OFFER_REQUIRED');
  });

  it('artista envia contraproposta já na candidatura; o contratante responde a ela na negociação', async () => {
    const ev = await newEvent();
    const a = await applyTo(ev.id, { proposedFeeCents: 120000 });
    expect(a.proposedFeeCents).toBe(120000);
    // Contratação direta nas condições publicadas não passa por cima da contraproposta.
    const hire = await owner.post(`/applications/${a.id}/hire`);
    expect(hire.status).toBe(409);
    expect(hire.body.code).toBe('APPLICATION_HAS_COUNTER_OFFER');
    // A casa vê a contraproposta na candidatura.
    const manage = await owner.get(`/events/${ev.id}/manage`);
    expect(manage.body.applications.find((x: { id: string }) => x.id === a.id).proposedFeeCents).toBe(120000);

    const b = await owner.post(`/applications/${a.id}/booking`, {});
    expect(b.status).toBe(201);
    expect(b.body.offers.map((o: { authorSide: string; status: string; feeCents: number }) => [o.authorSide, o.status, o.feeCents])).toEqual([
      ['VENUE', 'SUPERSEDED', 80000],
      ['ARTIST', 'PENDING', 120000],
    ]);
    // Quem responde é o contratante: o artista não aceita a própria oferta.
    expect((await artist.post(`/bookings/${b.body.id}/offers/${b.body.pendingOffer.id}/accept`)).status).toBe(403);
    const accepted = await owner.post(`/bookings/${b.body.id}/offers/${b.body.pendingOffer.id}/accept`);
    expect(accepted.status).toBe(201);
    expect(accepted.body.status).toBe('AGREED');
  });

  it('contraproposta igual ao cachê publicado não é contraproposta', async () => {
    const ev = await newEvent();
    const a = await applyTo(ev.id, { proposedFeeCents: 80000 });
    expect(a.proposedFeeCents).toBeNull();
  });

  it('pulso muda quando algo acontece para o usuário (atualização sem recarregar)', async () => {
    const before = (await artist.get('/me/pulse')).body.v;
    expect(typeof before).toBe('string');
    expect((await artist.get('/me/pulse')).body.v).toBe(before); // estável sem mudanças
    const ev = await newEvent();
    const a = await applyTo(ev.id);
    const mid = (await artist.get('/me/pulse')).body.v;
    expect(mid).not.toBe(before);
    await owner.post(`/applications/${a.id}/booking`, {}).expect(201);
    expect((await artist.get('/me/pulse')).body.v).not.toBe(mid);
    expect((await new Client(app).get('/me/pulse')).status).toBe(401);
  });

  it('perfil público mostra o total e o histórico de shows realizados', async () => {
    const before = (await new Client(app).get(`/public/artists/${art.slug}`)).body.showHistory;
    expect(before).toMatchObject({ total: 0, items: [] });
    // Show confirmado no passado (o fluxo da API não permite datas passadas: grava direto, como um show já ocorrido).
    const past = new Date(Date.now() - 10 * 86400_000);
    const b = await prisma.booking.create({
      data: {
        origin: 'DIRECT',
        organizationId: venue.id,
        artistId: art.id,
        title: 'Show passado',
        status: 'CONFIRMED',
        confirmedAt: past,
        confirmedById: owner.user!.id,
        offers: { create: { authorSide: 'VENUE', authorId: owner.user!.id, performanceAt: past, durationMinutes: 90, feeCents: 50000, status: 'ACCEPTED', respondedAt: past } },
      },
    });
    const after = (await new Client(app).get(`/public/artists/${art.slug}`)).body.showHistory;
    expect(after.total).toBe(1);
    expect(after.items[0]).toMatchObject({ private: false, place: { name: 'Casa 2211' } });
    await prisma.booking.delete({ where: { id: b.id } });
  });
});
