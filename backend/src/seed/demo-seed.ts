/**
 * SEED DE DEMONSTRAÇÃO — DADOS FICTÍCIOS (desenvolvimento e staging).
 *
 * - Bloqueado quando NODE_ENV=production e exige SEED_DEMO=true (ou --force).
 * - Idempotente por entidade: cada conta/perfil/evento/negociação é localizado por chave estável
 *   (e-mail, slug ou título + organizador) e só é criado se ainda não existir. Pode rodar várias vezes
 *   e sobre a versão anterior do seed sem duplicar dados.
 * - Todas as contas usam o domínio reservado @demo.ridersync.local e a senha DEMO_PASSWORD.
 *   Links de vídeo usam IDs inexistentes: nenhum dado aponta para pessoas reais.
 */
import { existsSync } from 'node:fs';
import { AccountType, ApplicationStatus, BookingStatus, EventStatus, EventVisibility, Prisma, PrismaClient } from '@prisma/client';
import { resolveVideoThumbnail } from '../common/video-thumbnail';
import { PRIVACY_POLICY_VERSION } from '../modules/auth/auth.service';
import { hashPassword } from '../modules/auth/password';

if (existsSync('.env')) process.loadEnvFile('.env');

export const DEMO_PASSWORD = 'Demo@RiderSync2026';
const D = (local: string) => `${local}@demo.ridersync.local`;
/** Data relativa a hoje, no horário de Maceió (UTC-3). */
const days = (n: number, hour = 21) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(hour + 3, 0, 0, 0);
  return d;
};

type Db = PrismaClient | Prisma.TransactionClient;
type RiderSpec = [string, number, string?][];
interface PortfolioSpec {
  kind: 'AUDIO' | 'VIDEO' | 'LINK';
  title: string;
  url: string;
  description?: string;
}

