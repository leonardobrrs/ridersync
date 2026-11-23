/**
 * SEED DE VITRINE — DADOS FICTÍCIOS COM IMAGENS (staging/desenvolvimento).
 *
 * Complementa o `demo-seed.ts` com muito mais conteúdo (artistas, bandas, casas, eventos em todos os estados,
 * candidaturas, negociações, apresentações realizadas) e coloca imagens em perfis, portfólios (fotos), casas e
 * eventos — inclusive nos registros criados pelo seed de demonstração.
 *
 * - Bloqueado em produção; exige --force.
 * - Imagens: `backend/seed-assets/showcase/` (ou SHOWCASE_IMAGE_DIR), arquivos `<tag>-<n>.(jpg|png|webp)`,
 *   todos CC0/domínio público — créditos em `seed-assets/showcase/CREDITS.json`.
 *   Cada imagem passa pelo mesmo processamento da API (WebP principal + miniatura) e vai para o storage
 *   configurado (STORAGE_DRIVER=vercel-blob no staging; disco local no desenvolvimento).
 * - Contas no domínio reservado @demo.ridersync.local, senha DEMO_PASSWORD. Nomes, casas e eventos são fictícios.
 * - Idempotente: localiza cada entidade por chave estável e não duplica; só põe imagem onde ainda não há.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { AccountType, ApplicationStatus, BookingStatus, EventStatus, EventVisibility, PrismaClient } from '@prisma/client';
import { processImage } from '../modules/media/image-processing';
import { LocalStorageDriver, StorageDriver, VercelBlobStorageDriver } from '../modules/media/storage';
import { PRIVACY_POLICY_VERSION } from '../modules/auth/auth.service';
import { hashPassword } from '../modules/auth/password';
import { DEMO_PASSWORD, runDemoSeed } from './demo-seed';
import { fakeCnpj, fakeCpf } from './fake-documents';

if (existsSync('.env')) process.loadEnvFile('.env');

const D = (local: string) => `${local}@demo.ridersync.local`;
/** Data relativa a hoje, no horário de Maceió (UTC-3). */
const days = (n: number, hour = 21, minute = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(hour + 3, minute, 0, 0);
  return d;
};

// ─────────── Imagens ───────────
class ImagePool {
  private readonly byTag = new Map<string, string[]>();
  private readonly cursor = new Map<string, number>();
  private readonly cache = new Map<string, Buffer>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageDriver,
    dir: string,
  ) {
    for (const f of readdirSync(dir).sort()) {
      const m = /^(.+)-\d+\.(jpe?g|png|webp)$/i.exec(f);
      if (!m) continue;
      const list = this.byTag.get(m[1]) ?? [];
      list.push(path.join(dir, f));
      this.byTag.set(m[1], list);
    }
  }

  tags() {
    return [...this.byTag.entries()].map(([t, l]) => `${t}:${l.length}`).join(' ');
  }

  /** Próxima imagem da tag (round-robin); tags alternativas se a primeira não existir. */
  private next(...tags: string[]) {
    for (const t of tags) {
      const list = this.byTag.get(t);
      if (!list?.length) continue;
      const i = this.cursor.get(t) ?? 0;
      this.cursor.set(t, i + 1);
      return list[i % list.length];
    }
    throw new Error(`Sem imagens para ${tags.join('/')}`);
  }

  /** Processa (WebP + miniatura), grava no storage e cria o MediaAsset. */
  async asset(uploadedById: string, ...tags: string[]) {
    const file = this.next(...tags);
    let buffer = this.cache.get(file);
    if (!buffer) {
      buffer = readFileSync(file);
      this.cache.set(file, buffer);
    }
    const img = await processImage(buffer);
    const now = new Date();
    const base = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
    const key = `${base}.webp`;
    const thumbKey = `${base}-thumb.webp`;
    await this.storage.put(key, img.main, 'image/webp');
    await this.storage.put(thumbKey, img.thumb, 'image/webp');
    const asset = await this.prisma.mediaAsset.create({
      data: {
        storageKey: key,
        thumbKey,
        kind: 'IMAGE',
        mimeType: 'image/webp',
        sizeBytes: img.main.length,
        width: img.width,
        height: img.height,
        originalName: `${path.basename(file).replace(/\.[^.]+$/, '')}.webp`,
        uploadedById,
      },
      select: { id: true },
    });
    return asset.id;
  }
}

function storageFromEnv(): StorageDriver {
  if (process.env.STORAGE_DRIVER === 'vercel-blob') return new VercelBlobStorageDriver(process.env.BLOB_READ_WRITE_TOKEN);
  return new LocalStorageDriver(process.env.STORAGE_LOCAL_DIR ?? './storage');
}

// ─────────── Conteúdo ───────────
type Rider = [string, number, string?][];
interface SoloSpec {
  local: string;
  person: string;
  slug: string;
  name: string;
  headline: string;
  bio: string;
  city: string;
  genres: string[];
  formats: string[];
  since: number;
  fee: number | null;
  main: string;
  instruments: string[];
  instagram: string;
  img: string[];
  rider: Rider;
  audio?: string;
}

