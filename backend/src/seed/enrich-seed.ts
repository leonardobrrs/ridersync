/**
 * SEED DE ENRIQUECIMENTO — mais histórico e movimento nos dados FICTÍCIOS de demonstração (staging/desenvolvimento).
 *
 * Para cada artista/banda público administrado por contas @demo.ridersync.local, em casas de contas demo:
 *  - shows já realizados (metade ligados a eventos encerrados), com apresentação registrada e avaliações dos dois lados;
 *  - próximos shows confirmados (aparecem na home, no perfil do artista e na página da casa);
 *  - negociações encerradas (recusadas e canceladas) para o histórico;
 *  - conversas nas negociações e notificações.
 *
 * Regras respeitadas: no máximo um show confirmado por dia para cada artista e para cada casa (inclusive contra as
 * contratações confirmadas que já existiam); avaliação só de show confirmado e já ocorrido, uma por lado.
 * Idempotente: cada negociação é localizada por (casa, artista, título) e não é recriada. Bloqueado em produção.
 */
import { createHash } from 'node:crypto';
import { BookingStatus, PrismaClient } from '@prisma/client';

const DEMO = '@demo.ridersync.local';

/** PRNG determinístico (mulberry32) semeado por texto: mesmos dados a cada execução. */
function rng(seed: string) {
  let a = createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];

/** Data relativa a hoje às `hour` de Maceió (UTC−3). */
const dayAt = (n: number, hour: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(hour + 3, 0, 0, 0);
  return d;
};
const dayKey = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

const VENUE_REVIEWS: [number, string][] = [
  [5, 'Pontual, passagem de som rápida e casa cheia do começo ao fim. Queremos de novo!'],
  [5, 'Repertório perfeito para o público da casa. Muito profissional na negociação.'],
  [5, 'Show impecável. O público pediu bis duas vezes.'],
  [4, 'Ótima apresentação; só atrasou uns minutos para começar.'],
  [4, 'Banda muito afinada e simpática com a equipe. Rider claro e fácil de atender.'],
  [4, 'Boa energia no palco e comunicação tranquila antes do show.'],
  [3, 'Show correto, mas o volume ficou acima do combinado para o salão.'],
  [5, 'Superou as expectativas. Recomendo para qualquer casa.'],
  [4, 'Muito bom! Trouxeram o próprio equipamento e facilitaram a montagem.'],
  [5, ''],
];
const ARTIST_REVIEWS: [number, string][] = [
  [5, 'Casa organizada, equipe técnica excelente e pagamento no dia combinado.'],
  [5, 'Som muito bem cuidado e camarim confortável. Público atento.'],
  [4, 'Boa estrutura; o retorno de palco poderia ser melhor.'],
  [4, 'Contratante atencioso e combinados cumpridos. Voltaria com certeza.'],
  [5, 'Uma das melhores casas para tocar em Alagoas.'],
  [3, 'Ambiente legal, mas a passagem de som atrasou bastante.'],
  [4, 'Divulgação boa e casa cheia.'],
  [5, ''],
];
const MESSAGES: ['VENUE' | 'ARTIST', string][][] = [
  [
    ['VENUE', 'Oi! Gostamos muito do seu trabalho e queremos fechar uma data.'],
    ['ARTIST', 'Que ótimo! A proposta está dentro do que costumamos cobrar. Qual o horário da passagem de som?'],
    ['VENUE', 'Passagem às 17h. Som e luz da casa, camarim com água e lanche.'],
    ['ARTIST', 'Perfeito, combinado!'],
  ],
  [
    ['ARTIST', 'Boa tarde! Posso levar meu próprio amplificador?'],
    ['VENUE', 'Pode sim, temos energia no palco. Só avise a voltagem.'],
    ['ARTIST', '220V. Obrigado!'],
  ],
  [
    ['VENUE', 'Confirmado! Divulgamos o show nas redes amanhã.'],
    ['ARTIST', 'Vou compartilhar também. Até lá!'],
  ],
  [
    ['ARTIST', 'Chegamos às 18h para montar, tudo bem?'],
    ['VENUE', 'Tudo certo. O estacionamento de carga fica nos fundos.'],
  ],
];
const EVENT_NAMES = ['Sexta Autoral', 'Noite de Sábado', 'Quinta Acústica', 'Domingo com Música', 'Noite Especial', 'Sessão Ao Vivo', 'Fim de Tarde Musical'];

