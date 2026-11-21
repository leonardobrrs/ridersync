import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootApp, Client, createPublicMusician, createVenue, inDays, PUBLISHABLE_PROFILE, registerContractor, registerUser } from './helpers';

const CPF_ARTIST = '529.982.247-25';
const CPF_CONTRACTOR = '111.444.777-35';
const CNPJ_VENUE = '11.222.333/0001-81';
const CNPJ_BAND = '45.723.174/0001-10';

const terms = (extra: object = {}) => ({
  performanceAt: inDays(20),
  durationMinutes: 90,
  feeCents: 150000,
  terms: 'Som da casa.',
  presentationDesc: 'Show de forró pé de serra',
  advanceMinutes: 60,
  signalCents: 50000,
  signalDueDate: '2026-11-25',
  balanceDueDate: '2026-12-05',
  paymentMethod: 'Pix',
  ...extra,
});

/** Baixa o PDF como Buffer (o supertest não bufferiza application/pdf por padrão). */
const binary = (t: ReturnType<Client['get']>) =>
  t.buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

describe('Contratos (integração)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let venueOwner: Client;
  let soloUser: Client;
  let stranger: Client;
  let venue: { id: string };
  let solo: { id: string };

  /** Proposta direta → aceite do artista → confirmação da casa. */
  async function confirmDirect(artistClient: Client, artistId: string, offer: object) {
    const created = await venueOwner.post('/bookings', { organizationId: venue.id, artistId, offer });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    await artistClient.post(`/bookings/${id}/offers/${created.body.pendingOffer.id}/accept`).expect(201);
    const confirmed = await venueOwner.post(`/bookings/${id}/confirm`);
    expect(confirmed.status).toBe(201);
    return confirmed.body;
  }

  beforeAll(async () => {
    app = await bootApp();
    venueOwner = await registerContractor(app, 'Vera Venue');
    soloUser = await registerUser(app, 'Ana Artista');
    stranger = await registerUser(app, 'Sara Estranha');
    venue = await createVenue(venueOwner, 'Bar do Contrato');
    solo = await createPublicMusician(soloUser, 'Ana Contrato');
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('dados civis (privados)', () => {
    it('valida CPF, normaliza para dígitos e permite limpar', async () => {
      await soloUser.put('/account/legal-profile', { legalName: 'Ana Lins', cpf: '111.111.111-11' }).expect(400);
      const ok = await soloUser.put('/account/legal-profile', { legalName: 'Ana Lins da Silva', cpf: CPF_ARTIST, rg: '1234567 SSP/AL' });
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ legalName: 'Ana Lins da Silva', cpf: '52998224725', rg: '1234567 SSP/AL' });
      expect((await soloUser.get('/account/legal-profile')).body.cpf).toBe('52998224725');
      await new Client(app).get('/account/legal-profile').expect(401);
    });

    it('CNPJ da casa é validado e nunca aparece no perfil público', async () => {
      await venueOwner.patch(`/organizations/${venue.id}`, { legalName: 'Bar do Contrato Ltda', cnpj: '11.222.333/0001-80' }).expect(400);
      const res = await venueOwner.patch(`/organizations/${venue.id}`, { legalName: 'Bar do Contrato Ltda', cnpj: CNPJ_VENUE, addressLine: 'Rua do Sol, 100' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ legalName: 'Bar do Contrato Ltda', cnpj: '11222333000181' });
      await stranger.patch(`/organizations/${venue.id}`, { cnpj: CNPJ_VENUE }).expect(403);
      const slug = (await prisma.organization.findUniqueOrThrow({ where: { id: venue.id }, select: { slug: true } })).slug;
      const pub = await new Client(app).get(`/public/venues/${slug}`);
      expect(pub.status).toBe(200);
      expect(JSON.stringify(pub.body)).not.toMatch(/11222333000181|Bar do Contrato Ltda|cnpj|legalName/);
    });

    it('proposta recusa sinal maior que o cachê', async () => {
      const res = await venueOwner.post('/bookings', { organizationId: venue.id, artistId: solo.id, offer: terms({ signalCents: 150001 }) });
      expect(res.status).toBe(400);
    });
  });

  describe('casa (VENUE) × artista solo', () => {
    let booking: { id: string; status: string; contract: { id: string; downloadUrl: string; templateType: string } | null };

    it('não existe contrato antes da confirmação', async () => {
      const created = await venueOwner.post('/bookings', { organizationId: venue.id, artistId: solo.id, offer: terms() });
      expect(created.status).toBe(201);
      expect(created.body.contract).toBeNull();
      expect(created.body.agreedOffer).toBeNull();
      await soloUser.post(`/bookings/${created.body.id}/offers/${created.body.pendingOffer.id}/accept`).expect(201);
      const agreed = await venueOwner.get(`/bookings/${created.body.id}`);
      expect(agreed.body.status).toBe('AGREED');
      expect(agreed.body.contract).toBeNull();
      // sem confirmação, nem sob demanda
      const early = await venueOwner.post(`/contracts/booking/${created.body.id}`);
      expect(early.status).toBe(409);
      expect(early.body.code).toBe('NOT_CONFIRMED');
      expect(await prisma.contract.count({ where: { bookingId: created.body.id } })).toBe(0);
      booking = (await venueOwner.post(`/bookings/${created.body.id}/confirm`)).body;
    });

    it('a confirmação gera o contrato automaticamente, uma única vez', async () => {
      expect(booking.status).toBe('CONFIRMED');
      expect(booking.contract).toMatchObject({ templateType: 'VENUE' });
      expect(booking.contract!.downloadUrl).toBe(`/api/contracts/${booking.contract!.id}/download`);
      const row = await prisma.contract.findUniqueOrThrow({ where: { bookingId: booking.id } });
      expect(row.content).toContain('Bar do Contrato Ltda');
      expect(row.content).toContain('11.222.333/0001-81');
      expect(row.content).toContain('Ana Lins da Silva');
      expect(row.content).toContain('529.982.247-25');
      expect(row.content).toContain('R$ 1.500,00 (mil e quinhentos reais)');
      expect(row.content).toContain('Sinal de R$ 500,00 (quinhentos reais) até 25/11/2026');
      expect(row.content).toContain('Show de forró pé de serra');
      expect(row.content).not.toMatch(/\{\{/);
      // idempotência: pedir de novo devolve o mesmo contrato
      const again = await soloUser.post(`/contracts/booking/${booking.id}`);
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(booking.contract!.id);
      expect(await prisma.contract.count({ where: { bookingId: booking.id } })).toBe(1);
    });

    it('ambas as partes veem e baixam o PDF; contratante e artista recebem o mesmo contrato', async () => {
      const id = booking.contract!.id;
      for (const who of [venueOwner, soloUser]) {
        const meta = await who.get(`/contracts/booking/${booking.id}`);
        expect(meta.status).toBe(200);
        expect(meta.body.id).toBe(id);
        const detail = await who.get(`/bookings/${booking.id}`);
        expect(detail.body.contract.id).toBe(id);
        const pdf = await binary(who.get(`/contracts/${id}/download`));
        expect(pdf.status).toBe(200);
        expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
        expect(pdf.headers['content-disposition']).toContain(`contrato-${booking.id}.pdf`);
        expect(pdf.headers['cache-control']).toMatch(/no-store/);
        expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      }
    });

    it('quem não participa (ou não está logado) não vê nem baixa', async () => {
      const id = booking.contract!.id;
      await stranger.get(`/contracts/booking/${booking.id}`).expect(404);
      await stranger.post(`/contracts/booking/${booking.id}`).expect(404);
      await stranger.get(`/contracts/${id}/download`).expect(404);
      await stranger.get(`/bookings/${booking.id}`).expect(404);
      await new Client(app).get(`/contracts/${id}/download`).expect(401);
      await new Client(app).get(`/contracts/booking/${booking.id}`).expect(401);
    });

    it('termos ausentes aparecem como [A PREENCHER] e a oferta antiga não é alterada', async () => {
      const bare = await confirmDirect(soloUser, solo.id, { performanceAt: inDays(30), durationMinutes: 60, feeCents: 100000, terms: '' });
      const row = await prisma.contract.findUniqueOrThrow({ where: { bookingId: bare.id } });
      expect(row.content).toContain('Sinal de R$ [A PREENCHER]');
      expect(row.content).toContain('minutos para preparação e passagem de som');
      expect(row.content).toContain('[A PREENCHER]');
      expect(row.content).toContain('R$ 1.000,00 (mil reais)');
    });

    it('contratação confirmada não é desfeita se o contrato for gerado depois (recuperação sob demanda)', async () => {
      const b = await confirmDirect(soloUser, solo.id, terms({ performanceAt: inDays(40) }));
      await prisma.contract.delete({ where: { bookingId: b.id } });
      const detail = await venueOwner.get(`/bookings/${b.id}`);
      expect(detail.body.status).toBe('CONFIRMED');
      expect(detail.body.contract).toBeNull();
      const regenerated = await venueOwner.post(`/contracts/booking/${b.id}`);
      expect(regenerated.status).toBe(201);
      expect(regenerated.body.templateType).toBe('VENUE');
    });
  });

  describe('banda', () => {
    let bandOwner: Client;
    let bandId: string;
    let bandArtistId: string;

    beforeAll(async () => {
      bandOwner = await registerUser(app, 'Beto Banda');
      const res = await bandOwner.post('/bands', { name: 'Os Contratados', ...PUBLISHABLE_PROFILE });
      expect(res.status).toBe(201);
      bandId = res.body.bandId;
      bandArtistId = res.body.artist.id;
      await bandOwner.put(`/artists/${bandArtistId}/visibility`, { visibility: 'PUBLIC' }).expect(200);
    });

    it('banda sem CNPJ: o OWNER é a parte contratada e o representante legal', async () => {
      await bandOwner.put('/account/legal-profile', { legalName: 'Beto Almeida', cpf: CPF_CONTRACTOR }).expect(200);
      const detail = await bandOwner.get(`/bands/${bandId}`);
      expect(detail.body.legal).toEqual({ legalName: null, cnpj: null, ownerHasLegalData: true });
      const b = await confirmDirect(bandOwner, bandArtistId, terms({ performanceAt: inDays(50) }));
      const row = await prisma.contract.findUniqueOrThrow({ where: { bookingId: b.id } });
      expect(row.content).toContain('Beto Almeida, CPF 111.444.777-35, representando o grupo musical "Os Contratados"');
    });

    it('banda com CNPJ: razão social e CNPJ da banda; só OWNER/ADMIN editam', async () => {
      await stranger.put(`/bands/${bandId}/legal`, { cnpj: CNPJ_BAND }).expect(403);
      await bandOwner.put(`/bands/${bandId}/legal`, { legalName: 'Os Contratados Produções ME', cnpj: '45.723.174/0001-99' }).expect(400);
      const ok = await bandOwner.put(`/bands/${bandId}/legal`, { legalName: 'Os Contratados Produções ME', cnpj: CNPJ_BAND });
      expect(ok.status).toBe(200);
      expect(ok.body.legal).toMatchObject({ legalName: 'Os Contratados Produções ME', cnpj: '45723174000110' });
      const b = await confirmDirect(bandOwner, bandArtistId, terms({ performanceAt: inDays(60) }));
      const row = await prisma.contract.findUniqueOrThrow({ where: { bookingId: b.id } });
      expect(row.content).toContain('Os Contratados Produções ME');
      expect(row.content).toContain('45.723.174/0001-10');
      expect(row.content).not.toContain('representando o grupo musical');
    });

    it('integrante MEMBER não vê os dados de contrato da banda nem baixa o contrato', async () => {
      const member = await registerUser(app, 'Mia Membro');
      const inv = await bandOwner.post(`/bands/${bandId}/invitations`, { email: member.user!.email, role: 'MEMBER', instrument: 'Baixo' });
      await member.post(`/me/invitations/band/${inv.body.id}/accept`).expect(201);
      const detail = await member.get(`/bands/${bandId}`);
      expect(detail.body.legal).toBeNull();
      expect(JSON.stringify(detail.body)).not.toMatch(/45723174000110|Produções ME/);
      const contract = await prisma.contract.findFirstOrThrow({ where: { booking: { artistId: bandArtistId } } });
      await member.get(`/contracts/${contract.id}/download`).expect(404);
      await member.put(`/bands/${bandId}/legal`, { cnpj: CNPJ_BAND }).expect(403);
    });
  });

  describe('contratante pessoa física (INDIVIDUAL)', () => {
    it('contratação direta nas condições do evento gera o contrato individual', async () => {
      const person = await registerContractor(app, 'Maria Contratante');
      await person.put('/account/legal-profile', { legalName: 'Maria Souza', cpf: CPF_CONTRACTOR, rg: '7654321 SSP/AL' }).expect(200);
      const ev = await person.post('/me/independent-events', {
        title: 'Aniversário da Maria',
        description: 'Festa de 30 anos',
        startsAt: inDays(25),
        applicationDeadline: inDays(10),
        slots: 1,
        feeCents: 120000,
        locationName: 'Sítio Boa Vista',
        locationAddress: 'Estrada do Sítio, km 3',
        locationCity: 'Arapiraca',
      });
      expect(ev.status).toBe(201);
      const member = await prisma.organizationMember.findFirstOrThrow({ where: { userId: person.user!.id }, select: { organizationId: true } });
      await person.patch(`/organizations/${member.organizationId}`, { addressLine: 'Av. Central, 50', city: 'Arapiraca', contactPhone: '(82) 98888-7777' }).expect(200);
      await person.post(`/events/${ev.body.id}/transition`, { action: 'publish' }).expect(201);
      const app1 = await soloUser.post(`/events/${ev.body.id}/applications`, { artistId: solo.id, message: 'Tenho repertório.' });
      expect(app1.status).toBe(201);
      const hired = await person.post(`/applications/${app1.body.id}/hire`);
      expect(hired.status).toBe(201);
      expect(hired.body.status).toBe('CONFIRMED');
      expect(hired.body.contract).toMatchObject({ templateType: 'INDIVIDUAL' });
      const row = await prisma.contract.findUniqueOrThrow({ where: { bookingId: hired.body.id } });
      expect(row.content).toContain('PARA EVENTO PARTICULAR');
      expect(row.content).toContain('Maria Souza');
      expect(row.content).toContain('111.444.777-35');
      expect(row.content).toContain('7654321 SSP/AL');
      expect(row.content).toContain('Av. Central, 50');
      expect(row.content).toContain('(82) 98888-7777');
      expect(row.content).toContain('Sítio Boa Vista, Estrada do Sítio, km 3');
      expect(row.content).toContain('Festa de 30 anos');
      expect(row.content).toContain('Ana Lins da Silva');
      // ambas as partes baixam
      for (const who of [person, soloUser]) {
        const pdf = await binary(who.get(`/contracts/${hired.body.contract.id}/download`));
        expect(pdf.status).toBe(200);
        expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      }
    });
  });

  describe('atualização e prontidão (dados preenchidos depois da confirmação)', () => {
    let late: Client;
    let lateArtist: { id: string };
    let bookingId: string;

    beforeAll(async () => {
      late = await registerUser(app, 'Lia Atrasada');
      lateArtist = await createPublicMusician(late, 'Lia Sem Dados');
    });

    it('confirmação sem dados civis do artista: contrato sai com campos em aberto e a prontidão aponta o que falta', async () => {
      const b = await confirmDirect(late, lateArtist.id, terms({ performanceAt: inDays(45) }));
      bookingId = b.id;
      expect(b.contract.pendingFields).toBeGreaterThan(0);
      const ready = await late.get(`/contracts/booking/${bookingId}/readiness`);
      expect(ready.status).toBe(200);
      expect(ready.body.artist).toEqual({ missing: ['Nome completo do artista', 'CPF do artista'], link: '/painel/conta' });
      expect(ready.body.contractor.missing).toEqual([]);
      expect(ready.body.contractor.link).toBe(`/painel/casas/${venue.id}`);
      await stranger.get(`/contracts/booking/${bookingId}/readiness`).expect(404);
    });

    it('depois de preencher, qualquer parte atualiza o contrato (mesmo id, sem campos em aberto)', async () => {
      const before = (await late.get(`/contracts/booking/${bookingId}`)).body;
      await late.put('/account/legal-profile', { legalName: 'Lia Ferraz Atrasada', cpf: CPF_CONTRACTOR }).expect(200);
      await stranger.post(`/contracts/booking/${bookingId}/refresh`).expect(404);
      const res = await venueOwner.post(`/contracts/booking/${bookingId}/refresh`);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: before.id, pendingFields: 0 });
      expect(res.body.content).toBeUndefined();
      const stored = await prisma.contract.findUniqueOrThrow({ where: { bookingId }, select: { content: true } });
      expect(stored.content).toContain('Lia Ferraz Atrasada');
      expect(stored.content).toContain('111.444.777-35');
    });

    it('as duas partes são notificadas (sino + e-mail) quando o contrato é gerado e a cada atualização', async () => {
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { organizationId: true } });
      const venueUserIds = (await prisma.organizationMember.findMany({ where: { organizationId: booking.organizationId, status: 'ACTIVE' }, select: { userId: true } })).map((m) => m.userId);
      const lateUser = await prisma.user.findFirstOrThrow({ where: { legalName: 'Lia Ferraz Atrasada' }, select: { id: true } });
      for (const type of ['CONTRACT_READY', 'CONTRACT_UPDATED']) {
        const ns = await prisma.notification.findMany({ where: { type, link: `/painel/negociacoes/${bookingId}` }, select: { userId: true, id: true } });
        expect(new Set(ns.map((n) => n.userId))).toEqual(new Set([...venueUserIds, lateUser.id]));
        expect(await prisma.emailOutbox.count({ where: { notificationId: { in: ns.map((n) => n.id) } } })).toBe(ns.length);
      }
    });

    it('depois do show o contrato ainda pode ser atualizado (a assinatura é fora da plataforma)', async () => {
      await prisma.bookingOffer.updateMany({ where: { bookingId, status: 'ACCEPTED' }, data: { performanceAt: new Date(Date.now() - 3600_000) } });
      const before = await prisma.notification.count({ where: { type: 'CONTRACT_UPDATED', link: `/painel/negociacoes/${bookingId}` } });
      const res = await late.post(`/contracts/booking/${bookingId}/refresh`);
      expect(res.status).toBe(201);
      // nova versão → novo aviso para as duas partes
      expect(await prisma.notification.count({ where: { type: 'CONTRACT_UPDATED', link: `/painel/negociacoes/${bookingId}` } })).toBeGreaterThan(before);
    });
  });

  describe('LGPD', () => {
    it('exportação dos dados do titular inclui os dados civis informados', async () => {
      const exp = await soloUser.get('/account/export');
      expect(exp.status).toBe(200);
      expect(exp.body.account).toMatchObject({ legalName: 'Ana Lins da Silva', cpf: '52998224725', rg: '1234567 SSP/AL' });
    });
  });
});
