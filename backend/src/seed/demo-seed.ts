/**
 * SEED DE DEMONSTRAÇÃO — DADOS FICTÍCIOS, SOMENTE PARA DESENVOLVIMENTO.
 *
 * - Bloqueado quando NODE_ENV=production.
 * - Exige SEED_DEMO=true (ou --force) para rodar.
 * - Idempotente: se as contas demo já existem, não faz nada.
 * - Todas as contas usam o domínio reservado @demo.ridersync.local e a senha de dev abaixo.
 *   Não reutilize estas credenciais em nenhum outro ambiente.
 */
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../modules/auth/password';

if (existsSync('.env')) process.loadEnvFile('.env');

export const DEMO_PASSWORD = 'demo-ridersync-2026';
const D = (local: string) => `${local}@demo.ridersync.local`;
const days = (n: number, hour = 21) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(hour + 3, 0, 0, 0); // horário de Maceió (UTC-3)
  return d;
};

export async function runDemoSeed(prisma: PrismaClient) {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed de demonstração bloqueado em produção.');
  if (await prisma.user.findUnique({ where: { email: D('ana') } })) {
    console.warn('Seed demo: dados já existem — nada a fazer.');
    return;
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = (local: string, name: string) => prisma.user.create({ data: { email: D(local), name, passwordHash } });

  const [ana, lia, davi, joao, bia, rafael, marina] = await Promise.all([
    user('ana', 'Ana Lins (demo)'),
    user('lia', 'Lia Ferraz (demo)'),
    user('davi', 'Davi Rocha (demo)'),
    user('joao', 'João Bezerra (demo)'),
    user('bia', 'Bia Tenório (demo)'),
    user('rafael', 'Rafael Costa (demo)'),
    user('marina', 'Marina Sururu (demo)'),
  ]);

  const solo = async (
    u: { id: string },
    data: { slug: string; name: string; headline: string; bio: string; city: string; genres: string[]; formats: string[]; since: number; fee: number; main: string; instruments: string[]; instagram: string; visibility?: 'PUBLIC' | 'PRIVATE' },
    rider: [string, number, string?][],
    portfolio: { kind: 'AUDIO' | 'VIDEO' | 'LINK'; title: string; url: string }[] = [],
  ) => {
    const profile = await prisma.musicianProfile.create({ data: { userId: u.id, mainInstrument: data.main, instruments: data.instruments } });
    const visibility = data.visibility ?? 'PUBLIC';
    return prisma.artist.create({
      data: {
        kind: 'SOLO',
        musicianProfileId: profile.id,
        slug: data.slug,
        name: data.name,
        headline: data.headline,
        bio: data.bio,
        city: data.city,
        genres: data.genres,
        formats: data.formats,
        careerStartYear: data.since,
        baseFeeCents: data.fee * 100,
        instagram: data.instagram,
        visibility,
        publishedAt: visibility === 'PUBLIC' ? new Date() : null,
        rider: { create: { notes: '', items: { create: rider.map(([id, q, notes]) => ({ catalogItemId: id, quantity: q, notes: notes ?? '' })) } } },
        portfolioItems: { create: portfolio.map((p, i) => ({ ...p, position: i })) },
      },
    });
  };

  const anaArtist = await solo(
    ana,
    {
      slug: 'ana-lins-demo',
      name: 'Ana Lins',
      headline: 'Voz e violão — MPB e forró',
      bio: 'Perfil FICTÍCIO de demonstração. Cantora e violonista maceioense que mistura MPB com forró pé-de-serra. Toca em formato voz e violão ou com banda.',
      city: 'Maceió',
      genres: ['MPB', 'Forró'],
      formats: ['Solo', 'Com banda'],
      since: 2017,
      fee: 600,
      main: 'Voz',
      instruments: ['Violão'],
      instagram: 'analins.demo',
    },
    [['mic-din', 1, 'Para voz, de preferência com chave'], ['di', 1], ['retorno', 1], ['pedestal', 2], ['banqueta', 1], ['energia', 1]],
    [
      { kind: 'AUDIO', title: 'EP de demonstração (link de exemplo)', url: 'https://open.spotify.com/' },
      { kind: 'VIDEO', title: 'Ao vivo (link de exemplo)', url: 'https://www.youtube.com/' },
    ],
  );
  await solo(
    lia,
    { slug: 'lia-ferraz-demo', name: 'Lia Ferraz', headline: 'Baixista de estúdio e palco', bio: 'Perfil FICTÍCIO de demonstração. Baixista de estúdio e palco, grava para artistas da cena local.', city: 'Maceió', genres: ['MPB', 'Rock'], formats: ['Com banda'], since: 2015, fee: 350, main: 'Baixo', instruments: [], instagram: 'liaferraz.demo' },
    [['amp-baixo', 1], ['di', 1]],
  );
  await solo(
    joao,
    { slug: 'joao-bezerra-demo', name: 'João Bezerra', headline: 'Sanfoneiro — forró de raiz', bio: 'Perfil FICTÍCIO de demonstração. Sanfoneiro de Arapiraca, forró de raiz para São João, festas e casamentos.', city: 'Arapiraca', genres: ['Forró', 'Coco de roda'], formats: ['Solo', 'Trio'], since: 2009, fee: 700, main: 'Sanfona', instruments: ['Voz'], instagram: 'joaobezerra.demo' },
    [['mic-cond', 1, 'Para a sanfona'], ['retorno', 1], ['banqueta', 1]],
    [{ kind: 'AUDIO', title: 'Trio do Agreste (link de exemplo)', url: 'https://open.spotify.com/' }],
  );
  await solo(
    bia,
    { slug: 'bia-tenorio-demo', name: 'Bia Tenório', headline: 'Guitarra, synth e bases', bio: 'Perfil FICTÍCIO de demonstração. Guitarrista e produtora; sets solo com guitarra, sintetizador e bases.', city: 'Penedo', genres: ['Indie', 'Eletrônico'], formats: ['Solo', 'Com banda'], since: 2019, fee: 450, main: 'Guitarra', instruments: ['Teclado'], instagram: 'biatenorio.demo' },
    [['amp-gtr', 1], ['di', 2], ['sup-tec', 1], ['energia', 2]],
  );

  // Banda com identidade própria (não herda dados dos integrantes)
  const band = await prisma.band.create({ data: { createdById: ana.id } });
  const mare = await prisma.artist.create({
    data: {
      kind: 'BAND',
      bandId: band.id,
      slug: 'mare-alta-demo',
      name: 'Maré Alta',
      headline: 'Quarteto de forró e MPB',
      bio: 'Banda FICTÍCIA de demonstração. Quarteto que leva forró e MPB para palcos grandes, com muito coro com o público. Show de 1h30.',
      city: 'Maceió',
      genres: ['MPB', 'Forró'],
      formats: ['Com banda'],
      careerStartYear: 2019,
      baseFeeCents: 250000,
      instagram: 'marealta.demo',
      visibility: 'PUBLIC',
      publishedAt: new Date(),
      rider: {
        create: {
          notes: 'Passagem de som de 40 minutos.',
          items: {
            create: [
              { catalogItemId: 'mic-din', quantity: 4 },
              { catalogItemId: 'di', quantity: 3 },
              { catalogItemId: 'retorno', quantity: 4 },
              { catalogItemId: 'bateria', quantity: 1, notes: 'Pratos próprios' },
              { catalogItemId: 'amp-baixo', quantity: 1 },
              { catalogItemId: 'mesa', quantity: 16 },
              { customName: 'Zabumba com pele nova', customUnit: 'un', quantity: 1 },
            ],
          },
        },
      },
      portfolioItems: { create: [{ kind: 'VIDEO', title: 'Show de demonstração (link de exemplo)', url: 'https://www.youtube.com/', position: 0 }] },
    },
  });
  const now = new Date();
  await prisma.bandMember.createMany({
    data: [
      { bandId: band.id, userId: ana.id, role: 'OWNER', status: 'ACTIVE', joinedAt: now, instrument: 'Voz e violão' },
      { bandId: band.id, userId: davi.id, role: 'ADMIN', status: 'ACTIVE', joinedAt: now, instrument: 'Bateria', invitedById: ana.id, invitedAt: now },
      { bandId: band.id, userId: lia.id, role: 'MEMBER', status: 'ACTIVE', joinedAt: now, instrument: 'Baixo', invitedById: ana.id, invitedAt: now },
      { bandId: band.id, userId: joao.id, role: 'MEMBER', status: 'INVITED', instrument: 'Sanfona', invitedById: ana.id, invitedAt: now },
    ],
  });

  // Casas de show
  const galpao = await prisma.organization.create({
    data: {
      type: 'VENUE',
      slug: 'galpao-jaragua-demo',
      name: 'Galpão Jaraguá (demo)',
      venueKind: 'Casa de show',
      description: 'Casa FICTÍCIA de demonstração. Galpão com palco de 40 m², PA próprio e programação de música autoral às sextas e sábados.',
      addressLine: 'Rua Fictícia, 100',
      neighborhood: 'Jaraguá',
      city: 'Maceió',
      capacity: 450,
      instagram: 'galpao.demo',
      members: { create: [{ userId: rafael.id, role: 'OWNER', status: 'ACTIVE', joinedAt: now }] },
      equipment: {
        create: [
          { catalogItemId: 'mic-din', quantity: 6, notes: 'SM58' },
          { catalogItemId: 'mic-cond', quantity: 2 },
          { catalogItemId: 'di', quantity: 2 },
          { catalogItemId: 'retorno', quantity: 4 },
          { catalogItemId: 'pa', quantity: 1 },
          { catalogItemId: 'mesa', quantity: 24 },
          { catalogItemId: 'pedestal', quantity: 8 },
          { catalogItemId: 'bateria', quantity: 0, notes: 'Bateria em manutenção' },
          { catalogItemId: 'palco', quantity: 40 },
          { catalogItemId: 'energia', quantity: 6 },
          { customName: 'Projetor', customUnit: 'un', quantity: 1 },
        ],
      },
    },
  });
  await prisma.organization.create({
    data: {
      type: 'VENUE',
      slug: 'casa-sururu-demo',
      name: 'Casa Sururu (demo)',
      venueKind: 'Bar com música',
      description: 'Bar FICTÍCIO de demonstração, com música ao vivo de quinta a domingo.',
      neighborhood: 'Pajuçara',
      city: 'Maceió',
      capacity: 120,
      members: { create: [{ userId: marina.id, role: 'OWNER', status: 'ACTIVE', joinedAt: now }] },
      equipment: { create: [{ catalogItemId: 'mic-din', quantity: 2 }, { catalogItemId: 'retorno', quantity: 1 }, { catalogItemId: 'banqueta', quantity: 2 }] },
    },
  });

  const event = await prisma.event.create({
    data: {
      organizerId: galpao.id,
      venueId: galpao.id,
      createdById: rafael.id,
      title: 'Sexta Autoral — vagas para abertura (demo)',
      description: 'Oportunidade FICTÍCIA de demonstração. Buscamos atrações de MPB/forró para abrir a noite.',
      startsAt: days(21),
      durationMinutes: 60,
      applicationDeadline: days(10, 23),
      slots: 2,
      genres: ['MPB', 'Forró'],
      paymentType: 'Cachê fixo',
      feeCents: 80000,
      conditions: 'Som e luz da casa. Passagem de som às 18h.',
      requirements: 'Repertório com ao menos 40% autoral.',
      status: 'OPEN',
      publishedAt: now,
    },
  });
  await prisma.eventApplication.create({
    data: { eventId: event.id, artistId: mare.id, submittedById: ana.id, message: 'Candidatura de demonstração: temos show de 1h com repertório autoral.' },
  });

  // Proposta direta em negociação (Galpão → Ana)
  const booking = await prisma.booking.create({
    data: { origin: 'DIRECT', organizationId: galpao.id, artistId: anaArtist.id, title: 'Galpão Jaraguá × Ana Lins (demo)', createdById: rafael.id },
  });
  await prisma.bookingStatusChange.create({ data: { bookingId: booking.id, toStatus: 'NEGOTIATING', actorId: rafael.id, actorSide: 'VENUE', note: 'Proposta direta' } });
  await prisma.bookingOffer.create({
    data: { bookingId: booking.id, authorId: rafael.id, authorSide: 'VENUE', performanceAt: days(25), durationMinutes: 90, feeCents: 90000, terms: 'Formato voz e violão. Som da casa.' },
  });
  await prisma.bookingMessage.create({
    data: { bookingId: booking.id, authorId: rafael.id, authorSide: 'VENUE', body: 'Oi, Ana! Mensagem de demonstração: queremos você abrindo uma sexta.' },
  });

  console.warn(`Seed demo concluído. Contas fictícias (@demo.ridersync.local) com senha de desenvolvimento: ${DEMO_PASSWORD}`);
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  if (process.env.SEED_DEMO !== 'true' && !force) {
    console.warn('Seed demo ignorado (defina SEED_DEMO=true ou use --force).');
    process.exit(0);
  }
  const prisma = new PrismaClient();
  runDemoSeed(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