export async function runEnrichSeed(prisma: PrismaClient) {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed de enriquecimento bloqueado em produção.');
  const now = new Date();

  const artists = await prisma.artist.findMany({
    where: {
      visibility: 'PUBLIC',
      OR: [{ musicianProfile: { user: { email: { endsWith: DEMO } } } }, { band: { members: { some: { role: 'OWNER', status: 'ACTIVE', user: { email: { endsWith: DEMO } } } } } }],
    },
    orderBy: { slug: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      baseFeeCents: true,
      genres: true,
      musicianProfile: { select: { userId: true } },
      band: { select: { members: { where: { role: 'OWNER', status: 'ACTIVE' }, select: { userId: true }, take: 1 } } },
    },
  });
  const venues = await prisma.organization.findMany({
    where: { type: 'VENUE', members: { some: { role: 'OWNER', status: 'ACTIVE', user: { email: { endsWith: DEMO } } } } },
    orderBy: { slug: 'asc' },
    select: { id: true, slug: true, name: true, members: { where: { role: 'OWNER', status: 'ACTIVE' }, select: { userId: true }, take: 1 } },
  });
  if (!artists.length || !venues.length) {
    console.warn('Enriquecimento ignorado: rode antes o seed de demonstração/vitrine.');
    return;
  }

  // Ocupação por dia (artista e casa), já com as contratações confirmadas existentes.
  const busy = new Set<string>();
  const existing = await prisma.booking.findMany({
    where: { status: 'CONFIRMED' },
    select: { artistId: true, organizationId: true, eventId: true, event: { select: { venueId: true } }, offers: { where: { status: 'ACCEPTED' }, take: 1, select: { performanceAt: true } } },
  });
  for (const b of existing) {
    const at = b.offers[0]?.performanceAt;
    if (!at) continue;
    busy.add(`a:${b.artistId}:${dayKey(at)}`);
    busy.add(`v:${b.event?.venueId ?? b.organizationId}:${dayKey(at)}`);
  }
  /** Próximo dia livre para artista e casa a partir de `start`, andando na direção `step`. */
  const freeDay = (artistId: string, venueId: string, start: number, step: 1 | -1, hour: number) => {
    for (let n = start, i = 0; i < 120; n += step, i++) {
      const at = dayAt(n, hour);
      const k = dayKey(at);
      if (!busy.has(`a:${artistId}:${k}`) && !busy.has(`v:${venueId}:${k}`)) {
        busy.add(`a:${artistId}:${k}`);
        busy.add(`v:${venueId}:${k}`);
        return at;
      }
    }
    return null;
  };

  const stats = { past: 0, upcoming: 0, closed: 0, reviews: 0, events: 0, messages: 0, notifications: 0 };
  const notifications: { userId: string; category: 'BOOKINGS'; type: string; title: string; body: string; link: string; dedupeKey: string; readAt: Date | null; createdAt: Date }[] = [];

  for (const [ai, artist] of artists.entries()) {
    const r = rng(`enrich:${artist.slug}`);
    const artistUser = artist.musicianProfile?.userId ?? artist.band?.members[0]?.userId;
    if (!artistUser) continue;
    const baseFee = artist.baseFeeCents ?? 60000;
    const feeFor = (pr: () => number) => Math.max(30000, Math.round((baseFee * (0.85 + pr() * 0.45)) / 5000) * 5000);
    const venueFor = (k: number, pr: () => number) => venues[(ai * 3 + k * 5 + Math.floor(pr() * venues.length)) % venues.length];

    const pastCount = 3 + Math.floor(r() * 5); // 3–7 shows realizados
    const upcomingCount = 1 + Math.floor(r() * 3); // 1–3 próximos
    const plans: { kind: 'past' | 'upcoming' | 'declined' | 'cancelled'; k: number }[] = [
      ...Array.from({ length: pastCount }, (_, k) => ({ kind: 'past' as const, k })),
      ...Array.from({ length: upcomingCount }, (_, k) => ({ kind: 'upcoming' as const, k })),
      ...(ai % 3 === 0 ? [{ kind: 'declined' as const, k: 0 }] : []),
      ...(ai % 4 === 1 ? [{ kind: 'cancelled' as const, k: 0 }] : []),
    ];

    for (const plan of plans) {
      // Gerador próprio por show planejado: as escolhas não dependem do que já existe (execuções repetidas não duplicam).
      const pr = rng(`enrich:${artist.slug}:${plan.kind}:${plan.k}`);
      const venue = venueFor(plan.k + (plan.kind === 'upcoming' ? 11 : plan.kind === 'past' ? 0 : 23), pr);
      const venueUser = venue.members[0]?.userId;
      if (!venueUser) continue;
      const label = { past: 'show', upcoming: 'próximo show', declined: 'proposta', cancelled: 'data' }[plan.kind];
      const title = `${artist.name} no ${venue.name} — ${label} ${plan.k + 1}`;
      const key = { organizationId: venue.id, artistId: artist.id, title };
      if (await prisma.booking.findFirst({ where: key, select: { id: true } })) continue;

      const hour = pick(pr, [19, 20, 21, 22]);
      const minutes = pick(pr, [60, 90, 120, 150]);
      const fee = feeFor(pr);
      let at: Date | null;
      if (plan.kind === 'past') at = freeDay(artist.id, venue.id, -(8 + plan.k * 18 + Math.floor(pr() * 12)), -1, hour);
      else if (plan.kind === 'upcoming') at = freeDay(artist.id, venue.id, 4 + plan.k * 16 + Math.floor(pr() * 10), 1, hour);
      else at = dayAt(plan.kind === 'declined' ? 20 + Math.floor(pr() * 30) : -(30 + Math.floor(pr() * 60)), hour); // não ocupa agenda
      if (!at) continue;

      const status: BookingStatus = plan.kind === 'declined' ? 'DECLINED' : plan.kind === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
      const createdAt = new Date(Math.min(at.getTime(), now.getTime()) - (12 + Math.floor(pr() * 25)) * 86_400_000);
      await prisma.$transaction(async (tx) => {
        // Metade dos shows realizados vem de um evento encerrado da casa (aparece no histórico com o nome do evento).
        let eventId: string | null = null;
        if (plan.kind === 'past' && pr() < 0.5) {
          const evTitle = `${pick(pr, EVENT_NAMES)} com ${artist.name}`;
          const found = await tx.event.findFirst({ where: { organizerId: venue.id, title: evTitle }, select: { id: true } });
          if (found) eventId = found.id;
          else {
            const ev = await tx.event.create({
              data: {
                organizerId: venue.id,
                venueId: venue.id,
                createdById: venueUser,
                title: evTitle,
                description: `Noite com ${artist.name} no ${venue.name}.`,
                startsAt: at,
                durationMinutes: minutes,
                applicationDeadline: new Date(at.getTime() - 7 * 86_400_000),
                slots: 1,
                genres: artist.genres.slice(0, 2),
                paymentType: 'Cachê fixo',
                feeCents: fee,
                conditions: 'Som e luz do local. Passagem de som 2 horas antes.',
                status: 'COMPLETED',
                publishedAt: createdAt,
                filledAt: createdAt,
                completedAt: new Date(at.getTime() + minutes * 60_000),
                createdAt,
              },
              select: { id: true },
            });
            eventId = ev.id;
            stats.events++;
          }
        }
        const confirmedAt = new Date(createdAt.getTime() + 2 * 86_400_000);
        const b = await tx.booking.create({
          data: {
            ...key,
            origin: 'DIRECT',
            eventId,
            createdById: venueUser,
            status,
            createdAt,
            ...(status === 'CONFIRMED' ? { confirmedAt, confirmedById: venueUser } : {}),
          },
        });
        await tx.bookingStatusChange.create({ data: { bookingId: b.id, toStatus: 'NEGOTIATING', actorId: venueUser, actorSide: 'VENUE', note: 'Proposta direta', createdAt } });
        const counter = pr() < 0.4 && status !== 'DECLINED';
        const first = await tx.bookingOffer.create({
          data: {
            bookingId: b.id,
            authorId: venueUser,
            authorSide: 'VENUE',
            performanceAt: at,
            durationMinutes: minutes,
            feeCents: counter ? Math.round((fee * 0.85) / 5000) * 5000 : fee,
            terms: 'Som e luz da casa. Pagamento no dia do show.',
            status: status === 'DECLINED' ? 'DECLINED' : counter ? 'SUPERSEDED' : 'ACCEPTED',
            respondedAt: new Date(createdAt.getTime() + 86_400_000),
            respondedById: artistUser,
            createdAt,
          },
          select: { id: true },
        });
        if (counter) {
          await tx.bookingOffer.create({
            data: {
              bookingId: b.id,
              authorId: artistUser,
              authorSide: 'ARTIST',
              previousOfferId: first.id,
              performanceAt: at,
              durationMinutes: minutes,
              feeCents: fee,
              terms: 'Formação completa; levamos parte do backline.',
              status: 'ACCEPTED',
              respondedAt: new Date(createdAt.getTime() + 36 * 3_600_000),
              respondedById: venueUser,
              createdAt: new Date(createdAt.getTime() + 86_400_000),
            },
          });
        }
        if (status === 'DECLINED') {
          await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'NEGOTIATING', toStatus: 'DECLINED', actorId: artistUser, actorSide: 'ARTIST', note: 'Data indisponível', createdAt: new Date(createdAt.getTime() + 86_400_000) } });
        } else {
          await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'NEGOTIATING', toStatus: 'AGREED', actorId: counter ? venueUser : artistUser, actorSide: counter ? 'VENUE' : 'ARTIST', note: 'Proposta aceita', createdAt: new Date(createdAt.getTime() + 36 * 3_600_000) } });
          if (status === 'CONFIRMED') {
            await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'AGREED', toStatus: 'CONFIRMED', actorId: venueUser, actorSide: 'VENUE', note: 'Contratação confirmada (pagamento é externo à plataforma)', createdAt: confirmedAt } });
          } else {
            await tx.bookingStatusChange.create({ data: { bookingId: b.id, fromStatus: 'AGREED', toStatus: 'CANCELLED', actorId: venueUser, actorSide: 'VENUE', note: 'Evento cancelado pela casa por motivo de força maior', createdAt: confirmedAt } });
          }
        }
        // Conversa
        const thread = pick(pr, MESSAGES);
        for (const [i, [side, body]] of thread.entries()) {
          await tx.bookingMessage.create({ data: { bookingId: b.id, authorId: side === 'VENUE' ? venueUser : artistUser, authorSide: side, body, createdAt: new Date(createdAt.getTime() + (i + 1) * 3 * 3_600_000) } });
          stats.messages++;
        }
        if (plan.kind === 'past') {
          const end = new Date(at.getTime() + minutes * 60_000);
          if (pr() < 0.85) {
            await tx.performance.create({ data: { bookingId: b.id, artistId: artist.id, organizationId: venue.id, performedAt: at, registeredById: venueUser, notes: pick(pr, ['Casa cheia.', 'Ótima noite.', 'Público animado do começo ao fim.', '']), createdAt: end } });
          }
          if (pr() < 0.8) {
            const [rating, comment] = pick(pr, VENUE_REVIEWS);
            await tx.review.create({ data: { bookingId: b.id, authorSide: 'VENUE', authorId: venueUser, rating, comment, createdAt: new Date(end.getTime() + 86_400_000) } });
            stats.reviews++;
            notifications.push({ userId: artistUser, category: 'BOOKINGS', type: 'REVIEW_RECEIVED', title: 'Nova avaliação', body: `${venue.name} avaliou sua apresentação com ${rating} estrela(s).`, link: `/painel/negociacoes/${b.id}`, dedupeKey: `enrich:review:${b.id}:venue`, readAt: pr() < 0.7 ? now : null, createdAt: new Date(end.getTime() + 86_400_000) });
          }
          if (pr() < 0.65) {
            const [rating, comment] = pick(pr, ARTIST_REVIEWS);
            await tx.review.create({ data: { bookingId: b.id, authorSide: 'ARTIST', authorId: artistUser, rating, comment, createdAt: new Date(end.getTime() + 2 * 86_400_000) } });
            stats.reviews++;
          }
          stats.past++;
        } else if (plan.kind === 'upcoming') {
          notifications.push({ userId: artistUser, category: 'BOOKINGS', type: 'BOOKING_CONFIRMED', title: 'Contratação confirmada', body: `${title.split(' — ')[0]} está confirmado e já aparece na sua agenda.`, link: `/painel/negociacoes/${b.id}`, dedupeKey: `enrich:confirmed:${b.id}`, readAt: pr() < 0.5 ? now : null, createdAt: confirmedAt });
          stats.upcoming++;
        } else stats.closed++;
      }, { timeout: 30_000, maxWait: 10_000 });
    }
  }
  if (notifications.length) {
    const res = await prisma.notification.createMany({ data: notifications, skipDuplicates: true });
    stats.notifications = res.count;
  }
  console.warn(
    `Enriquecimento: ${stats.past} shows realizados (${stats.events} eventos encerrados), ${stats.upcoming} próximos shows, ${stats.closed} negociações encerradas, ${stats.reviews} avaliações, ${stats.messages} mensagens, ${stats.notifications} notificações.`,
  );
}
