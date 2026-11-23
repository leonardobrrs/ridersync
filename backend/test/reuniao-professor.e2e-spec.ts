import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootApp, Client, createPublicMusician, createVenue, inDays, registerContractor, registerUser } from './helpers';

/** Reunião com o professor (19/11): evento oculto, necessidades técnicas, contratação direta, avaliações, encerrados. */
describe('Reunião 19/11 (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let owner: Client;
  let artistA: Client;
  let artistB: Client;
  let visitor: Client;
  let venue: { id: string; slug: string };
  let artA: { id: string; slug: string };
  let artB: { id: string; slug: string };
  let day = 50;
  const nextDay = () => (day += 3);

  const newEvent = async (over: Record<string, unknown> = {}, publish = true) => {
    const d = nextDay();
    const res = await owner.post(`/organizations/${venue.id}/events`, { title: 'Evento 19/11', startsAt: inDays(d), applicationDeadline: inDays(d - 5), slots: 1, feeCents: 90000, durationMinutes: 60, ...over });
    expect(res.status).toBe(201);
    if (publish) await owner.post(`/events/${res.body.id}/transition`, { action: 'publish' }).expect(201);
    return res.body as { id: string; startsAt: string };
  };

  beforeAll(async () => {
    app = await bootApp();
    owner = await registerContractor(app, 'Dona Casa Prof');
    artistA = await registerUser(app, 'Ana Prof');
    artistB = await registerUser(app, 'Beto Prof');
    visitor = new Client(app);
    venue = await createVenue(owner, 'Casa Prof');
    artA = await createPublicMusician(artistA, 'Ana Prof Som');
    artB = await createPublicMusician(artistB, 'Beto Prof Som');
    await owner.put(`/organizations/${venue.id}/equipment`, { items: [{ catalogItemId: 'mic-din', quantity: 2, notes: '' }, { catalogItemId: 'di', quantity: 1, notes: '' }] }).expect(200);
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('evento oculto: fora das listagens; só organizador e convidados veem; não aceita candidatura', async () => {
    const ev = await newEvent({ title: 'Evento Oculto Prof', visibility: 'HIDDEN' });
    const list = await artistA.get('/public/events');
    expect(list.body.map((e: { id: string }) => e.id)).not.toContain(ev.id);
    await visitor.get(`/public/events/${ev.id}`).expect(404);
    await artistA.get(`/public/events/${ev.id}`).expect(404);
    expect((await owner.get(`/public/events/${ev.id}`)).body.visibility).toBe('HIDDEN');
    // convite → o convidado passa a ver
    await owner.post('/bookings', { organizationId: venue.id, artistId: artA.id, eventId: ev.id, offer: { performanceAt: ev.startsAt, durationMinutes: 60, feeCents: 90000 } }).expect(201);
    expect((await artistA.get(`/public/events/${ev.id}`)).status).toBe(200);
    const apply = await artistA.post(`/events/${ev.id}/applications`, { artistId: artA.id });
    expect(apply.status).toBe(409);
    expect(apply.body.code).toBe('INVITE_ONLY');
    await artistB.post(`/events/${ev.id}/applications`, { artistId: artB.id }).expect(404);
    // agenda pública nunca expõe o oculto
    expect(JSON.stringify((await visitor.get('/public/shows')).body)).not.toContain('Evento Oculto Prof');
  });

  it('a comparação da candidatura usa o rider do artista (necessário − o que ele já possui) × inventário da casa', async () => {
    // Rider = o que o artista PRECISA; ownedQuantity = quanto disso ele já possui e leva.
    await artistA
      .put(`/artists/${artA.id}/rider`, {
        notes: '',
        items: [
          { catalogItemId: 'mic-din', quantity: 3 }, // casa tem 2, artista não possui → faltam 1
          { catalogItemId: 'di', quantity: 3, ownedQuantity: 2 }, // casa tem 1 + artista leva 2 → compatível
          { customName: 'Pedal de expressão', quantity: 1 },
        ],
      })
      .expect(200);
    const ev = await newEvent({ title: 'Evento Rider' });
    // `needs` foi descontinuado: o corpo da candidatura aceita só artista e mensagem.
    await artistA.post(`/events/${ev.id}/applications`, { artistId: artA.id, needs: [] }).expect(400);
    const ap = await artistA.post(`/events/${ev.id}/applications`, { artistId: artA.id, message: 'Levo meus instrumentos.' });
    expect(ap.status).toBe(201);
    const cmp = await owner.get(`/applications/${ap.body.id}/compatibility`);
    expect(cmp.status).toBe(200);
    const byName = Object.fromEntries(cmp.body.items.map((i: { name: string }) => [i.name, i]));
    expect(byName['Microfone dinâmico']).toMatchObject({ status: 'PARTIALLY_AVAILABLE', venueProvides: 2, artistProvides: 0, missing: 1 });
    expect(byName['Caixa direta (DI)']).toMatchObject({ status: 'COMPATIBLE', required: 3, owned: 2, venueProvides: 1, artistProvides: 2, missing: 0 });
    expect(byName['Pedal de expressão']).toMatchObject({ status: 'NEEDS_CHECK' });
    expect(cmp.body.artistSuppliedItems).toBe(1);
    expect((await artistA.get(`/applications/${ap.body.id}/compatibility`)).status).toBe(200);
    await artistB.get(`/applications/${ap.body.id}/compatibility`).expect(404);
    const manage = await owner.get(`/events/${ev.id}/manage`);
    expect(manage.body.applications[0]).not.toHaveProperty('needs');
  });

  it('contratar direto nas condições do evento: confirma na hora e ocupa a vaga; sem cachê definido, exige negociação', async () => {
    const ev = await newEvent({ title: 'Evento Contratação Direta', notes: 'Chegar 1h antes.' });
    expect((await owner.get(`/events/${ev.id}/manage`)).body.notes).toBe('Chegar 1h antes.');
    const ap = await artistB.post(`/events/${ev.id}/applications`, { artistId: artB.id });
    const hired = await owner.post(`/applications/${ap.body.id}/hire`);
    expect(hired.status).toBe(201);
    expect(hired.body).toMatchObject({ status: 'CONFIRMED', agreedOffer: { feeCents: 90000, status: 'ACCEPTED' } });
    expect(hired.body.statusChanges.map((c: { toStatus: string }) => c.toStatus)).toEqual(['NEGOTIATING', 'AGREED', 'CONFIRMED']);
    expect((await owner.get(`/events/${ev.id}/manage`)).body.status).toBe('FILLED');
    expect((await artistB.get('/me/notifications')).body.items.map((n: { title: string }) => n.title)).toContain('Você foi contratado!');
    // evento encerrado aparece na aba de encerrados e mostra a atração confirmada
    const closed = await visitor.get('/public/events?state=closed');
    expect(closed.body.map((e: { id: string }) => e.id)).toContain(ev.id);
    const detail = await visitor.get(`/public/events/${ev.id}`);
    expect(detail.body.statusLabel).toBe('Vagas preenchidas');
    expect(detail.body.lineup.map((a: { slug: string }) => a.slug)).toEqual([artB.slug]);
    // sem cachê
    const noFee = await newEvent({ title: 'Evento Sem Cachê', feeCents: null });
    const ap2 = await artistA.post(`/events/${noFee.id}/applications`, { artistId: artA.id });
    const res = await owner.post(`/applications/${ap2.body.id}/hire`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('EVENT_TERMS_INCOMPLETE');
  });

  it('avaliação pós-show: 0 a 5 estrelas, uma por lado, só depois da apresentação; notas aparecem no perfil e na casa', async () => {
    const ev = await newEvent({ title: 'Evento Avaliação' });
    const ap = await artistA.post(`/events/${ev.id}/applications`, { artistId: artA.id });
    const b = await owner.post(`/applications/${ap.body.id}/hire`);
    const bookingId = b.body.id as string;
    // antes do show
    const early = await owner.post(`/bookings/${bookingId}/review`, { rating: 5 });
    expect(early.status).toBe(422);
    expect(b.body.review.canReview).toBe(false);
    // o show aconteceu
    await prisma.bookingOffer.updateMany({ where: { bookingId, status: 'ACCEPTED' }, data: { performanceAt: new Date(Date.now() - 3600_000) } });
    await owner.post(`/bookings/${bookingId}/performance`, { notes: 'Casa cheia.' }).expect(201);
    expect((await artistA.get('/me/notifications')).body.items.map((n: { type: string }) => n.type)).toContain('REVIEW_REQUEST');
    await owner.post(`/bookings/${bookingId}/review`, { rating: 6 }).expect(400);
    await owner.post(`/bookings/${bookingId}/review`, { rating: 5, comment: 'Pontual e excelente.' }).expect(201);
    expect((await owner.post(`/bookings/${bookingId}/review`, { rating: 4 })).status).toBe(422); // uma por lado
    await artistA.post(`/bookings/${bookingId}/review`, { rating: 0, comment: 'Som ruim.' }).expect(201);
    await artistB.post(`/bookings/${bookingId}/review`, { rating: 3 }).expect(404);
    const detail = await owner.get(`/bookings/${bookingId}`);
    expect(detail.body.review).toMatchObject({ canReview: false, mine: { rating: 5 }, received: { rating: 0 } });
    const profile = await visitor.get(`/public/artists/${artA.slug}`);
    expect(profile.body.reviews).toMatchObject({ average: 5, count: 1, recent: [{ rating: 5, comment: 'Pontual e excelente.', authorName: 'Casa Prof' }] });
    const venuePage = await visitor.get(`/public/venues/${venue.slug}`);
    expect(venuePage.body.reviews).toMatchObject({ average: 0, count: 1 });
  });
});