const SOLOS: SoloSpec[] = [
  { local: 'caio', person: 'Caio Vasconcelos', slug: 'caio-vasconcelos-demo', name: 'Caio Sax', headline: 'Saxofone para jazz, bossa e eventos', bio: 'Saxofonista formado no conservatório, toca jazz, bossa nova e choro. Faz apresentações solo com bases, em duo com piano ou com quinteto completo. Repertório para bares, recepções e festivais.', city: 'Maceió', genres: ['Jazz', 'Instrumental', 'MPB'], formats: ['Solo', 'Duo', 'Com banda'], since: 2012, fee: 800, main: 'Sopros', instruments: ['Teclado'], instagram: 'caiosax.demo', img: ['sax', 'trumpet'], rider: [['mic-cond', 1, 'Para o sax'], ['retorno', 1], ['di', 1, 'Bases'], ['pedestal', 1]], audio: 'https://open.spotify.com/album/ridersync-demo-caio' },
  { local: 'marilia', person: 'Marília Brandão', slug: 'marilia-brandao-demo', name: 'Marília Brandão', headline: 'Samba de raiz e pagode com roda', bio: 'Cantora de samba criada nas rodas da Ponta Grossa. Repertório de samba de raiz, pagode dos anos 90 e composições próprias. Formato com cavaquinho, violão de 7 e percussão.', city: 'Maceió', genres: ['Samba', 'Pagode'], formats: ['Com banda', 'Trio'], since: 2014, fee: 900, main: 'Voz', instruments: ['Percussão'], instagram: 'mariliabrandao.demo', img: ['mic'], rider: [['mic-din', 4], ['retorno', 3], ['banqueta', 3], ['di', 2]] },
  { local: 'renato', person: 'Renato Amorim', slug: 'dj-renato-amorim-demo', name: 'DJ Renato Amorim', headline: 'House, disco e brasilidades para pista', bio: 'DJ residente de festas na orla. Sets de house, nu-disco e remixes de música brasileira, de 2 a 5 horas. Leva controladora própria; precisa de mesa e monitores.', city: 'Maceió', genres: ['Eletrônico', 'Pop'], formats: ['Solo'], since: 2016, fee: 1200, main: 'DJ', instruments: [], instagram: 'renatoamorim.demo', img: ['dj', 'synth'], rider: [['mesa', 2, 'Duas entradas estéreo'], ['retorno', 2], ['energia', 2]] },
  { local: 'julia', person: 'Júlia Cavalcante', slug: 'julia-cavalcante-demo', name: 'Júlia Cavalcante', headline: 'Piano e voz — MPB e jazz intimista', bio: 'Pianista e cantora. Shows intimistas de MPB, jazz e canções autorais, ideais para teatros, restaurantes e recepções. Também acompanha cantores e grava em estúdio.', city: 'Maceió', genres: ['MPB', 'Jazz'], formats: ['Solo', 'Duo'], since: 2015, fee: 750, main: 'Teclado', instruments: ['Voz'], instagram: 'juliacavalcante.demo', img: ['keys'], rider: [['teclado', 1, '88 teclas, pesado'], ['sup-tec', 1], ['mic-din', 1], ['retorno', 1], ['banqueta', 1]] },
  { local: 'pedro', person: 'Pedro Albuquerque', slug: 'pedro-albuquerque-demo', name: 'Pedro Albuquerque', headline: 'Sertanejo e modão no violão', bio: 'Cantor e violeiro do agreste. Modão, sertanejo universitário e clássicos do forró, em voz e violão ou com banda de apoio. Muito pedido em festas e bares de Arapiraca.', city: 'Arapiraca', genres: ['Sertanejo', 'Forró'], formats: ['Solo', 'Com banda'], since: 2013, fee: 650, main: 'Violão', instruments: ['Voz'], instagram: 'pedroalbuquerque.demo', img: ['guitar'], rider: [['mic-din', 1], ['di', 1], ['retorno', 1], ['banqueta', 1], ['pedestal', 2]] },
  { local: 'nanda', person: 'Nanda Oliveira', slug: 'nanda-oliveira-demo', name: 'Nanda Oliveira', headline: 'Pop, brega e hits para dançar', bio: 'Cantora de pop e brega romântico com banda ou playback ao vivo. Show dançante de 2 horas com figurino e coreografia; animação para casamentos e festas.', city: 'Rio Largo', genres: ['Pop', 'Brega'], formats: ['Solo', 'Com banda'], since: 2018, fee: 1000, main: 'Voz', instruments: [], instagram: 'nandaoliveira.demo', img: ['mic'], rider: [['mic-sf', 1], ['iem', 1], ['retorno', 2], ['mesa', 4]] },
  { local: 'zecicero', person: 'José Cícero', slug: 'ze-cicero-demo', name: 'Zé Cícero', headline: 'Percussão e coco de roda', bio: 'Mestre percussionista de coco de roda e ciranda. Conduz rodas com ganzá, zabumba e pandeiro, e oficinas de percussão para escolas e projetos culturais.', city: 'Marechal Deodoro', genres: ['Coco de roda', 'Forró'], formats: ['Solo', 'Trio', 'Com banda'], since: 2001, fee: 500, main: 'Percussão', instruments: ['Voz'], instagram: 'zecicero.demo', img: ['percussion', 'pandeiro'], rider: [['mic-din', 2], ['mic-cond', 2, 'Para a percussão'], ['retorno', 1]] },
  { local: 'lucas', person: 'Lucas Farias', slug: 'lucas-farias-demo', name: 'Lucas Farias', headline: 'Guitarra rock e blues', bio: 'Guitarrista de rock e blues, com repertório de clássicos e autorais. Toca em power trio ou como guitarrista contratado para bandas e gravações.', city: 'Palmeira dos Índios', genres: ['Rock', 'Indie'], formats: ['Solo', 'Com banda'], since: 2011, fee: 550, main: 'Guitarra', instruments: ['Voz', 'Baixo'], instagram: 'lucasfarias.demo', img: ['eguitar'], rider: [['amp-gtr', 1, 'Valvulado, se possível'], ['mic-din', 2], ['retorno', 1], ['energia', 2]] },
  { local: 'rebeca', person: 'Rebeca Lima', slug: 'rebeca-lima-demo', name: 'Rebeca Lima', headline: 'Violino para cerimônias e concertos', bio: 'Violinista com repertório erudito, popular e gospel. Cerimônias de casamento, recepções e concertos de câmara; solo, duo com piano ou quarteto de cordas.', city: 'Maceió', genres: ['Instrumental', 'Gospel'], formats: ['Solo', 'Duo'], since: 2010, fee: 700, main: 'Cordas', instruments: [], instagram: 'rebecalima.demo', img: ['violin'], rider: [['mic-cond', 1], ['retorno', 1], ['pedestal', 1]] },
  { local: 'thiago', person: 'Thiago Melo', slug: 'thiago-melo-demo', name: 'Thiago Trombone', headline: 'Metais: trombone, frevo e gafieira', bio: 'Trombonista de orquestras de frevo e gafieira. Faz naipe de metais para bandas, gravações e apresentações instrumentais.', city: 'Maceió', genres: ['Instrumental', 'Samba', 'Jazz'], formats: ['Solo', 'Com banda'], since: 2009, fee: 450, main: 'Sopros', instruments: [], instagram: 'thiagotrombone.demo', img: ['trombone', 'trumpet', 'sax'], rider: [['mic-cond', 1], ['retorno', 1]] },
  { local: 'gabi', person: 'Gabriela Nunes', slug: 'gabi-nunes-demo', name: 'Gabi Nunes', headline: 'Reggae e pop praiano com ukulele', bio: 'Cantora de reggae e pop acústico com ukulele e violão. Pôr do sol em bares de praia, luaus e festas ao ar livre no litoral norte.', city: 'Maragogi', genres: ['Reggae', 'Pop'], formats: ['Solo', 'Duo'], since: 2019, fee: 400, main: 'Voz', instruments: ['Violão', 'Cordas'], instagram: 'gabinunes.demo', img: ['ukulele', 'guitar'], rider: [['mic-din', 1], ['di', 1], ['retorno', 1], ['banqueta', 1]] },
  { local: 'damiao', person: 'Damião Ferreira', slug: 'mestre-damiao-demo', name: 'Mestre Damião', headline: 'Sanfona do sertão alagoano', bio: 'Sanfoneiro de Delmiro Gouveia com mais de 30 anos de estrada. Xote, baião e xaxado em trio pé-de-serra; atração de São João e festas de padroeiro.', city: 'Delmiro Gouveia', genres: ['Forró'], formats: ['Trio', 'Com banda'], since: 1992, fee: 1100, main: 'Sanfona', instruments: ['Voz'], instagram: 'mestredamiao.demo', img: ['accordion'], rider: [['mic-cond', 1, 'Sanfona'], ['mic-din', 2], ['retorno', 2], ['banqueta', 2]] },
  { local: 'clara', person: 'Clara Torres', slug: 'clara-torres-demo', name: 'Clara Torres', headline: 'Cavaquinho, choro e samba', bio: 'Cavaquinista de choro e samba. Toca em rodas, acompanha cantores e faz apresentações instrumentais de choro com regional.', city: 'Penedo', genres: ['Samba', 'Instrumental'], formats: ['Solo', 'Com banda'], since: 2014, fee: 380, main: 'Cordas', instruments: ['Violão'], instagram: 'claratorres.demo', img: ['cavaquinho', 'guitar'], rider: [['mic-cond', 1], ['di', 1], ['retorno', 1], ['banqueta', 1]] },
];

interface BandSpec {
  slug: string;
  owner: string;
  name: string;
  headline: string;
  bio: string;
  city: string;
  genres: string[];
  since: number;
  fee: number;
  instagram: string;
  img: string[];
  rider: Rider;
  members: [string, 'OWNER' | 'ADMIN' | 'MEMBER', string][];
}
const BANDS: BandSpec[] = [
  { slug: 'coco-do-sereno-demo', owner: 'zecicero', name: 'Coco do Sereno', headline: 'Coco de roda, ciranda e cultura popular', bio: 'Grupo de coco de roda de Marechal Deodoro. Leva tambores, ganzás e coro para festas populares, eventos culturais e escolas, convidando o público para a roda.', city: 'Marechal Deodoro', genres: ['Coco de roda', 'Forró'], since: 2008, fee: 1800, instagram: 'cocodosereno.demo', img: ['percussion', 'pandeiro'], rider: [['mic-din', 5], ['mic-cond', 2], ['retorno', 3]], members: [['zecicero', 'OWNER', 'Percussão'], ['clara', 'MEMBER', 'Cordas'], ['gabi', 'MEMBER', 'Vocal de apoio']] },
  { slug: 'os-malungos-demo', owner: 'marilia', name: 'Os Malungos', headline: 'Roda de samba e pagode', bio: 'Roda de samba com repertório de clássicos e pagode dos anos 90. Formação com cavaquinho, violão de 7 cordas, pandeiro, tantã e voz. Show de até 3 horas.', city: 'Maceió', genres: ['Samba', 'Pagode'], since: 2015, fee: 2200, instagram: 'osmalungos.demo', img: ['cavaquinho', 'pandeiro', 'percussion'], rider: [['mic-din', 5], ['retorno', 4], ['banqueta', 5], ['di', 2], ['mesa', 12]], members: [['marilia', 'OWNER', 'Vocal'], ['clara', 'ADMIN', 'Cordas'], ['zecicero', 'MEMBER', 'Percussão'], ['thiago', 'MEMBER', 'Sopros']] },
  { slug: 'brisa-eletrica-demo', owner: 'lucas', name: 'Brisa Elétrica', headline: 'Rock autoral do agreste', bio: 'Power trio de rock autoral com influências de rock brasileiro dos anos 80 e indie. Dois discos lançados e shows em festivais independentes do Nordeste.', city: 'Palmeira dos Índios', genres: ['Rock', 'Indie'], since: 2017, fee: 1600, instagram: 'brisaeletrica.demo', img: ['drums', 'eguitar', 'bass'], rider: [['amp-gtr', 1], ['amp-baixo', 1], ['bateria', 1, 'Pratos próprios'], ['mic-din', 6], ['retorno', 3], ['mesa', 16]], members: [['lucas', 'OWNER', 'Guitarra'], ['lia', 'MEMBER', 'Baixo'], ['davi', 'MEMBER', 'Bateria']] },
  { slug: 'quinteto-lagoa-demo', owner: 'caio', name: 'Quinteto Lagoa', headline: 'Jazz brasileiro e música instrumental', bio: 'Quinteto de jazz brasileiro: sax, trombone, piano, violino e percussão. Arranjos próprios de clássicos da MPB e composições autorais para teatros e festivais.', city: 'Maceió', genres: ['Jazz', 'Instrumental', 'MPB'], since: 2018, fee: 3000, instagram: 'quintetolagoa.demo', img: ['sax', 'keys', 'drums'], rider: [['teclado', 1], ['mic-cond', 4], ['mic-din', 2], ['retorno', 5], ['di', 2], ['mesa', 16], ['luz', 8]], members: [['caio', 'OWNER', 'Sopros'], ['julia', 'ADMIN', 'Teclado'], ['thiago', 'MEMBER', 'Sopros'], ['rebeca', 'MEMBER', 'Cordas'], ['zecicero', 'MEMBER', 'Percussão']] },
];

