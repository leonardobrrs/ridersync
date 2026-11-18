import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootApp, Client, createPublicMusician, createVenue, PUBLISHABLE_PROFILE, registerUser } from './helpers';

/**
 * Agenda e disponibilidade (PostgreSQL real, sem mocks):
 * conflitos de horário por artista/banda e por local, evento esgotado após confirmação e concorrência.
 */
describe('Agenda: conflitos de horário e disponibilidade após confirmação (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let contractor: Client;
  let soloUser: Client;
  let bandOwner: Client;
  let otherUser: Client;
  let venueA: { id: string };
  let venueB: { id: string };
  let venueC: { id: string };
  let solo: { id: string };
  let band: { id: string };
  let other: { id: string };

  /** Dia N a partir de hoje (sempre no futuro), no horário de Maceió. */
  const base = new Date();
  const at = (day: number, hh: number, mm = 0) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 30 + day, hh + 3, mm));
    return d.toISOString();
  };

  type Booking = { id: string; status: string; pendingOffer?: { id: string } | null };

  async function propose(orgId: string, artistId: string, start: string, minutes: number, eventId?: string): Promise<Booking> {
    const res = await contractor.post('/bookings', {
      organizationId: orgId,
      artistId,
      ...(eventId ? { eventId } : {}),
      offer: { performanceAt: start, durationMinutes: minutes, feeCents: 50000, terms: 'Teste de agenda' },
    });
    if (res.status !== 201) throw new Error(`proposta falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  }

  async function agree(artistClient: Client, b: Booking): Promise<Booking> {
    const res = await artistClient.post(`/bookings/${b.id}/offers/${b.pendingOffer!.id}/accept`);
    if (res.status !== 201 || res.body.status !== 'AGREED') throw new Error(`aceite falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  }

  const confirm = (b: Booking) => contractor.post(`/bookings/${b.id}/confirm`);

  async function agreed(artistClient: Client, orgId: string, artistId: string, start: string, minutes: number, eventId?: string) {
    return agree(artistClient, await propose(orgId, artistId, start, minutes, eventId));
  }

  beforeAll(async () => {
    app = await bootApp();
    contractor = await registerUser(app, 'Carla Contratante', 'CONTRACTOR');
    soloUser = await registerUser(app, 'Sol Solo');
    bandOwner = await registerUser(app, 'Bruno Banda');
    otherUser = await registerUser(app, 'Otávio Outro');
    venueA = await createVenue(contractor, 'Casa Agenda A');
    venueB = await createVenue(contractor, 'Casa Agenda B');
    venueC = await createVenue(contractor, 'Casa Agenda C');
    solo = await createPublicMusician(soloUser, 'Sol Agenda');
    other = await createPublicMusician(otherUser, 'Otávio Agenda');
    const b = await bandOwner.post('/bands', { name: 'Banda Agenda', ...PUBLISHABLE_PROFILE });
    if (b.status !== 201) throw new Error(`banda falhou: ${b.status} ${JSON.stringify(b.body)}`);
    await bandOwner.put(`/artists/${b.body.artist.id}/visibility`, { visibility: 'PUBLIC' }).expect(200);
    band = { id: b.body.artist.id };
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('1. confirma uma contratação sem conflito', async () => {
    const b = await agreed(soloUser, venueA.id, solo.id, at(1, 19), 180);
    const res = await confirm(b);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('2 e 11. impede sobreposição para o mesmo artista (19h–22h × 21h–23h) e não deixa confirmação parcial', async () => {
    const b = await agreed(soloUser, venueB.id, solo.id, at(1, 21), 120);
    const changesBefore = await prisma.bookingStatusChange.count({ where: { bookingId: b.id } });
    const res = await confirm(b);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SCHEDULE_CONFLICT');
    expect(res.body.message).toMatch(/artista já tem uma apresentação confirmada/);
    // Rollback: nada da confirmação foi gravado.
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row).toMatchObject({ status: 'AGREED', confirmedAt: null, confirmedById: null });
    expect(await prisma.bookingStatusChange.count({ where: { bookingId: b.id } })).toBe(changesBefore);
    // A mensagem não expõe dados da outra negociação (casa/título).
    expect(res.body.message).not.toMatch(/Casa Agenda A/);
  });

  it('3. impede sobreposição para a mesma banda', async () => {
    const first = await agreed(bandOwner, venueA.id, band.id, at(2, 19), 180);
    await confirm(first).expect(201);
    const second = await agreed(bandOwner, venueB.id, band.id, at(2, 20), 60);
    const res = await confirm(second);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SCHEDULE_CONFLICT');
  });

  it('4. impede conflito no mesmo local (casa) com outro artista, mas permite o line-up do mesmo evento', async () => {
    // venueA já tem Sol no dia 1, 19h–22h (teste 1).
    const clash = await agreed(otherUser, venueA.id, other.id, at(1, 20), 60);
    const res = await confirm(clash);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/o local já tem outra apresentação confirmada/);

    // Evento com 2 vagas na venueC: dois artistas no mesmo horário formam o line-up.
    const ev = await contractor.post(`/organizations/${venueC.id}/events`, {
      title: 'Festival Line-up',
      startsAt: at(5, 19),
      applicationDeadline: at(3, 12),
      slots: 2,
      genres: ['MPB'],
    });
    expect(ev.status).toBe(201);
    const a1 = await agreed(soloUser, venueC.id, solo.id, at(5, 19), 120, ev.body.id);
    const a2 = await agreed(otherUser, venueC.id, other.id, at(5, 19), 120, ev.body.id);
    await confirm(a1).expect(201);
    await confirm(a2).expect(201);
  });

  it('5. permite dois eventos do mesmo artista em horários diferentes no mesmo dia', async () => {
    const b = await agreed(soloUser, venueB.id, solo.id, at(1, 14), 60);
    const res = await confirm(b);
    expect(res.status).toBe(201);
  });

  it('6. permite eventos consecutivos sem sobreposição (19h–22h e 22h–23h)', async () => {
    const first = await agreed(otherUser, venueB.id, other.id, at(3, 19), 180);
    await confirm(first).expect(201);
    const next = await agreed(otherUser, venueB.id, other.id, at(3, 22), 60); // mesmo artista e mesmo local
    const res = await confirm(next);
    expect(res.status).toBe(201);
  });

  describe('evento com contratação confirmada', () => {
    let eventId: string;

    beforeAll(async () => {
      const ev = await contractor.post(`/organizations/${venueA.id}/events`, {
        title: 'Sexta Única',
        startsAt: at(8, 20),
        applicationDeadline: at(6, 12),
        slots: 1,
        genres: ['MPB'],
      });
      eventId = ev.body.id;
      await contractor.post(`/events/${eventId}/transition`, { action: 'publish' }).expect(201);
      const application = await soloUser.post(`/events/${eventId}/applications`, { artistId: solo.id, message: 'Quero tocar.' });
      expect(application.status).toBe(201);
      await contractor.post(`/applications/${application.body.id}/accept`).expect(201);
      const booking = await contractor.post(`/applications/${application.body.id}/booking`, {
        offer: { performanceAt: at(8, 20), durationMinutes: 120, feeCents: 90000 },
      });
      expect(booking.status).toBe(201);
      const ag = await agree(soloUser, booking.body);
      await confirm(ag).expect(201);
    });

    it('7. impede nova candidatura (evento esgotado, inclusive se o estado for reaberto indevidamente)', async () => {
      const res = await otherUser.post(`/events/${eventId}/applications`, { artistId: other.id });
      expect(res.status).toBe(409);
      // Mesmo com o estado forçado para OPEN (inconsistência), a API rejeita pela contratação confirmada.
      await prisma.event.update({ where: { id: eventId }, data: { status: 'OPEN' } });
      const forced = await otherUser.post(`/events/${eventId}/applications`, { artistId: other.id });
      expect(forced.status).toBe(409);
      expect(forced.body.code).toBe('EVENT_FULLY_BOOKED');
      await prisma.event.update({ where: { id: eventId }, data: { status: 'FILLED' } });
    });

    it('8. impede nova proposta vinculada ao evento', async () => {
      const res = await contractor.post('/bookings', {
        organizationId: venueA.id,
        artistId: other.id,
        eventId,
        offer: { performanceAt: at(8, 20), durationMinutes: 60, feeCents: 1000 },
      });
      expect(res.status).toBe(409);
      expect(['EVENT_FULLY_BOOKED', 'SLOTS_FULL']).toContain(res.body.code);
    });

    it('12. o evento confirmado continua consultável e aparece na agenda do artista', async () => {
      const pub = await new Client(app).get(`/public/events/${eventId}`);
      expect(pub.status).toBe(200);
      expect(pub.body.acceptingApplications).toBe(false);
      const list = await new Client(app).get('/public/events');
      expect(list.body.map((e: { id: string }) => e.id)).not.toContain(eventId);
      const schedule = await soloUser.get('/me/schedule');
      expect(schedule.body.upcoming.map((u: { title: string }) => u.title)).toEqual(expect.arrayContaining([expect.stringContaining('Sexta Única')]));
    });
  });

  it('9. contratações canceladas e propostas recusadas não bloqueiam a agenda', async () => {
    const confirmed = await agreed(soloUser, venueB.id, solo.id, at(4, 19), 180);
    await confirm(confirmed).expect(201);
    await contractor.post(`/bookings/${confirmed.id}/cancel`, { reason: 'Remarcado' }).expect(201);
    const declined = await propose(venueB.id, solo.id, at(4, 19, 30), 60);
    await soloUser.post(`/bookings/${declined.id}/offers/${declined.pendingOffer!.id}/decline`).expect(201);
    const pendingOnly = await propose(venueA.id, solo.id, at(4, 19), 120); // pendente: não ocupa agenda
    expect(pendingOnly.status).toBe('NEGOTIATING');
    const fresh = await agreed(soloUser, venueB.id, solo.id, at(4, 19, 30), 90);
    const res = await confirm(fresh);
    expect(res.status).toBe(201);
  });

  it('10. confirmações concorrentes: só uma reserva conflitante é efetivada', async () => {
    for (let round = 0; round < 4; round++) {
      const x = await agreed(otherUser, venueA.id, other.id, at(10 + round, 19), 120);
      const y = await agreed(otherUser, venueB.id, other.id, at(10 + round, 20), 120);
      const [r1, r2] = await Promise.all([confirm(x), confirm(y)]);
      expect([r1.status, r2.status].sort()).toEqual([201, 409]);
      const statuses = await prisma.booking.findMany({ where: { id: { in: [x.id, y.id] } }, select: { status: true } });
      expect(statuses.filter((s) => s.status === 'CONFIRMED')).toHaveLength(1);
      expect(statuses.filter((s) => s.status === 'AGREED')).toHaveLength(1);
    }
  });
});