export async function runDemoSeed(prisma: PrismaClient) {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed de demonstração bloqueado em produção.');
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  // ─────────── Contas ───────────
  const user = async (local: string, name: string, accountType: AccountType) => {
    const email = D(local);
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, accountType: true } });
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, accountType: existing.accountType ?? accountType, emailVerifiedAt: now, termsAcceptedAt: now, termsVersion: PRIVACY_POLICY_VERSION },
        select: { id: true, name: true },
      });
    }
    return prisma.user.create({
      data: { email, name, passwordHash, accountType, emailVerifiedAt: now, termsAcceptedAt: now, termsVersion: PRIVACY_POLICY_VERSION },
      select: { id: true, name: true },
    });
  };

  const ana = await user('ana', 'Ana Lins (demo)', 'ARTIST');
  const lia = await user('lia', 'Lia Ferraz (demo)', 'ARTIST');
  const davi = await user('davi', 'Davi Rocha (demo)', 'ARTIST');
  const joao = await user('joao', 'João Bezerra (demo)', 'ARTIST');
  const bia = await user('bia', 'Bia Tenório (demo)', 'ARTIST');
  const tiago = await user('tiago', 'Tiago Ramos (demo)', 'ARTIST');
  const ravi = await user('ravi', 'Ravi Souza (demo)', 'ARTIST');
  const rafael = await user('rafael', 'Rafael Costa (demo)', 'CONTRACTOR');
  const marina = await user('marina', 'Marina Sururu (demo)', 'CONTRACTOR');
  const helena = await user('helena', 'Helena Duarte (demo)', 'CONTRACTOR');
  const carla = await user('carla', 'Carla Menezes (demo)', 'CONTRACTOR');
  const eduardo = await user('eduardo', 'Eduardo Lopes (demo)', 'CONTRACTOR');

  // ─────────── Perfis artísticos ───────────
  const portfolioRows = async (items: PortfolioSpec[]) =>
    Promise.all(items.map(async (p, i) => ({ ...p, description: p.description ?? '', thumbnailUrl: await resolveVideoThumbnail(p.url), position: i })));

  const solo = async (
    u: { id: string },
    data: { slug: string; name: string; headline: string; bio: string; city: string; genres: string[]; formats: string[]; since: number; fee: number; main: string; instruments: string[]; instagram: string },
    rider: RiderSpec,
    portfolio: PortfolioSpec[] = [],
  ) => {
    const found = await prisma.artist.findFirst({ where: { musicianProfile: { userId: u.id } }, select: { id: true } });
    if (found) return found;
    const profile = await prisma.musicianProfile.create({ data: { userId: u.id, mainInstrument: data.main, instruments: data.instruments } });
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
        visibility: 'PUBLIC',
        publishedAt: now,
        rider: { create: { notes: '', items: { create: rider.map(([id, q, notes]) => ({ catalogItemId: id, quantity: q, notes: notes ?? '' })) } } },
        portfolioItems: { create: await portfolioRows(portfolio) },
      },
      select: { id: true },
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
    [['mic-din', 1, 'Para voz, de preferência com chave'], ['di', 1], ['retorno', 1], ['pedestal', 2], ['banqueta', 1]],
    [
      { kind: 'VIDEO', title: 'Ao vivo no Galpão (vídeo de exemplo)', url: 'https://www.youtube.com/watch?v=RiderSync01' },
      { kind: 'AUDIO', title: 'EP "Maré Mansa" (link de exemplo)', url: 'https://open.spotify.com/album/ridersync-demo' },
    ],
  );
  await solo(
    lia,
    { slug: 'lia-ferraz-demo', name: 'Lia Ferraz', headline: 'Baixista de estúdio e palco', bio: 'Perfil FICTÍCIO de demonstração. Baixista de estúdio e palco, grava para artistas da cena local e acompanha shows de MPB e rock.', city: 'Maceió', genres: ['MPB', 'Rock'], formats: ['Com banda'], since: 2015, fee: 350, main: 'Baixo', instruments: [], instagram: 'liaferraz.demo' },
    [['amp-baixo', 1], ['di', 1]],
  );
  const joaoArtist = await solo(
    joao,
    { slug: 'joao-bezerra-demo', name: 'João Bezerra', headline: 'Sanfoneiro — forró de raiz', bio: 'Perfil FICTÍCIO de demonstração. Sanfoneiro de Arapiraca, forró de raiz para São João, festas e casamentos.', city: 'Arapiraca', genres: ['Forró', 'Coco de roda'], formats: ['Solo', 'Trio'], since: 2009, fee: 700, main: 'Sanfona', instruments: ['Voz'], instagram: 'joaobezerra.demo' },
    [['mic-cond', 1, 'Para a sanfona'], ['retorno', 1], ['banqueta', 1]],
    [{ kind: 'VIDEO', title: 'São João em Arapiraca (vídeo de exemplo)', url: 'https://youtu.be/RiderSync02' }],
  );
  const biaArtist = await solo(
    bia,
    { slug: 'bia-tenorio-demo', name: 'Bia Tenório', headline: 'Guitarra, sintetizador e bases', bio: 'Perfil FICTÍCIO de demonstração. Guitarrista e produtora; apresentações solo com guitarra, sintetizador e bases pré-gravadas.', city: 'Penedo', genres: ['Indie', 'Eletrônico'], formats: ['Solo', 'Com banda'], since: 2019, fee: 450, main: 'Guitarra', instruments: ['Teclado'], instagram: 'biatenorio.demo' },
    [['amp-gtr', 1], ['di', 2], ['sup-tec', 1]],
    [{ kind: 'VIDEO', title: 'Apresentação ao vivo (vídeo de exemplo)', url: 'https://www.youtube.com/watch?v=RiderSync03' }],
  );
  const tiagoArtist = await solo(
    tiago,
    { slug: 'tiago-ramos-demo', name: 'Tiago Ramos', headline: 'Rap autoral do agreste', bio: 'Perfil FICTÍCIO de demonstração. MC e compositor de Arapiraca; apresentações com DJ e bases próprias, letras sobre o cotidiano do interior.', city: 'Arapiraca', genres: ['Rap / Hip-hop'], formats: ['Solo', 'Duo'], since: 2018, fee: 400, main: 'Voz', instruments: ['DJ'], instagram: 'tiagoramos.demo' },
    [['mic-sf', 1], ['retorno', 2], ['mesa', 4, 'Entrada para o controlador do DJ']],
    [{ kind: 'VIDEO', title: 'Clipe de demonstração (vídeo de exemplo)', url: 'https://www.youtube.com/watch?v=RiderSync04' }],
  );

  const band = async (
    slug: string,
    creator: { id: string },
    data: Omit<Prisma.ArtistCreateInput, 'kind' | 'band' | 'slug' | 'rider' | 'portfolioItems'>,
    rider: { notes: string; items: Prisma.RiderItemCreateWithoutRiderInput[] },
    portfolio: PortfolioSpec[],
    members: { user: { id: string }; role: 'OWNER' | 'ADMIN' | 'MEMBER'; status: 'ACTIVE' | 'INVITED'; instrument: string }[],
  ) => {
    let artist = await prisma.artist.findUnique({ where: { slug }, select: { id: true, bandId: true } });
    if (!artist) {
      const b = await prisma.band.create({ data: { createdById: creator.id } });
      artist = await prisma.artist.create({
        data: { ...data, kind: 'BAND', band: { connect: { id: b.id } }, slug, visibility: 'PUBLIC', publishedAt: now, rider: { create: { notes: rider.notes, items: { create: rider.items } } }, portfolioItems: { create: await portfolioRows(portfolio) } },
        select: { id: true, bandId: true },
      });
    }
    for (const m of members) {
      const existing = await prisma.bandMember.findUnique({ where: { bandId_userId: { bandId: artist.bandId!, userId: m.user.id } } });
      if (existing) {
        if (!existing.instrument) await prisma.bandMember.update({ where: { id: existing.id }, data: { instrument: m.instrument } });
        continue;
      }
      await prisma.bandMember.create({
        data: {
          bandId: artist.bandId!,
          userId: m.user.id,
          role: m.role,
          status: m.status,
          instrument: m.instrument,
          joinedAt: m.status === 'ACTIVE' ? now : null,
          invitedById: m.role === 'OWNER' ? null : creator.id,
          invitedAt: m.role === 'OWNER' ? null : now,
        },
      });
    }
    return artist;
  };

  const mare = await band(
    'mare-alta-demo',
    ana,
    {
      name: 'Maré Alta',
      headline: 'Quarteto de forró e MPB',
      bio: 'Banda FICTÍCIA de demonstração. Quarteto que leva forró e MPB para palcos grandes, com muito coro com o público. Show de 1h30.',
      city: 'Maceió',
      genres: ['MPB', 'Forró'],
      formats: ['Com banda'],
      careerStartYear: 2019,
      baseFeeCents: 250000,
      instagram: 'marealta.demo',
    },
    {
      notes: 'Passagem de som de 40 minutos.',
      items: [
        { catalogItem: { connect: { id: 'mic-din' } }, quantity: 4 },
        { catalogItem: { connect: { id: 'di' } }, quantity: 3 },
        { catalogItem: { connect: { id: 'retorno' } }, quantity: 4 },
        { catalogItem: { connect: { id: 'bateria' } }, quantity: 1, notes: 'Pratos próprios' },
        { catalogItem: { connect: { id: 'amp-baixo' } }, quantity: 1 },
        { catalogItem: { connect: { id: 'mesa' } }, quantity: 16 },
        { customName: 'Zabumba com pele nova', customUnit: 'un', quantity: 1 },
      ],
    },
    [{ kind: 'VIDEO', title: 'Show completo (vídeo de exemplo)', url: 'https://www.youtube.com/watch?v=RiderSync05' }],
    [
      { user: ana, role: 'OWNER', status: 'ACTIVE', instrument: 'Vocal' },
      { user: davi, role: 'ADMIN', status: 'ACTIVE', instrument: 'Bateria' },
      { user: lia, role: 'MEMBER', status: 'ACTIVE', instrument: 'Baixo' },
      { user: joao, role: 'MEMBER', status: 'INVITED', instrument: 'Sanfona' },
    ],
  );
  const trio = await band(
    'trio-agreste-demo',
    joao,
    {
      name: 'Trio Agreste',
      headline: 'Forró pé-de-serra: sanfona, zabumba e triângulo',
      bio: 'Trio FICTÍCIO de demonstração. Forró pé-de-serra tradicional para festas juninas, casamentos e casas de forró.',
      city: 'Arapiraca',
      genres: ['Forró', 'Coco de roda'],
      formats: ['Trio'],
      careerStartYear: 2016,
      baseFeeCents: 150000,
      instagram: 'trioagreste.demo',
    },
    {
      notes: 'Precisamos de 3 retornos independentes.',
      items: [
        { catalogItem: { connect: { id: 'mic-din' } }, quantity: 3 },
        { catalogItem: { connect: { id: 'mic-cond' } }, quantity: 1, notes: 'Sanfona' },
        { catalogItem: { connect: { id: 'retorno' } }, quantity: 3 },
        { catalogItem: { connect: { id: 'banqueta' } }, quantity: 2 },
      ],
    },
    [{ kind: 'VIDEO', title: 'Arraiá ao vivo (vídeo de exemplo)', url: 'https://www.youtube.com/shorts/RiderSync06' }],
    [
      { user: joao, role: 'OWNER', status: 'ACTIVE', instrument: 'Sanfona' },
      { user: ravi, role: 'MEMBER', status: 'ACTIVE', instrument: 'Percussão' },
    ],
  );

  // ─────────── Contratantes ───────────
  const venue = async (slug: string, owner: { id: string }, data: Omit<Prisma.OrganizationCreateInput, 'slug' | 'type' | 'members' | 'equipment'>, equipment: RiderSpec, custom: { name: string; quantity: number }[] = []) => {
    const found = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (found) return found;
    return prisma.organization.create({
      data: {
        ...data,
        slug,
        type: 'VENUE',
        members: { create: [{ userId: owner.id, role: 'OWNER', status: 'ACTIVE', joinedAt: now }] },
        equipment: {
          create: [
            ...equipment.map(([id, quantity, notes]) => ({ catalogItemId: id, quantity, notes: notes ?? '' })),
            ...custom.map((c) => ({ customName: c.name, customUnit: 'un', quantity: c.quantity })),
          ],
        },
      },
      select: { id: true },
    });
  };

  const galpao = await venue(
    'galpao-jaragua-demo',
    rafael,
    {
      name: 'Galpão Jaraguá (demo)',
      venueKind: 'Casa de show',
      description: 'Casa FICTÍCIA de demonstração. Galpão com palco de 40 m², sistema de som próprio e programação de música autoral às sextas e sábados.',
      addressLine: 'Rua Fictícia, 100',
      neighborhood: 'Jaraguá',
      city: 'Maceió',
      capacity: 450,
      instagram: 'galpao.demo',
    },
    [['mic-din', 6, 'SM58'], ['mic-cond', 2], ['di', 2], ['retorno', 4], ['pa', 1], ['mesa', 24], ['pedestal', 8], ['bateria', 0, 'Bateria em manutenção'], ['palco', 40], ['energia', 6]],
    [{ name: 'Projetor', quantity: 1 }],
  );
  const sururu = await venue(
    'casa-sururu-demo',
    marina,
    { name: 'Casa Sururu (demo)', venueKind: 'Bar com música', description: 'Bar FICTÍCIO de demonstração, com música ao vivo de quinta a domingo.', neighborhood: 'Pajuçara', city: 'Maceió', capacity: 120 },
    [['mic-din', 2], ['retorno', 1], ['banqueta', 2]],
  );
  const teatro = await venue(
    'teatro-ribeirinho-demo',
    helena,
    { name: 'Teatro Ribeirinho (demo)', venueKind: 'Teatro', description: 'Teatro FICTÍCIO de demonstração às margens do São Francisco, com 300 lugares e acústica para shows intimistas.', addressLine: 'Avenida Fictícia, 12', neighborhood: 'Centro Histórico', city: 'Penedo', capacity: 300 },
    [['mic-din', 4], ['mic-cond', 4], ['di', 4], ['retorno', 4], ['pa', 1], ['mesa', 32], ['teclado', 1], ['luz', 12], ['camarim', 2]],
  );

  const individual = async (owner: { id: string; name: string }, slug: string, city: string) => {
    const m = await prisma.organizationMember.findFirst({ where: { userId: owner.id, organization: { type: 'INDIVIDUAL' } }, select: { organizationId: true } });
    if (m) return { id: m.organizationId };
    return prisma.organization.create({
      data: { type: 'INDIVIDUAL', slug, name: owner.name, city, members: { create: [{ userId: owner.id, role: 'OWNER', status: 'ACTIVE', joinedAt: now }] } },
      select: { id: true },
    });
  };
  const carlaOrg = await individual(carla, 'contratante-carla-demo', 'Maceió');
  const eduardoOrg = await individual(eduardo, 'contratante-eduardo-demo', 'Marechal Deodoro');

  // ─────────── Eventos ───────────
  const event = async (organizerId: string, createdById: string, data: Omit<Prisma.EventUncheckedCreateInput, 'organizerId' | 'createdById'>) => {
    const found = await prisma.event.findFirst({ where: { organizerId, title: data.title }, select: { id: true } });
    if (found) return found;
    return prisma.event.create({ data: { ...data, organizerId, createdById, publishedAt: data.status === 'DRAFT' ? null : now }, select: { id: true } });
  };
  const base = (title: string, status: EventStatus, visibility: EventVisibility, start: number, slots: number, extra: Partial<Prisma.EventUncheckedCreateInput> = {}) => ({
    title,
    status,
    visibility,
    startsAt: days(start),
    applicationDeadline: days(Math.max(start - 7, start < 0 ? start - 7 : 1), 23),
    slots,
    durationMinutes: 60,
    paymentType: 'Cachê fixo',
    feeCents: 80000,
    genres: ['MPB', 'Forró'],
    description: 'Evento FICTÍCIO de demonstração.',
    conditions: 'Som e luz do local. Passagem de som 2 horas antes.',
    notes: '',
    ...extra,
  });

  const sextaAutoral = await event(galpao.id, rafael.id, {
    ...base('Sexta Autoral — vagas para abertura (demo)', 'OPEN', 'PUBLIC', 21, 2, {
      description: 'Oportunidade FICTÍCIA de demonstração. Buscamos atrações de MPB/forró para abrir a noite.',
      notes: 'Repertório com ao menos 40% autoral.',
    }),
    venueId: galpao.id,
  });
  const noiteForro = await event(galpao.id, rafael.id, {
    ...base('Noite do Forró Pé-de-Serra (demo)', 'FILLED', 'PUBLIC', 14, 1, { genres: ['Forró'], feeCents: 150000, filledAt: now }),
    venueId: galpao.id,
  });
  const domingoMpb = await event(sururu.id, marina.id, {
    ...base('Domingo MPB na Pajuçara (demo)', 'FILLED', 'PUBLIC', 10, 1, { genres: ['MPB'], paymentType: 'Couvert artístico', feeCents: null, filledAt: now }),
    venueId: sururu.id,
  });
  const sextaIndie = await event(sururu.id, marina.id, {
    ...base('Sexta Indie (demo)', 'CANCELLED', 'PUBLIC', 18, 1, { genres: ['Indie', 'Rock'], cancelledAt: now }),
    venueId: sururu.id,
  });
  await event(teatro.id, helena.id, {
    ...base('Festival de Inverno do Ribeirinho (demo)', 'POSTPONED', 'PUBLIC', 40, 3, { genres: ['MPB', 'Instrumental'], postponedAt: now, feeCents: 120000 }),
    venueId: teatro.id,
  });
  const lancamento = await event(galpao.id, rafael.id, {
    ...base('Lançamento do EP da Maré Alta (demo)', 'COMPLETED', 'PUBLIC', -12, 1, { completedAt: now }),
    venueId: galpao.id,
  });
  const aniversario = await event(carlaOrg.id, carla.id, {
    ...base('Aniversário de 30 anos — festa particular (demo)', 'FILLED', 'PRIVATE', 30, 1, {
      description: 'Evento PRIVADO e FICTÍCIO de demonstração: festa de aniversário com voz e violão.',
      genres: ['MPB'],
      feeCents: 90000,
      filledAt: now,
    }),
    venueId: null,
    locationName: 'Salão de festas do condomínio',
    locationAddress: 'Rua Fictícia, 300',
    locationCity: 'Maceió',
    locationState: 'AL',
  });
  const arraia = await event(eduardoOrg.id, eduardo.id, {
    ...base('Arraiá do Condomínio Jardim (demo)', 'OPEN', 'PUBLIC', 35, 2, {
      description: 'Evento FICTÍCIO de demonstração organizado por contratante independente: arraiá aberto à vizinhança.',
      genres: ['Forró', 'Coco de roda'],
      feeCents: 100000,
    }),
    venueId: null,
    locationName: 'Praça central do condomínio',
    locationAddress: 'Avenida Fictícia, 45',
    locationCity: 'Marechal Deodoro',
    locationState: 'AL',
  });
  const casamento = await event(eduardoOrg.id, eduardo.id, {
    ...base('Recepção de casamento — seleção privada (demo)', 'OPEN', 'PRIVATE', 50, 1, {
      description: 'Evento PRIVADO e FICTÍCIO de demonstração: visível apenas para contas de artista.',
      genres: ['MPB', 'Instrumental'],
      feeCents: 180000,
    }),
    venueId: null,
    locationName: 'Sítio para eventos',
    locationCity: 'Marechal Deodoro',
    locationState: 'AL',
  });

  // ─────────── Candidaturas ───────────
  const application = async (eventId: string, artistId: string, submittedById: string, status: ApplicationStatus, message: string, decidedById?: string) => {
    const found = await prisma.eventApplication.findUnique({ where: { eventId_artistId: { eventId, artistId } }, select: { id: true } });
    if (found) return found;
    return prisma.eventApplication.create({
      data: { eventId, artistId, submittedById, status, message, ...(status !== 'PENDING' ? { decidedAt: now, decidedById: decidedById ?? null } : {}) },
      select: { id: true },
    });
  };
  await application(sextaAutoral.id, mare.id, ana.id, 'PENDING', 'Candidatura de demonstração: temos show de 1h com repertório autoral.');
  const biaApp = await application(sextaAutoral.id, biaArtist.id, bia.id, 'ACCEPTED', 'Apresentação solo de 50 minutos com repertório autoral.', rafael.id);
  await application(sextaAutoral.id, tiagoArtist.id, tiago.id, 'REJECTED', 'Rap autoral com DJ.', rafael.id);
  const trioApp = await application(noiteForro.id, trio.id, joao.id, 'ACCEPTED', 'Trio completo, 1h30 de forró pé-de-serra.', rafael.id);
  await application(arraia.id, joaoArtist.id, joao.id, 'PENDING', 'Sanfona e voz para o arraiá.');
  await application(casamento.id, biaArtist.id, bia.id, 'PENDING', 'Repertório instrumental para recepção.');
  await application(sextaIndie.id, biaArtist.id, bia.id, 'REJECTED', 'Set indie com guitarra e bases.', marina.id);

  // ─────────── Negociações ───────────
  const booking = async (
    key: { organizationId: string; artistId: string; title: string },
    data: { origin: 'DIRECT' | 'APPLICATION'; eventId?: string; applicationId?: string; createdById: string; status: BookingStatus },
    offers: { authorId: string; side: 'VENUE' | 'ARTIST'; at: Date; fee: number; status: 'PENDING' | 'ACCEPTED' | 'SUPERSEDED'; terms: string }[],
    messages: { authorId: string; side: 'VENUE' | 'ARTIST'; body: string }[] = [],
    performed = false,
  ) => {
    const found = await prisma.booking.findFirst({ where: key, select: { id: true } });
    if (found) return found;
    return prisma.$transaction(async (tx: Db) => {
      const b = await tx.booking.create({
        data: {
          ...key,
          origin: data.origin,
          eventId: data.eventId ?? null,
          applicationId: data.applicationId ?? null,
          createdById: data.createdById,
          status: data.status,
          ...(data.status === 'CONFIRMED' ? { confirmedAt: now, confirmedById: data.createdById } : {}),
        },
      });
      await tx.bookingStatusChange.create({ data: { bookingId: b.id, toStatus: 'NEGOTIATING', actorId: data.createdById, actorSide: 'VENUE', note: data.origin === 'DIRECT' ? 'Proposta direta' : 'Iniciada a partir de candidatura' } });
      let previous: string | null = null;
      for (const o of offers) {
        const created: { id: string } = await tx.bookingOffer.create({
          data: { bookingId: b.id, authorId: o.authorId, authorSide: o.side, previousOfferId: previous, performanceAt: o.at, durationMinutes: 90, feeCents: o.fee, terms: o.terms, status: o.status, ...(o.status !== 'PENDING' ? { respondedAt: now } : {}) },
          select: { id: true },
        });
        previous = created.id;
      }
      if (data.status === 'AGREED' || data.status === 'CONFIRMED') {
        await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'NEGOTIATING', toStatus: 'AGREED', actorId: data.createdById, note: 'Proposta aceita' } });
      }
      if (data.status === 'CONFIRMED') {
        await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'AGREED', toStatus: 'CONFIRMED', actorId: data.createdById, actorSide: 'VENUE', note: 'Contratação confirmada (pagamento é externo à plataforma)' } });
      }
      for (const m of messages) await tx.bookingMessage.create({ data: { bookingId: b.id, authorId: m.authorId, authorSide: m.side, body: m.body } });
      if (performed) {
        await tx.performance.create({ data: { bookingId: b.id, artistId: key.artistId, organizationId: key.organizationId, performedAt: offers[offers.length - 1].at, registeredById: data.createdById, notes: 'Casa cheia — apresentação de demonstração.' } });
      }
      return { id: b.id };
    });
  };

  await booking(
    { organizationId: galpao.id, artistId: anaArtist.id, title: 'Galpão Jaraguá × Ana Lins (demo)' },
    { origin: 'DIRECT', createdById: rafael.id, status: 'NEGOTIATING' },
    [{ authorId: rafael.id, side: 'VENUE', at: days(25), fee: 90000, status: 'PENDING', terms: 'Formato voz e violão. Som da casa.' }],
    [{ authorId: rafael.id, side: 'VENUE', body: 'Oi, Ana! Mensagem de demonstração: queremos você abrindo uma sexta.' }],
  );
  await booking(
    { organizationId: galpao.id, artistId: biaArtist.id, title: 'Sexta Autoral — Bia Tenório (demo)' },
    { origin: 'APPLICATION', eventId: sextaAutoral.id, applicationId: biaApp.id, createdById: rafael.id, status: 'NEGOTIATING' },
    [
      { authorId: rafael.id, side: 'VENUE', at: days(21), fee: 70000, status: 'SUPERSEDED', terms: 'Abertura de 45 minutos.' },
      { authorId: bia.id, side: 'ARTIST', at: days(21), fee: 85000, status: 'PENDING', terms: 'Abertura de 50 minutos; levo meu sintetizador.' },
    ],
    [{ authorId: bia.id, side: 'ARTIST', body: 'Enviei uma contraproposta com o cachê ajustado ao tempo de palco.' }],
  );
  await booking(
    { organizationId: galpao.id, artistId: trio.id, title: 'Noite do Forró — Trio Agreste (demo)' },
    { origin: 'APPLICATION', eventId: noiteForro.id, applicationId: trioApp.id, createdById: rafael.id, status: 'CONFIRMED' },
    [{ authorId: rafael.id, side: 'VENUE', at: days(14), fee: 150000, status: 'ACCEPTED', terms: 'Show de 1h30. Som e luz da casa.' }],
  );
  await booking(
    { organizationId: sururu.id, artistId: anaArtist.id, title: 'Domingo MPB na Pajuçara — Ana Lins (demo)' },
    { origin: 'DIRECT', eventId: domingoMpb.id, createdById: marina.id, status: 'CONFIRMED' },
    [{ authorId: marina.id, side: 'VENUE', at: days(10, 18), fee: 60000, status: 'ACCEPTED', terms: 'Voz e violão, couvert artístico integral para a artista.' }],
  );
  await booking(
    { organizationId: carlaOrg.id, artistId: anaArtist.id, title: 'Aniversário de 30 anos — Ana Lins (demo)' },
    { origin: 'DIRECT', eventId: aniversario.id, createdById: carla.id, status: 'CONFIRMED' },
    [{ authorId: carla.id, side: 'VENUE', at: days(30, 20), fee: 90000, status: 'ACCEPTED', terms: 'Duas entradas de 45 minutos.' }],
  );
  await booking(
    { organizationId: teatro.id, artistId: mare.id, title: 'Teatro Ribeirinho × Maré Alta (demo)' },
    { origin: 'DIRECT', createdById: helena.id, status: 'AGREED' },
    [{ authorId: helena.id, side: 'VENUE', at: days(45, 20), fee: 280000, status: 'ACCEPTED', terms: 'Show completo em formato acústico.' }],
  );
  await booking(
    { organizationId: galpao.id, artistId: mare.id, title: 'Lançamento do EP — Maré Alta (demo)' },
    { origin: 'DIRECT', eventId: lancamento.id, createdById: rafael.id, status: 'CONFIRMED' },
    [{ authorId: rafael.id, side: 'VENUE', at: days(-12), fee: 250000, status: 'ACCEPTED', terms: 'Show de lançamento.' }],
    [],
    true,
  );

  // ─────────── Notificações de exemplo ───────────
  const notes: Prisma.NotificationCreateManyInput[] = [
    { userId: ana.id, category: 'BOOKINGS', type: 'PROPOSAL_RECEIVED', title: 'Nova proposta de contratação', body: 'Galpão Jaraguá enviou uma proposta para você.', link: '/painel/negociacoes', dedupeKey: 'seed:ana:proposal' },
    { userId: ana.id, category: 'BOOKINGS', type: 'BOOKING_CONFIRMED', title: 'Contratação confirmada', body: 'Domingo MPB na Pajuçara foi confirmado.', link: '/painel/agenda', dedupeKey: 'seed:ana:confirmed' },
    { userId: rafael.id, category: 'APPLICATIONS', type: 'APPLICATION_RECEIVED', title: 'Nova candidatura: Sexta Autoral', body: 'Maré Alta se candidatou ao evento.', link: '/painel/casas', dedupeKey: 'seed:rafael:application' },
    { userId: rafael.id, category: 'BOOKINGS', type: 'COUNTER_OFFER', title: 'Nova contraproposta', body: 'Bia Tenório respondeu com uma contraproposta.', link: '/painel/negociacoes', dedupeKey: 'seed:rafael:counter' },
    { userId: joao.id, category: 'INVITATIONS', type: 'BAND_INVITE', title: 'Convite para a banda Maré Alta', body: 'Aceite ou recuse em Convites.', link: '/painel/convites', dedupeKey: 'seed:joao:invite' },
  ];
  await prisma.notification.createMany({ data: notes, skipDuplicates: true });

  console.warn(`Seed demo concluído. Contas fictícias (@demo.ridersync.local) com senha de demonstração: ${DEMO_PASSWORD}`);
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