interface VenueSpec {
  slug: string;
  owner: string;
  name: string;
  kind: string;
  description: string;
  address?: string;
  neighborhood: string;
  city: string;
  capacity: number;
  instagram: string;
  img: string[];
  equipment: Rider;
}
const VENUES: VenueSpec[] = [
  { slug: 'armazem-pajucara-demo', owner: 'fernanda', name: 'Armazém Pajuçara', kind: 'Casa de show', description: 'Antigo armazém de açúcar transformado em casa de shows, a duas quadras da orla. Palco de 60 m², som line array e programação de quinta a sábado com artistas locais e nacionais.', address: 'Rua Fictícia do Porto, 210', neighborhood: 'Pajuçara', city: 'Maceió', capacity: 600, instagram: 'armazempajucara.demo', img: ['venue-warehouse', 'venue-hall'], equipment: [['pa', 1], ['mesa', 32], ['mic-din', 8], ['mic-cond', 4], ['di', 4], ['retorno', 6], ['bateria', 1], ['amp-gtr', 1], ['amp-baixo', 1], ['palco', 60], ['luz', 24], ['camarim', 2], ['energia', 10]] },
  { slug: 'bar-do-cais-demo', owner: 'fernanda', name: 'Bar do Cais', kind: 'Bar com música', description: 'Bar à beira do cais com música ao vivo de quarta a domingo: voz e violão no fim de tarde, samba e choro aos sábados.', neighborhood: 'Jaraguá', city: 'Maceió', capacity: 150, instagram: 'bardocais.demo', img: ['venue-bar', 'venue-pub'], equipment: [['pa', 1], ['mesa', 8], ['mic-din', 3], ['retorno', 2], ['banqueta', 3], ['pedestal', 3]] },
  { slug: 'teatro-sete-coqueiros-demo', owner: 'gustavo', name: 'Teatro Sete Coqueiros', kind: 'Teatro', description: 'Teatro de 420 lugares com acústica tratada, fosso para orquestra e camarins. Recebe concertos, MPB, jazz e espetáculos de dança.', address: 'Praça Fictícia, 7', neighborhood: 'Centro', city: 'Maceió', capacity: 420, instagram: 'teatrosetecoqueiros.demo', img: ['venue-theater'], equipment: [['pa', 1], ['mesa', 48], ['mic-cond', 8], ['mic-din', 6], ['di', 6], ['retorno', 8], ['teclado', 1], ['luz', 48], ['camarim', 4], ['palco', 80]] },
  { slug: 'espaco-mandacaru-demo', owner: 'luana', name: 'Espaço Cultural Mandacaru', kind: 'Espaço cultural', description: 'Centro cultural independente com palco, galeria e cineclube. Shows autorais, saraus e oficinas para a cena do agreste.', neighborhood: 'Centro', city: 'Arapiraca', capacity: 250, instagram: 'espacomandacaru.demo', img: ['venue-colonial', 'venue-cafe'], equipment: [['pa', 1], ['mesa', 16], ['mic-din', 4], ['di', 2], ['retorno', 3], ['luz', 12], ['palco', 30]] },
  { slug: 'mare-cheia-restaurante-demo', owner: 'roberto', name: 'Maré Cheia Restaurante', kind: 'Restaurante', description: 'Restaurante pé na areia com música ambiente ao vivo no jantar e luau aos sábados de lua cheia.', neighborhood: 'Praia de Antunes', city: 'Maragogi', capacity: 120, instagram: 'marecheia.demo', img: ['venue-beach', 'venue-restaurant'], equipment: [['mesa', 6], ['mic-din', 2], ['retorno', 1], ['banqueta', 2]] },
  { slug: 'quintal-do-coco-demo', owner: 'roberto', name: 'Quintal do Coco', kind: 'Bar com música', description: 'Quintal arborizado no centro histórico com forró, coco de roda e comida regional. Rodas abertas às sextas.', neighborhood: 'Centro Histórico', city: 'Marechal Deodoro', capacity: 200, instagram: 'quintaldococo.demo', img: ['venue-restaurant', 'venue-bar'], equipment: [['pa', 1], ['mesa', 12], ['mic-din', 4], ['retorno', 2], ['banqueta', 4]] },
  { slug: 'clube-do-vinil-demo', owner: 'silvia', name: 'Clube do Vinil', kind: 'Bar com música', description: 'Bar de discos com pista pequena: noites de jazz às quartas, DJs de vinil às sextas e sábados.', neighborhood: 'Ponta Verde', city: 'Maceió', capacity: 90, instagram: 'clubedovinil.demo', img: ['venue-club', 'venue-pub'], equipment: [['mesa', 8], ['retorno', 2], ['mic-din', 2], ['teclado', 1], ['energia', 4]] },
  { slug: 'casa-da-ribeira-demo', owner: 'antonio', name: 'Casa da Ribeira', kind: 'Espaço cultural', description: 'Casarão colonial às margens do São Francisco com pátio para shows, recitais e festas de padroeiro.', neighborhood: 'Centro Histórico', city: 'Penedo', capacity: 180, instagram: 'casadaribeira.demo', img: ['venue-colonial', 'venue-cafe'], equipment: [['pa', 1], ['mesa', 12], ['mic-din', 4], ['mic-cond', 2], ['retorno', 2], ['luz', 8]] },
  { slug: 'galpao-sertao-demo', owner: 'antonio', name: 'Galpão Sertão', kind: 'Casa de show', description: 'Maior casa de forró do sertão alagoano: pista de 800 pessoas, palco giratório e temporada junina com três atrações por noite.', neighborhood: 'Centro', city: 'Delmiro Gouveia', capacity: 800, instagram: 'galpaosertao.demo', img: ['venue-hall', 'venue-warehouse'], equipment: [['pa', 1], ['mesa', 32], ['mic-din', 10], ['mic-cond', 4], ['retorno', 6], ['bateria', 1], ['palco', 70], ['luz', 30], ['camarim', 3], ['energia', 12]] },
];

const CONTRACTORS: [string, string][] = [
  ['fernanda', 'Fernanda Acioli'],
  ['gustavo', 'Gustavo Pimentel'],
  ['luana', 'Luana Barros'],
  ['roberto', 'Roberto Sá'],
  ['silvia', 'Sílvia Moura'],
  ['antonio', 'Antônio Ferro'],
  ['paula', 'Paula Rezende'],
  ['marcos', 'Marcos Tavares'],
];

export async function runShowcaseSeed(prisma: PrismaClient, imageDir: string) {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed de vitrine bloqueado em produção.');
  const pool = new ImagePool(prisma, storageFromEnv(), imageDir);
  console.warn(`Imagens disponíveis: ${pool.tags()}`);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  const user = async (local: string, name: string, accountType: AccountType) => {
    const email = D(local);
    const found = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
    if (found) return found;
    return prisma.user.create({
      data: { email, name, passwordHash, accountType, emailVerifiedAt: now, termsAcceptedAt: now, termsVersion: PRIVACY_POLICY_VERSION, cpf: fakeCpf(email), legalName: name },
      select: { id: true, name: true },
    });
  };
  const byEmail = async (local: string) => prisma.user.findUniqueOrThrow({ where: { email: D(local) }, select: { id: true, name: true } });

  const U: Record<string, { id: string; name: string }> = {};
  for (const s of SOLOS) U[s.local] = await user(s.local, s.person, 'ARTIST');
  for (const [local, name] of CONTRACTORS) U[local] = await user(local, name, 'CONTRACTOR');
  for (const local of ['ana', 'lia', 'davi', 'joao', 'bia', 'tiago', 'ravi', 'rafael', 'marina', 'helena', 'carla', 'eduardo']) U[local] = await byEmail(local);

  const photos = async (artistId: string, uploaderId: string, tags: string[], titles: string[]) => {
    const existing = await prisma.portfolioItem.count({ where: { artistId, kind: 'PHOTO' } });
    if (existing) return;
    const start = await prisma.portfolioItem.count({ where: { artistId } });
    for (let i = 0; i < titles.length; i++) {
      const mediaId = await pool.asset(uploaderId, tags[i % tags.length], ...tags, 'ev-stage');
      await prisma.portfolioItem.create({ data: { artistId, kind: 'PHOTO', title: titles[i], description: '', mediaId, position: start + i } });
    }
  };

  // ─────────── Artistas solo ───────────
  const A: Record<string, string> = {};
  for (const s of SOLOS) {
    let artist = await prisma.artist.findUnique({ where: { slug: s.slug }, select: { id: true } });
    if (!artist) {
      const profile = await prisma.musicianProfile.create({ data: { userId: U[s.local].id, mainInstrument: s.main, instruments: s.instruments } });
      artist = await prisma.artist.create({
        data: {
          kind: 'SOLO',
          musicianProfileId: profile.id,
          slug: s.slug,
          name: s.name,
          headline: s.headline,
          bio: s.bio,
          city: s.city,
          genres: s.genres,
          formats: s.formats,
          careerStartYear: s.since,
          baseFeeCents: s.fee == null ? null : s.fee * 100,
          instagram: s.instagram,
          visibility: 'PUBLIC',
          publishedAt: now,
          rider: { create: { notes: '', items: { create: s.rider.map(([id, q, notes]) => ({ catalogItemId: id, quantity: q, notes: notes ?? '' })) } } },
          portfolioItems: s.audio ? { create: [{ kind: 'AUDIO', title: 'Faixas no streaming (link de exemplo)', url: s.audio, position: 0 }] } : undefined,
        },
        select: { id: true },
      });
    }
    A[s.local] = artist.id;
    await photos(artist.id, U[s.local].id, s.img, ['Ao vivo', 'Passagem de som', 'Bastidores']);
  }

  // ─────────── Bandas ───────────
  for (const b of BANDS) {
    let artist = await prisma.artist.findUnique({ where: { slug: b.slug }, select: { id: true, bandId: true } });
    const creator = U[b.owner];
    if (!artist) {
      const band = await prisma.band.create({ data: { createdById: creator.id } });
      artist = await prisma.artist.create({
        data: {
          kind: 'BAND',
          band: { connect: { id: band.id } },
          slug: b.slug,
          name: b.name,
          headline: b.headline,
          bio: b.bio,
          city: b.city,
          genres: b.genres,
          formats: ['Com banda'],
          careerStartYear: b.since,
          baseFeeCents: b.fee * 100,
          instagram: b.instagram,
          visibility: 'PUBLIC',
          publishedAt: now,
          rider: { create: { notes: 'Passagem de som de 40 minutos.', items: { create: b.rider.map(([id, q, notes]) => ({ catalogItemId: id, quantity: q, notes: notes ?? '' })) } } },
        },
        select: { id: true, bandId: true },
      });
      for (const [local, role, instrument] of b.members) {
        await prisma.bandMember.create({
          data: { bandId: artist.bandId!, userId: U[local].id, role, status: 'ACTIVE', instrument, joinedAt: now, invitedById: role === 'OWNER' ? null : creator.id, invitedAt: role === 'OWNER' ? null : now },
        });
      }
    }
    A[b.slug] = artist.id;
    await photos(artist.id, creator.id, b.img, ['Show de lançamento', 'Palco principal', 'Ensaio aberto', 'Na estrada']);
  }
  for (const slug of ['ana-lins-demo', 'lia-ferraz-demo', 'joao-bezerra-demo', 'bia-tenorio-demo', 'tiago-ramos-demo', 'mare-alta-demo', 'trio-agreste-demo']) {
    const a = await prisma.artist.findUnique({ where: { slug }, select: { id: true } });
    if (a) A[slug] = a.id;
  }

  // ─────────── Casas e contratantes independentes ───────────
  const V: Record<string, string> = {};
  for (const v of VENUES) {
    let org = await prisma.organization.findUnique({ where: { slug: v.slug }, select: { id: true } });
    if (!org) {
      org = await prisma.organization.create({
        data: {
          slug: v.slug,
          type: 'VENUE',
          name: v.name,
          cnpj: fakeCnpj(v.slug),
          legalName: `${v.name} Ltda`,
          venueKind: v.kind,
          description: v.description,
          addressLine: v.address ?? null,
          neighborhood: v.neighborhood,
          city: v.city,
          capacity: v.capacity,
          instagram: v.instagram,
          members: { create: [{ userId: U[v.owner].id, role: 'OWNER', status: 'ACTIVE', joinedAt: now }] },
          equipment: { create: v.equipment.map(([id, quantity, notes]) => ({ catalogItemId: id, quantity, notes: notes ?? '' })) },
        },
        select: { id: true },
      });
    }
    V[v.slug] = org.id;
  }
  for (const slug of ['galpao-jaragua-demo', 'casa-sururu-demo', 'teatro-ribeirinho-demo']) {
    const o = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (o) V[slug] = o.id;
  }
  const individual = async (local: string, slug: string, city: string) => {
    const m = await prisma.organizationMember.findFirst({ where: { userId: U[local].id, organization: { type: 'INDIVIDUAL' } }, select: { organizationId: true } });
    if (m) return m.organizationId;
    const o = await prisma.organization.create({
      data: { type: 'INDIVIDUAL', slug, name: U[local].name, city, members: { create: [{ userId: U[local].id, role: 'OWNER', status: 'ACTIVE', joinedAt: now }] } },
      select: { id: true },
    });
    return o.id;
  };
  V.paula = await individual('paula', 'contratante-paula-demo', 'Maceió');
  V.marcos = await individual('marcos', 'contratante-marcos-demo', 'Rio Largo');

  // ─────────── Eventos ───────────
  type Ev = {
    key: string;
    org: string;
    by: string;
    title: string;
    status: EventStatus;
    visibility?: EventVisibility;
    start: number;
    hour?: number;
    deadline?: number;
    slots: number;
    duration?: number;
    genres: string[];
    fee: number | null;
    payment?: string;
    description: string;
    requirements?: string;
    img: string[];
    location?: { name: string; address?: string; city: string };
  };
  const EVENTS: Ev[] = [
    { key: 'verao', org: 'armazem-pajucara-demo', by: 'fernanda', title: 'Festival Verão no Armazém', status: 'OPEN', start: 32, hour: 18, slots: 4, duration: 60, genres: ['MPB', 'Pop', 'Samba'], fee: 150000, description: 'Festival de abertura do verão com quatro atrações locais, das 18h à meia-noite. Buscamos artistas com show dançante e boa presença de palco.', requirements: 'Show de 60 minutos; vídeo ao vivo recente no portfólio.', img: ['ev-festival', 'ev-crowd'] },
    { key: 'quinta-autoral', org: 'armazem-pajucara-demo', by: 'fernanda', title: 'Quinta Autoral', status: 'OPEN', start: 16, slots: 2, duration: 50, genres: ['Indie', 'Rock', 'MPB'], fee: 60000, description: 'Noite dedicada a música autoral de Alagoas. Duas bandas por noite, com divulgação nas redes da casa.', requirements: 'Pelo menos 70% de repertório autoral.', img: ['ev-stage', 'ev-lights'] },
    { key: 'samba-sabado', org: 'bar-do-cais-demo', by: 'fernanda', title: 'Sábado de Samba no Cais', status: 'OPEN', start: 9, hour: 17, slots: 1, duration: 180, genres: ['Samba', 'Pagode'], fee: 120000, description: 'Roda de samba de fim de tarde com vista para o cais. Procuramos grupo com repertório de clássicos.', img: ['ev-live', 'ev-lights'] },
    { key: 'por-do-sol', org: 'bar-do-cais-demo', by: 'fernanda', title: 'Pôr do Sol Acústico', status: 'FILLED', start: 6, hour: 17, slots: 1, duration: 120, genres: ['MPB', 'Reggae'], fee: 50000, description: 'Voz e violão no fim de tarde, de frente para o mar.', img: ['ev-live'] },
    { key: 'concerto-cordas', org: 'teatro-sete-coqueiros-demo', by: 'gustavo', title: 'Concerto Cordas e Metais', status: 'FILLED', start: 20, hour: 20, slots: 2, duration: 75, genres: ['Instrumental', 'Jazz'], fee: 250000, description: 'Concerto instrumental com dois grupos convidados no Teatro Sete Coqueiros. Ingressos a preço popular.', img: ['ev-stage', 'ev-jazz'] },
    { key: 'mpb-teatro', org: 'teatro-sete-coqueiros-demo', by: 'gustavo', title: 'Temporada MPB no Teatro', status: 'OPEN', start: 45, hour: 20, slots: 3, duration: 70, genres: ['MPB'], fee: 200000, description: 'Temporada de três noites de MPB com artistas alagoanos. Cada atração faz uma noite completa com luz e som do teatro.', requirements: 'Show completo de 70 minutos e rider técnico preenchido.', img: ['ev-stage', 'ev-lights'] },
    { key: 'sarau', org: 'espaco-mandacaru-demo', by: 'luana', title: 'Sarau do Mandacaru', status: 'OPEN', start: 12, hour: 19, slots: 3, duration: 30, genres: ['MPB', 'Rap / Hip-hop', 'Forró'], fee: 30000, payment: 'Cachê fixo', description: 'Sarau mensal com música, poesia e microfone aberto. Três atrações de 30 minutos.', img: ['ev-live', 'ev-lights'] },
    { key: 'rock-agreste', org: 'espaco-mandacaru-demo', by: 'luana', title: 'Rock no Agreste', status: 'CLOSED', start: 8, deadline: -2, slots: 2, duration: 60, genres: ['Rock', 'Indie'], fee: 80000, description: 'Noite de rock com bandas da região. Inscrições encerradas; seleção em andamento.', img: ['ev-crowd', 'ev-stage'] },
    { key: 'luau', org: 'mare-cheia-restaurante-demo', by: 'roberto', title: 'Luau de Lua Cheia', status: 'OPEN', start: 25, hour: 20, slots: 1, duration: 150, genres: ['Reggae', 'Pop', 'MPB'], fee: 90000, description: 'Luau na areia com fogueira e música acústica. Procuramos artista com repertório leve e participativo.', img: ['ev-party', 'ev-fireworks'] },
    { key: 'jantar-jazz', org: 'mare-cheia-restaurante-demo', by: 'roberto', title: 'Jantar com Jazz', status: 'FILLED', start: 4, hour: 20, slots: 1, duration: 120, genres: ['Jazz', 'Instrumental'], fee: 70000, description: 'Música ambiente instrumental durante o jantar de sexta.', img: ['ev-jazz'] },
    { key: 'roda-coco', org: 'quintal-do-coco-demo', by: 'roberto', title: 'Roda de Coco no Quintal', status: 'OPEN', start: 19, hour: 19, slots: 2, duration: 90, genres: ['Coco de roda', 'Forró'], fee: 80000, description: 'Roda de coco aberta ao público, com convite para dança. Duas atrações de 90 minutos.', img: ['ev-party', 'ev-live'] },
    { key: 'sao-joao-quintal', org: 'quintal-do-coco-demo', by: 'roberto', title: 'Arraiá do Quintal', status: 'POSTPONED', start: 60, hour: 20, slots: 3, duration: 90, genres: ['Forró', 'Coco de roda'], fee: 120000, description: 'Arraiá fora de época com quadrilha e trio pé-de-serra. Adiado por causa da previsão de chuva; nova data em breve.', img: ['ev-junina', 'ev-party'] },
    { key: 'jazz-quarta', org: 'clube-do-vinil-demo', by: 'silvia', title: 'Quarta do Jazz', status: 'OPEN', start: 7, hour: 20, slots: 1, duration: 120, genres: ['Jazz', 'Instrumental'], fee: 45000, payment: 'Couvert artístico', description: 'Noite de jazz com couvert integral para o artista. Piano de armário disponível.', img: ['ev-jazz', 'ev-lights'] },
    { key: 'vinil-sexta', org: 'clube-do-vinil-demo', by: 'silvia', title: 'Sexta no Vinil', status: 'FILLED', start: 11, hour: 22, slots: 1, duration: 240, genres: ['Eletrônico', 'Pop'], fee: 100000, description: 'Pista de vinil com DJ convidado das 22h às 2h.', img: ['ev-dj', 'ev-lights'] },
    { key: 'recital', org: 'casa-da-ribeira-demo', by: 'antonio', title: 'Recital no Casarão', status: 'OPEN', start: 28, hour: 19, slots: 2, duration: 50, genres: ['Instrumental', 'MPB'], fee: 90000, description: 'Recital no pátio do casarão às margens do São Francisco, com público sentado.', img: ['ev-stage', 'ev-lights'] },
    { key: 'festa-padroeiro', org: 'casa-da-ribeira-demo', by: 'antonio', title: 'Festa do Padroeiro', status: 'CANCELLED', start: 15, hour: 19, slots: 2, duration: 90, genres: ['Forró', 'Gospel'], fee: 100000, description: 'Festa cancelada pela organização; as atrações foram avisadas.', img: ['ev-fireworks', 'ev-party'] },
    { key: 'forro-sertao', org: 'galpao-sertao-demo', by: 'antonio', title: 'Noite do Forró do Sertão', status: 'OPEN', start: 38, hour: 22, slots: 3, duration: 90, genres: ['Forró'], fee: 250000, description: 'Três atrações de forró pé-de-serra e eletrônico na maior pista do sertão. Hospedagem por conta da casa.', requirements: 'Formação mínima de trio.', img: ['ev-junina', 'ev-crowd'] },
    { key: 'lancamento-malungos', org: 'galpao-jaragua-demo', by: 'rafael', title: 'Roda dos Malungos no Galpão', status: 'FILLED', start: 23, hour: 20, slots: 1, duration: 150, genres: ['Samba', 'Pagode'], fee: 220000, description: 'Roda de samba com Os Malungos e convidados.', img: ['ev-crowd', 'ev-live'] },
    // Passados (realizados e encerrados)
    { key: 'verao-passado', org: 'armazem-pajucara-demo', by: 'fernanda', title: 'Armazém Instrumental', status: 'COMPLETED', start: -20, hour: 20, slots: 1, duration: 90, genres: ['Jazz', 'Instrumental'], fee: 280000, description: 'Noite instrumental com o Quinteto Lagoa. Casa cheia.', img: ['ev-jazz', 'ev-stage'] },
    { key: 'forro-passado', org: 'galpao-sertao-demo', by: 'antonio', title: 'Forró de Novembro', status: 'COMPLETED', start: -9, hour: 22, slots: 1, duration: 120, genres: ['Forró'], fee: 150000, description: 'Noite de forró com Mestre Damião e trio.', img: ['ev-junina', 'ev-crowd'] },
    { key: 'rock-passado', org: 'espaco-mandacaru-demo', by: 'luana', title: 'Brisa Elétrica ao Vivo', status: 'COMPLETED', start: -30, hour: 21, slots: 1, duration: 80, genres: ['Rock'], fee: 120000, description: 'Show do disco novo da Brisa Elétrica.', img: ['ev-crowd', 'ev-lights'] },
    { key: 'samba-passado', org: 'bar-do-cais-demo', by: 'fernanda', title: 'Samba de Outubro no Cais', status: 'COMPLETED', start: -35, hour: 17, slots: 1, duration: 180, genres: ['Samba'], fee: 110000, description: 'Roda de samba com Os Malungos.', img: ['ev-live'] },
    { key: 'sem-contratacao', org: 'clube-do-vinil-demo', by: 'silvia', title: 'Noite de Blues', status: 'CLOSED', start: -5, hour: 21, slots: 1, duration: 90, genres: ['Rock', 'Jazz'], fee: 40000, description: 'Evento encerrado sem contratação.', img: ['ev-lights'] },
    // Contratantes independentes
    { key: 'casamento-paula', org: 'paula', by: 'paula', title: 'Casamento na Praia — cerimônia e recepção', status: 'OPEN', visibility: 'PRIVATE', start: 55, hour: 16, slots: 2, duration: 90, genres: ['Instrumental', 'MPB'], fee: 180000, description: 'Cerimônia ao pôr do sol (violino ou piano) e recepção com música ao vivo. Evento privado.', img: ['ev-wedding', 'ev-party'], location: { name: 'Pousada à beira-mar', address: 'Rodovia Fictícia, km 12', city: 'Maceió' } },
    { key: 'formatura', org: 'paula', by: 'paula', title: 'Festa de Formatura de Medicina', status: 'FILLED', visibility: 'PRIVATE', start: 18, hour: 22, slots: 1, duration: 180, genres: ['Pop', 'Eletrônico'], fee: 300000, description: 'Festa de formatura para 400 convidados. Evento privado.', img: ['ev-dj', 'ev-party'], location: { name: 'Salão de eventos', city: 'Maceió' } },
    { key: 'confra', org: 'marcos', by: 'marcos', title: 'Confraternização de Fim de Ano', status: 'OPEN', start: 30, hour: 19, slots: 1, duration: 120, genres: ['Samba', 'Pagode', 'Forró'], fee: 150000, description: 'Confraternização de empresa aberta às famílias, em área de lazer ao ar livre.', img: ['ev-party', 'ev-live'], location: { name: 'Área de lazer do clube', address: 'Avenida Fictícia, 900', city: 'Rio Largo' } },
    { key: 'rascunho', org: 'marcos', by: 'marcos', title: 'Réveillon na Chácara (rascunho)', status: 'DRAFT', start: 42, hour: 22, slots: 2, duration: 120, genres: ['Pop', 'Forró'], fee: 200000, description: 'Rascunho ainda não publicado.', img: ['ev-fireworks'], location: { name: 'Chácara da família', city: 'Rio Largo' } },
  ];

  const E: Record<string, { id: string; start: Date; duration: number; orgId: string; by: string }> = {};
  for (const e of EVENTS) {
    const orgId = V[e.org];
    const startsAt = days(e.start, e.hour ?? 21);
    const deadline = e.deadline != null ? days(e.deadline, 23) : e.start < 0 ? days(e.start - 5, 23) : days(Math.max(1, e.start - 4), 23);
    let ev = await prisma.event.findFirst({ where: { organizerId: orgId, title: e.title }, select: { id: true } });
    if (!ev) {
      const isVenue = !e.location;
      ev = await prisma.event.create({
        data: {
          organizerId: orgId,
          createdById: U[e.by].id,
          venueId: isVenue ? orgId : null,
          visibility: e.visibility ?? 'PUBLIC',
          locationName: e.location?.name ?? null,
          locationAddress: e.location?.address ?? null,
          locationCity: e.location?.city ?? null,
          locationState: e.location ? 'AL' : null,
          title: e.title,
          description: e.description,
          startsAt,
          durationMinutes: e.duration ?? 60,
          applicationDeadline: deadline.getTime() > startsAt.getTime() ? startsAt : deadline,
          slots: e.slots,
          genres: e.genres,
          paymentType: e.payment ?? (e.fee == null ? 'A combinar' : 'Cachê fixo'),
          feeCents: e.fee,
          conditions: 'Som e luz do local. Passagem de som 2 horas antes. Pagamento combinado diretamente com o contratante.',
          notes: e.requirements ?? '',
          status: e.status,
          publishedAt: e.status === 'DRAFT' ? null : now,
          ...(e.status === 'FILLED' ? { filledAt: now } : {}),
          ...(e.status === 'CLOSED' ? { closedAt: now } : {}),
          ...(e.status === 'COMPLETED' ? { completedAt: now } : {}),
          ...(e.status === 'CANCELLED' ? { cancelledAt: now } : {}),
          ...(e.status === 'POSTPONED' ? { postponedAt: now } : {}),
        },
        select: { id: true },
      });
    }
    E[e.key] = { id: ev.id, start: startsAt, duration: e.duration ?? 60, orgId, by: U[e.by].id };
  }

  // ─────────── Candidaturas ───────────
  const apply = async (ev: string, artist: string, by: string, status: ApplicationStatus, message: string) => {
    const e = E[ev];
    const found = await prisma.eventApplication.findUnique({ where: { eventId_artistId: { eventId: e.id, artistId: A[artist] } }, select: { id: true } });
    if (found) return found.id;
    const created = await prisma.eventApplication.create({
      data: { eventId: e.id, artistId: A[artist], submittedById: U[by].id, status, message, ...(status !== 'PENDING' && status !== 'WITHDRAWN' ? { decidedAt: now, decidedById: e.by } : {}) },
      select: { id: true },
    });
    return created.id;
  };

  // ─────────── Negociações ───────────
  type Offer = { side: 'VENUE' | 'ARTIST'; fee: number; status: 'PENDING' | 'ACCEPTED' | 'SUPERSEDED' | 'DECLINED'; terms: string; at?: Date; minutes?: number };
  const booking = async (opts: {
    title: string;
    orgId: string;
    venueUser: string;
    artist: string;
    artistUser: string;
    event?: string;
    applicationId?: string;
    status: BookingStatus;
    at?: Date;
    minutes?: number;
    offers: Offer[];
    messages?: [('VENUE' | 'ARTIST'), string][];
    performed?: boolean;
    cancelReason?: string;
  }) => {
    const key = { organizationId: opts.orgId, artistId: A[opts.artist], title: opts.title };
    const found = await prisma.booking.findFirst({ where: key, select: { id: true } });
    if (found) return found.id;
    const venueUserId = U[opts.venueUser].id;
    const artistUserId = U[opts.artistUser].id;
    const at = opts.at ?? (opts.event ? E[opts.event].start : days(20));
    const minutes = opts.minutes ?? (opts.event ? E[opts.event].duration : 90);
    return prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          ...key,
          origin: opts.applicationId ? 'APPLICATION' : 'DIRECT',
          eventId: opts.event ? E[opts.event].id : null,
          applicationId: opts.applicationId ?? null,
          createdById: venueUserId,
          status: opts.status,
          ...(opts.status === 'CONFIRMED' ? { confirmedAt: now, confirmedById: venueUserId } : {}),
        },
      });
      await tx.bookingStatusChange.create({ data: { bookingId: b.id, toStatus: 'NEGOTIATING', actorId: venueUserId, actorSide: 'VENUE', note: opts.applicationId ? 'Iniciada a partir de candidatura' : 'Proposta direta' } });
      let previous: string | null = null;
      for (const o of opts.offers) {
        const created: { id: string } = await tx.bookingOffer.create({
          data: {
            bookingId: b.id,
            authorId: o.side === 'VENUE' ? venueUserId : artistUserId,
            authorSide: o.side,
            previousOfferId: previous,
            performanceAt: o.at ?? at,
            durationMinutes: o.minutes ?? minutes,
            feeCents: o.fee * 100,
            terms: o.terms,
            status: o.status,
            ...(o.status !== 'PENDING' ? { respondedAt: now } : {}),
          },
          select: { id: true },
        });
        previous = created.id;
      }
      if (['AGREED', 'CONFIRMED', 'CANCELLED'].includes(opts.status)) {
        await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'NEGOTIATING', toStatus: 'AGREED', actorId: artistUserId, actorSide: 'ARTIST', note: 'Proposta aceita' } });
      }
      if (opts.status === 'CONFIRMED') {
        await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'AGREED', toStatus: 'CONFIRMED', actorId: venueUserId, actorSide: 'VENUE', note: 'Contratação confirmada (pagamento é externo à plataforma)' } });
      }
      if (opts.status === 'DECLINED') {
        await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'NEGOTIATING', toStatus: 'DECLINED', actorId: artistUserId, actorSide: 'ARTIST', note: 'Proposta recusada' } });
      }
      if (opts.status === 'CANCELLED') {
        await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'AGREED', toStatus: 'CANCELLED', actorId: venueUserId, actorSide: 'VENUE', note: opts.cancelReason ?? 'Cancelado' } });
      }
      let minute = 0;
      for (const [side, body] of opts.messages ?? []) {
        await tx.bookingMessage.create({
          data: { bookingId: b.id, authorId: side === 'VENUE' ? venueUserId : artistUserId, authorSide: side, body, createdAt: new Date(now.getTime() - (60 - minute++ * 7) * 60_000) },
        });
      }
      if (opts.performed) {
        await tx.performance.create({ data: { bookingId: b.id, artistId: A[opts.artist], organizationId: opts.orgId, performedAt: at, registeredById: venueUserId, notes: 'Apresentação realizada com casa cheia.' } });
      }
      return b.id;
    });
  };

  // Eventos abertos: candidaturas em vários estados.
  await apply('verao', 'marilia', 'marilia', 'PENDING', 'Show de samba dançante de 60 minutos, com cavaquinho e percussão.');
  await apply('verao', 'nanda', 'nanda', 'PENDING', 'Show pop com banda; repertório de hits para dançar.');
  await apply('verao', 'gabi', 'gabi', 'PENDING', 'Reggae acústico para o fim de tarde do festival.');
  const veraoMalungos = await apply('verao', 'os-malungos-demo', 'marilia', 'ACCEPTED', 'Roda completa com 5 integrantes.');
  await apply('verao', 'tiago-ramos-demo', 'tiago', 'REJECTED', 'Rap autoral com DJ.');
  await apply('quinta-autoral', 'brisa-eletrica-demo', 'lucas', 'PENDING', 'Power trio autoral, disco novo lançado em setembro.');
  await apply('quinta-autoral', 'bia-tenorio-demo', 'bia', 'PENDING', 'Set autoral com guitarra e sintetizador.');
  await apply('quinta-autoral', 'lucas', 'lucas', 'WITHDRAWN', 'Formato solo (retirada para inscrever a banda).');
  await apply('samba-sabado', 'os-malungos-demo', 'marilia', 'PENDING', 'Roda de 3 horas com clássicos.');
  await apply('samba-sabado', 'clara', 'clara', 'PENDING', 'Regional de choro e samba.');
  await apply('mpb-teatro', 'julia', 'julia', 'PENDING', 'Show de piano e voz com repertório autoral.');
  await apply('mpb-teatro', 'ana-lins-demo', 'ana', 'PENDING', 'Voz e violão com participação especial.');
  const mpbMare = await apply('mpb-teatro', 'mare-alta-demo', 'ana', 'ACCEPTED', 'Show completo do EP novo.');
  await apply('sarau', 'tiago-ramos-demo', 'tiago', 'PENDING', 'Rap autoral, 30 minutos.');
  await apply('sarau', 'pedro', 'pedro', 'PENDING', 'Modão no violão.');
  await apply('luau', 'gabi', 'gabi', 'PENDING', 'Ukulele e voz para o luau.');
  await apply('roda-coco', 'coco-do-sereno-demo', 'zecicero', 'PENDING', 'Roda completa com tambores.');
  await apply('roda-coco', 'trio-agreste-demo', 'joao', 'PENDING', 'Forró pé-de-serra.');
  await apply('jazz-quarta', 'caio', 'caio', 'PENDING', 'Sax e bases; repertório de standards.');
  await apply('jazz-quarta', 'quinteto-lagoa-demo', 'caio', 'REJECTED', 'Quinteto completo.');
  await apply('recital', 'rebeca', 'rebeca', 'PENDING', 'Recital de violino solo.');
  await apply('recital', 'clara', 'clara', 'PENDING', 'Choro instrumental.');
  await apply('forro-sertao', 'damiao', 'damiao', 'PENDING', 'Trio pé-de-serra com 30 anos de estrada.');
  await apply('forro-sertao', 'trio-agreste-demo', 'joao', 'PENDING', 'Trio completo.');
  await apply('forro-sertao', 'joao-bezerra-demo', 'joao', 'PENDING', 'Sanfona e voz.');
  await apply('casamento-paula', 'rebeca', 'rebeca', 'PENDING', 'Violino para a cerimônia.');
  await apply('casamento-paula', 'julia', 'julia', 'PENDING', 'Piano para a recepção.');
  await apply('confra', 'os-malungos-demo', 'marilia', 'PENDING', 'Roda de samba para a confraternização.');
  const rockBrisa = await apply('rock-agreste', 'brisa-eletrica-demo', 'lucas', 'ACCEPTED', 'Show do disco novo.');
  await apply('rock-agreste', 'lucas', 'lucas', 'REJECTED', 'Formato solo.');
  const porDoSolGabi = await apply('por-do-sol', 'gabi', 'gabi', 'ACCEPTED', 'Voz e violão no pôr do sol.');
  const concertoQuinteto = await apply('concerto-cordas', 'quinteto-lagoa-demo', 'caio', 'ACCEPTED', 'Quinteto completo, 75 minutos.');
  await apply('concerto-cordas', 'rebeca', 'rebeca', 'REJECTED', 'Violino solo.');

  // Negociações em andamento (agenda sem sobreposição entre confirmadas).
  await booking({ title: 'Festival Verão — Os Malungos', orgId: V['armazem-pajucara-demo'], venueUser: 'fernanda', artist: 'os-malungos-demo', artistUser: 'marilia', event: 'verao', applicationId: veraoMalungos, status: 'NEGOTIATING', offers: [{ side: 'VENUE', fee: 1500, status: 'SUPERSEDED', terms: 'Show de 60 minutos às 20h.' }, { side: 'ARTIST', fee: 1900, status: 'PENDING', terms: 'Somos 5 no palco; pedimos ajuste do cachê.' }], messages: [['VENUE', 'Oi, Marília! Adoramos a proposta de vocês para o festival.'], ['ARTIST', 'Que bom! Mandei uma contraproposta considerando a formação completa.'], ['VENUE', 'Vou ver com a produção e respondo até amanhã.']] });
  await booking({ title: 'Temporada MPB — Maré Alta', orgId: V['teatro-sete-coqueiros-demo'], venueUser: 'gustavo', artist: 'mare-alta-demo', artistUser: 'ana', event: 'mpb-teatro', applicationId: mpbMare, status: 'AGREED', offers: [{ side: 'VENUE', fee: 2000, status: 'ACCEPTED', terms: 'Noite completa com som e luz do teatro.' }], messages: [['ARTIST', 'Aceitamos! Podemos fazer a passagem de som às 16h?'], ['VENUE', 'Perfeito, combinado. Vou confirmar a contratação esta semana.']] });
  await booking({ title: 'Rock no Agreste — Brisa Elétrica', orgId: V['espaco-mandacaru-demo'], venueUser: 'luana', artist: 'brisa-eletrica-demo', artistUser: 'lucas', event: 'rock-agreste', applicationId: rockBrisa, status: 'NEGOTIATING', offers: [{ side: 'VENUE', fee: 800, status: 'PENDING', terms: 'Show de 60 minutos; backline da casa.' }] });
  await booking({ title: 'Clube do Vinil × Júlia Cavalcante', orgId: V['clube-do-vinil-demo'], venueUser: 'silvia', artist: 'julia', artistUser: 'julia', status: 'NEGOTIATING', at: days(14, 20), minutes: 120, offers: [{ side: 'VENUE', fee: 500, status: 'PENDING', terms: 'Piano e voz numa quarta especial.' }], messages: [['VENUE', 'Júlia, que tal uma quarta só de canções autorais?']] });
  await booking({ title: 'Maré Cheia × Pedro Albuquerque', orgId: V['mare-cheia-restaurante-demo'], venueUser: 'roberto', artist: 'pedro', artistUser: 'pedro', status: 'DECLINED', at: days(10, 20), minutes: 120, offers: [{ side: 'VENUE', fee: 300, status: 'DECLINED', terms: 'Voz e violão no jantar.' }], messages: [['ARTIST', 'Obrigado pelo convite, mas já tenho show nessa data.']] });
  await booking({ title: 'Bar do Cais × Caio Sax', orgId: V['bar-do-cais-demo'], venueUser: 'fernanda', artist: 'caio', artistUser: 'caio', status: 'AGREED', at: days(13, 19), minutes: 120, offers: [{ side: 'VENUE', fee: 600, status: 'SUPERSEDED', terms: 'Sax ambiente no fim de tarde.' }, { side: 'ARTIST', fee: 750, status: 'ACCEPTED', terms: 'Duas entradas de 50 minutos com bases.' }] });
  await booking({ title: 'Galpão Sertão × Coco do Sereno', orgId: V['galpao-sertao-demo'], venueUser: 'antonio', artist: 'coco-do-sereno-demo', artistUser: 'zecicero', status: 'NEGOTIATING', at: days(50, 21), minutes: 90, offers: [{ side: 'VENUE', fee: 1800, status: 'PENDING', terms: 'Abertura da temporada junina.' }] });

  // Confirmadas (eventos FILLED: todas as vagas confirmadas).
  await booking({ title: 'Pôr do Sol Acústico — Gabi Nunes', orgId: V['bar-do-cais-demo'], venueUser: 'fernanda', artist: 'gabi', artistUser: 'gabi', event: 'por-do-sol', applicationId: porDoSolGabi, status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 500, status: 'ACCEPTED', terms: 'Voz e violão, 2 horas.' }], messages: [['VENUE', 'Confirmado! Te esperamos às 16h para a passagem de som.'], ['ARTIST', 'Combinado, até lá!']] });
  await booking({ title: 'Concerto Cordas e Metais — Quinteto Lagoa', orgId: V['teatro-sete-coqueiros-demo'], venueUser: 'gustavo', artist: 'quinteto-lagoa-demo', artistUser: 'caio', event: 'concerto-cordas', applicationId: concertoQuinteto, status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 2500, status: 'ACCEPTED', terms: 'Primeira parte do concerto, 75 minutos.' }] });
  await booking({ title: 'Concerto Cordas e Metais — Rebeca Lima', orgId: V['teatro-sete-coqueiros-demo'], venueUser: 'gustavo', artist: 'rebeca', artistUser: 'rebeca', event: 'concerto-cordas', status: 'CONFIRMED', at: new Date(E['concerto-cordas'].start.getTime() + 90 * 60_000), offers: [{ side: 'VENUE', fee: 1200, status: 'ACCEPTED', terms: 'Segunda parte do concerto, recital de violino.' }] });
  await booking({ title: 'Jantar com Jazz — Caio Sax', orgId: V['mare-cheia-restaurante-demo'], venueUser: 'roberto', artist: 'caio', artistUser: 'caio', event: 'jantar-jazz', status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 700, status: 'ACCEPTED', terms: 'Sax ambiente durante o jantar.' }] });
  await booking({ title: 'Sexta no Vinil — DJ Renato Amorim', orgId: V['clube-do-vinil-demo'], venueUser: 'silvia', artist: 'renato', artistUser: 'renato', event: 'vinil-sexta', status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 1000, status: 'ACCEPTED', terms: 'Set de vinil das 22h às 2h.' }], messages: [['ARTIST', 'Levo os discos e a controladora de reserva.']] });
  await booking({ title: 'Roda dos Malungos no Galpão', orgId: V['galpao-jaragua-demo'], venueUser: 'rafael', artist: 'os-malungos-demo', artistUser: 'marilia', event: 'lancamento-malungos', status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 2200, status: 'ACCEPTED', terms: 'Roda de 2h30.' }] });
  await booking({ title: 'Formatura de Medicina — DJ Renato Amorim', orgId: V.paula, venueUser: 'paula', artist: 'renato', artistUser: 'renato', event: 'formatura', status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 3000, status: 'ACCEPTED', terms: 'Pista das 22h à 1h.' }] });
  await booking({ title: 'Armazém Pajuçara × Nanda Oliveira', orgId: V['armazem-pajucara-demo'], venueUser: 'fernanda', artist: 'nanda', artistUser: 'nanda', status: 'CONFIRMED', at: days(26, 22), minutes: 120, offers: [{ side: 'VENUE', fee: 1200, status: 'ACCEPTED', terms: 'Show pop no sábado.' }] });
  await booking({ title: 'Casa da Ribeira × Clara Torres', orgId: V['casa-da-ribeira-demo'], venueUser: 'antonio', artist: 'clara', artistUser: 'clara', status: 'CANCELLED', at: days(15, 19), minutes: 90, cancelReason: 'Festa do padroeiro cancelada pela organização.', offers: [{ side: 'VENUE', fee: 500, status: 'ACCEPTED', terms: 'Choro no pátio.' }] });

  // Realizadas (eventos COMPLETED, com apresentação registrada).
  await booking({ title: 'Armazém Instrumental — Quinteto Lagoa', orgId: V['armazem-pajucara-demo'], venueUser: 'fernanda', artist: 'quinteto-lagoa-demo', artistUser: 'caio', event: 'verao-passado', status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 2800, status: 'ACCEPTED', terms: 'Noite instrumental.' }], performed: true });
  await booking({ title: 'Forró de Novembro — Mestre Damião', orgId: V['galpao-sertao-demo'], venueUser: 'antonio', artist: 'damiao', artistUser: 'damiao', event: 'forro-passado', status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 1500, status: 'ACCEPTED', terms: 'Trio pé-de-serra, 2 horas.' }], performed: true });
  await booking({ title: 'Brisa Elétrica ao Vivo', orgId: V['espaco-mandacaru-demo'], venueUser: 'luana', artist: 'brisa-eletrica-demo', artistUser: 'lucas', event: 'rock-passado', status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 1200, status: 'ACCEPTED', terms: 'Show do disco novo.' }], performed: true });
  await booking({ title: 'Samba de Outubro — Os Malungos', orgId: V['bar-do-cais-demo'], venueUser: 'fernanda', artist: 'os-malungos-demo', artistUser: 'marilia', event: 'samba-passado', status: 'CONFIRMED', offers: [{ side: 'VENUE', fee: 1100, status: 'ACCEPTED', terms: 'Roda de 3 horas.' }], performed: true });

  // ─────────── Contrapropostas na candidatura (reunião 22/11) ───────────
  const counters: [string, string, number][] = [
    ['verao', 'gabi', 180000],
    ['mpb-teatro', 'julia', 250000],
    ['forro-sertao', 'damiao', 320000],
    ['jazz-quarta', 'caio', 60000],
    ['recital', 'rebeca', 120000],
  ];
  for (const [ev, artist, fee] of counters) {
    if (!E[ev] || !A[artist]) continue;
    await prisma.eventApplication.updateMany({
      where: { eventId: E[ev].id, artistId: A[artist], status: 'PENDING', proposedFeeCents: null, booking: null },
      data: { proposedFeeCents: fee },
    });
  }

  // ─────────── CPF/CNPJ fictícios nos dados de demonstração já existentes ───────────
  // Só contas do domínio reservado @demo.ridersync.local (e casas que pertencem a elas). Contas reais não são tocadas.
  const demoUsers = await prisma.user.findMany({ where: { email: { endsWith: '@demo.ridersync.local' }, cpf: null }, select: { id: true, email: true, name: true, legalName: true } });
  for (const u of demoUsers) {
    await prisma.user.update({ where: { id: u.id }, data: { cpf: fakeCpf(u.email), ...(u.legalName ? {} : { legalName: u.name.replace(/ \(demo\)$/, '') }) } });
  }
  const demoVenues = await prisma.organization.findMany({
    where: { type: 'VENUE', cnpj: null, members: { some: { role: 'OWNER', status: 'ACTIVE', user: { email: { endsWith: '@demo.ridersync.local' } } } } },
    select: { id: true, slug: true, name: true, legalName: true },
  });
  for (const o of demoVenues) {
    await prisma.organization.update({ where: { id: o.id }, data: { cnpj: fakeCnpj(o.slug), ...(o.legalName ? {} : { legalName: `${o.name.replace(/ \(demo\)$/, '')} Ltda` }) } });
  }
  console.warn(`Documentos fictícios: ${demoUsers.length} conta(s) com CPF e ${demoVenues.length} casa(s) com CNPJ preenchidos.`);

  // ─────────── Imagens nos registros que ainda não têm ───────────
  const instTag: Record<string, string[]> = {
    Voz: ['mic'], Violão: ['guitar'], Guitarra: ['eguitar'], Baixo: ['bass'], Bateria: ['drums'], Teclado: ['keys'], Sanfona: ['accordion'],
    Percussão: ['percussion', 'pandeiro'], Sopros: ['sax', 'trumpet', 'trombone'], Cordas: ['violin', 'cavaquinho'], DJ: ['dj', 'synth'],
  };
  const soloImg = new Map(SOLOS.map((s) => [s.slug, s.img]));
  const bandImg = new Map(BANDS.map((b) => [b.slug, b.img]));
  const legacyImg: Record<string, string[]> = { 'mare-alta-demo': ['drums', 'mic'], 'trio-agreste-demo': ['accordion', 'percussion'] };
  const artists = await prisma.artist.findMany({
    select: { id: true, slug: true, photoId: true, musicianProfile: { select: { mainInstrument: true, userId: true } }, band: { select: { createdById: true } } },
  });
  for (const a of artists) {
    const tags = soloImg.get(a.slug) ?? bandImg.get(a.slug) ?? legacyImg[a.slug] ?? instTag[a.musicianProfile?.mainInstrument ?? ''] ?? ['mic'];
    const uploader = a.musicianProfile?.userId ?? a.band?.createdById;
    if (!uploader) continue;
    if (!a.photoId) {
      const photoId = await pool.asset(uploader, ...tags, 'ev-stage');
      await prisma.artist.update({ where: { id: a.id }, data: { photoId } });
    }
    await photos(a.id, uploader, tags, ['Ao vivo', 'Passagem de som', 'Bastidores']);
  }

  const venueImg = new Map(VENUES.map((v) => [v.slug, v.img]));
  const legacyVenueImg: Record<string, string[]> = { 'galpao-jaragua-demo': ['venue-warehouse', 'venue-hall'], 'casa-sururu-demo': ['venue-bar', 'venue-pub'], 'teatro-ribeirinho-demo': ['venue-theater'] };
  const orgs = await prisma.organization.findMany({ where: { type: 'VENUE', photoId: null }, select: { id: true, slug: true, members: { where: { role: 'OWNER' }, select: { userId: true }, take: 1 } } });
  for (const o of orgs) {
    const owner = o.members[0]?.userId;
    if (!owner) continue;
    const photoId = await pool.asset(owner, ...(venueImg.get(o.slug) ?? legacyVenueImg[o.slug] ?? ['venue-bar']), 'venue-hall');
    await prisma.organization.update({ where: { id: o.id }, data: { photoId } });
  }

  const eventImg = new Map(EVENTS.map((e) => [e.title, e.img]));
  const legacyEventImg = (title: string, genres: string[]) =>
    /forr|arrai/i.test(title) || genres.includes('Forró') ? ['ev-junina', 'ev-party'] : /casamento|anivers/i.test(title) ? ['ev-wedding', 'ev-party'] : /festival|inverno/i.test(title) ? ['ev-festival', 'ev-stage'] : ['ev-stage', 'ev-lights', 'ev-live'];
  const events = await prisma.event.findMany({ where: { imageId: null }, select: { id: true, title: true, genres: true, createdById: true, organizer: { select: { members: { where: { role: 'OWNER' }, select: { userId: true }, take: 1 } } } } });
  for (const e of events) {
    const uploader = e.createdById ?? e.organizer.members[0]?.userId;
    if (!uploader) continue;
    const imageId = await pool.asset(uploader, ...(eventImg.get(e.title) ?? legacyEventImg(e.title, e.genres)), 'ev-stage');
    await prisma.event.update({ where: { id: e.id }, data: { imageId } });
  }

  // ─────────── Notificações de exemplo para as contas novas ───────────
  await prisma.notification.createMany({
    data: [
      { userId: U.fernanda.id, category: 'APPLICATIONS', type: 'APPLICATION_RECEIVED', title: 'Novas candidaturas: Festival Verão no Armazém', body: 'Você tem candidaturas aguardando análise.', link: '/painel/eventos', dedupeKey: 'showcase:fernanda:apps' },
      { userId: U.fernanda.id, category: 'BOOKINGS', type: 'COUNTER_OFFER', title: 'Nova contraproposta', body: 'Os Malungos responderam com uma contraproposta.', link: '/painel/negociacoes', dedupeKey: 'showcase:fernanda:counter' },
      { userId: U.marilia.id, category: 'BOOKINGS', type: 'BOOKING_CONFIRMED', title: 'Contratação confirmada', body: 'Roda dos Malungos no Galpão foi confirmada.', link: '/painel/agenda', dedupeKey: 'showcase:marilia:confirmed' },
      { userId: U.caio.id, category: 'BOOKINGS', type: 'BOOKING_CONFIRMED', title: 'Contratação confirmada', body: 'Concerto Cordas e Metais foi confirmado.', link: '/painel/agenda', dedupeKey: 'showcase:caio:confirmed' },
      { userId: U.julia.id, category: 'BOOKINGS', type: 'PROPOSAL_RECEIVED', title: 'Nova proposta de contratação', body: 'Clube do Vinil enviou uma proposta.', link: '/painel/negociacoes', dedupeKey: 'showcase:julia:proposal' },
    ],
    skipDuplicates: true,
  });

  const counts = await Promise.all([
    prisma.artist.count(),
    prisma.organization.count({ where: { type: 'VENUE' } }),
    prisma.event.count(),
    prisma.eventApplication.count(),
    prisma.booking.count(),
    prisma.mediaAsset.count(),
    prisma.portfolioItem.count({ where: { kind: 'PHOTO' } }),
  ]);
  console.warn(`Vitrine concluída: ${counts[0]} artistas, ${counts[1]} casas, ${counts[2]} eventos, ${counts[3]} candidaturas, ${counts[4]} negociações, ${counts[5]} imagens (${counts[6]} fotos de portfólio).`);
}

if (require.main === module) {
  if (!process.argv.includes('--force')) {
    console.warn('Seed de vitrine ignorado (use --force).');
    process.exit(0);
  }
  const dir = process.env.SHOWCASE_IMAGE_DIR ?? path.resolve(__dirname, '../../seed-assets/showcase');
  if (!existsSync(dir)) {
    console.error(`Pasta de imagens não encontrada: ${dir}`);
    process.exit(1);
  }
  const prisma = new PrismaClient();
  (async () => {
    if (process.argv.includes('--with-demo')) await runDemoSeed(prisma);
    await runShowcaseSeed(prisma, dir);
  })()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
