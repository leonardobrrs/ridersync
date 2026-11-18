import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { Poster } from '../../components/Poster';
import { Empty, ErrorState } from '../../components/States';
import { api, qs } from '../../lib/api';
import { date, dayMonth, money } from '../../lib/format';
import { useMe, useMeta } from '../../lib/hooks';
import type { ArtistCard, EventPublic, HomeData, Paged, PublicShow, VenueCard } from '../../lib/types';
import { InstrumentLabel } from '../../components/InstrumentLabel';
import { instrumentIcon } from '../../lib/instruments';

export function ArtistAd({ a }: { a: ArtistCard }) {
  return (
    <article className="ad">
      <Link to={`/artistas/${a.slug}`} aria-label={`${a.name} — ver perfil`}>
        {a.kind === 'BAND' ? (
          <span className="tape">
            <Icon name="users" size={12} />
            Banda
          </span>
        ) : (
          <InstrumentLabel className="tape" size={12} value={a.mainInstrument ?? 'Músico'} />
        )}
        <Poster name={a.name} photoUrl={a.photoUrl} top={[a.city ?? '', a.state]} bottom={[a.genres.slice(0, 2).join(' · '), a.formats[0] ?? '']} />
        <div className="ad-b">
          <h3 title={a.name}>{a.name}</h3>
          <span className="handle">@{a.slug}</span>
          <span className="sub" title={a.headline || undefined}>{a.headline || a.genres.join(', ') || '—'}</span>
          <span className="price">
            {a.baseFeeCents != null ? money(a.baseFeeCents) : 'A combinar'}
            <small>{a.baseFeeCents != null ? 'cachê a partir de' : 'cachê'}</small>
          </span>
          <span className="loc">
            <span>
              {a.city ?? '—'}/{a.state}
            </span>
            {a.careerStartYear && <span>desde {a.careerStartYear}</span>}
          </span>
        </div>
      </Link>
    </article>
  );
}

export function VenueAd({ v }: { v: Pick<VenueCard, 'slug' | 'name' | 'venueKind' | 'city' | 'state' | 'neighborhood' | 'capacity' | 'photoUrl'> & { openEvents?: number } }) {
  return (
    <article className="ad">
      <Link to={`/casas/${v.slug}`} aria-label={`${v.name} — ver casa de show`}>
        <span className="tape">{v.openEvents ? `${v.openEvents} vaga(s) aberta(s)` : 'Casa de show'}</span>
        <Poster name={v.name} photoUrl={v.photoUrl} top={[v.city, v.state]} bottom={[v.venueKind ?? '', v.capacity ? `${v.capacity} pessoas` : '']} />
        <div className="ad-b">
          <h3 title={v.name}>{v.name}</h3>
          <span className="handle">@{v.slug}</span>
          <span className="sub">{v.venueKind ?? 'Espaço cultural'}</span>
          <span className="price">
            {v.capacity ? `Até ${v.capacity} pessoas` : 'Capacidade a informar'}
            <small>{v.neighborhood ? `${v.neighborhood}, ${v.city}` : v.city}</small>
          </span>
        </div>
      </Link>
    </article>
  );
}

export function ShowCard({ s }: { s: PublicShow }) {
  const d = dayMonth(s.startsAt);
  const time = new Date(s.startsAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
  return (
    <article className="show">
      <span className="show-d" aria-hidden="true">
        <b>{d.day}</b>
        <small>{d.month}</small>
      </span>
      <div className="show-b">
        <Link className="show-a" to={`/artistas/${s.artist.slug}`} title={s.artist.name}>
          {s.artist.name}
        </Link>
        <span className="show-t" title={s.title}>{s.title}</span>
        <span className="show-m">
          <Icon name="pin" size={14} />
          {s.place.venueSlug ? <Link to={`/casas/${s.place.venueSlug}`}>{s.place.name}</Link> : (s.place.name ?? 'Local a confirmar')}
          {s.place.city ? ` · ${s.place.city}` : ''}
        </span>
        <span className="show-m">
          <Icon name="clock" size={14} />
          <span className="sr-only">Data e horário: {d.day} de {d.month}, </span>
          {time}
        </span>
      </div>
    </article>
  );
}

/** Oportunidade em formato de card (mesma grade dos anúncios). Usa a imagem do evento ou um cartaz gerado. */
export function OpportunityCard({ e }: { e: EventPublic }) {
  const d = dayMonth(e.startsAt);
  const where = e.location.name ?? e.organizer.name;
  return (
    <article className="ad opp-card">
      <Link to={`/oportunidades/${e.id}`} aria-label={`${e.title} — ver oportunidade`}>
        <span className="tape">{e.visibility === 'PRIVATE' ? 'Evento privado' : `${e.slots} vaga${e.slots > 1 ? 's' : ''}`}</span>
        <Poster name={e.title} photoUrl={e.imageThumbUrl} top={[`${d.day} ${d.month}`, e.location.city ?? '']} bottom={[e.genres.slice(0, 2).join(' · '), e.paymentType ?? '']} />
        <div className="ad-b">
          <h3 title={e.title}>{e.title}</h3>
          <span className="handle" title={where}>
            {where}
          </span>
          <span className="sub">
            Show em {d.day} de {d.month} · {e.location.city ?? '—'}
          </span>
          <span className="price">
            {e.feeCents != null ? money(e.feeCents) : (e.paymentType ?? 'A combinar')}
            <small>cachê</small>
          </span>
          <span className="loc">
            <span>Inscrições até {date(e.applicationDeadline)}</span>
          </span>
        </div>
      </Link>
    </article>
  );
}

const CATEGORIES = [
  { kind: '', label: 'Todos', icon: 'grid' },
  { kind: 'SOLO', label: 'Músicos', icon: 'mic' },
  { kind: 'BAND', label: 'Bandas', icon: 'users' },
  { kind: 'VENUE', label: 'Casas de show', icon: 'venue' },
];

function CategoryBar({ params, set, personal }: { params: URLSearchParams; set: (patch: Record<string, string>) => void; personal: boolean }) {
  const { data: meta } = useMeta();
  const kind = params.get('kind') ?? '';
  const instrument = params.get('instrument') ?? '';
  return (
    <nav className="cats" aria-label="Categorias">
      <div className="wrap">
        {CATEGORIES.map((c) => (
          <button key={c.label} type="button" className="cat" aria-pressed={!instrument && kind === c.kind} onClick={() => set({ kind: c.kind, instrument: '' })}>
            <span className="ci">
              <Icon name={c.kind === '' && personal ? 'home' : c.icon} size={22} />
            </span>
            {c.kind === '' && personal ? 'Para você' : c.label}
          </button>
        ))}
        <span className="vsep" aria-hidden="true" />
        {meta?.instruments.map((i) => (
          <button key={i} type="button" className="cat sm" aria-pressed={instrument === i} onClick={() => set({ instrument: instrument === i ? '' : i, kind: '' })}>
            <span className="ci">
              <Icon name={instrumentIcon(i)} size={20} />
            </span>
            {i}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** venues: só casas; feed: feed do artista (oportunidades + casas: cidade e estilo); artists: busca de artistas. */
function Filters({ params, set, mode }: { params: URLSearchParams; set: (patch: Record<string, string>) => void; mode: 'venues' | 'feed' | 'artists' }) {
  const { data: meta } = useMeta();
  const venues = mode === 'venues';
  return (
    <>
      <label className="fgroup">
        <span className="lbl">Cidade</span>
        <select className="input" value={params.get('city') ?? ''} onChange={(e) => set({ city: e.target.value })}>
          <option value="">Todas as cidades de Alagoas</option>
          {meta?.allCities.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      {mode === 'feed' ? (
        <label className="fgroup">
          <span className="lbl">Estilo procurado</span>
          <select className="input" value={params.get('genre') ?? ''} onChange={(e) => set({ genre: e.target.value })}>
            <option value="">Todos os estilos</option>
            {meta?.genres.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
      ) : venues ? (
        <label className="fgroup">
          <span className="lbl">Tipo de espaço</span>
          <select className="input" value={params.get('venueKind') ?? ''} onChange={(e) => set({ venueKind: e.target.value })}>
            <option value="">Todos os tipos</option>
            {meta?.venueKinds.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
      ) : (
        <>
          <label className="fgroup">
            <span className="lbl">Estilo</span>
            <select className="input" value={params.get('genre') ?? ''} onChange={(e) => set({ genre: e.target.value })}>
              <option value="">Todos os estilos</option>
              {meta?.genres.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="fgroup">
            <span className="lbl">Instrumento</span>
            <select className="input" value={params.get('instrument') ?? ''} onChange={(e) => set({ instrument: e.target.value })}>
              <option value="">Qualquer instrumento</option>
              {meta?.instruments.map((i) => <option key={i}>{i}</option>)}
            </select>
          </label>
          <label className="fgroup">
            <span className="lbl">Formação</span>
            <select className="input" value={params.get('format') ?? ''} onChange={(e) => set({ format: e.target.value })}>
              <option value="">Qualquer formação</option>
              {meta?.formats.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        </>
      )}
    </>
  );
}

function Strip({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="strip" aria-label={title}>
      <div className="rhead">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="rowscroll">{children}</div>
    </section>
  );
}

/**
 * Página inicial com feed por tipo de conta (reunião de 18/11):
 *  - visitante: vitrine completa (shows confirmados, oportunidades, artistas e casas);
 *  - artista/banda: "Para você" mostra só o que ele procura — oportunidades abertas e casas de show, em cards.
 *    As abas Músicos/Bandas continuam listando todos os perfis;
 *  - contratante/casa: "Para você" mostra quem ele contrata — artistas e bandas — e os shows confirmados
 *    (referência do circuito). Oportunidades (vagas para artistas) e outras casas saem do feed; as casas
 *    continuam na aba "Casas de show".
 * Com busca por texto, todos veem o resultado completo (artistas e casas).
 */
export function MarketplacePage() {
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const accountType = me?.user.accountType ?? null;
  const kind = params.get('kind') ?? '';
  const venuesOnly = kind === 'VENUE';
  const page = Number(params.get('page') ?? '1') || 1;
  const filters = {
    q: params.get('q') ?? '',
    genre: params.get('genre') ?? '',
    city: params.get('city') ?? '',
    kind: venuesOnly ? '' : kind,
    format: params.get('format') ?? '',
    instrument: params.get('instrument') ?? '',
    sort: params.get('sort') ?? 'recent',
    page,
  };
  const active = ['q', 'genre', 'city', 'kind', 'format', 'instrument', 'venueKind'].filter((k) => params.get(k));
  const showHome = active.length === 0 && page === 1;
  // A busca por texto (barra do topo: "músico, banda ou casa") sempre mostra o resultado completo para todos.
  const artistFeed = accountType === 'ARTIST' && kind === '' && !filters.q && !filters.instrument && !filters.format;
  const contractorFeed = accountType === 'CONTRACTOR' && kind === '' && !filters.q;
  const showArtists = !venuesOnly && !artistFeed;
  const showVenues = venuesOnly || artistFeed || (!contractorFeed && !kind && !filters.instrument && !filters.genre && !filters.format);

  const home = useQuery({ queryKey: ['home'], queryFn: () => api.get<HomeData>('/public/home'), enabled: showHome && !artistFeed });
  const eventFilters = { q: filters.q, genre: filters.genre, city: filters.city };
  // Mesma chave da página de oportunidades: o cache é compartilhado. Com sessão de artista inclui eventos privados.
  const opportunities = useQuery({
    queryKey: ['events', eventFilters],
    queryFn: () => api.get<EventPublic[]>(`/public/events${qs(eventFilters)}`),
    enabled: artistFeed,
  });
  const artists = useQuery({
    queryKey: ['artists', filters],
    queryFn: () => api.get<Paged<ArtistCard>>(`/public/artists${qs({ ...filters, pageSize: 24 })}`),
    placeholderData: keepPreviousData,
    enabled: showArtists,
  });
  const venues = useQuery({
    queryKey: ['venues', { q: filters.q, city: filters.city, kind: params.get('venueKind') ?? '' }],
    queryFn: () => api.get<VenueCard[]>(`/public/venues${qs({ q: filters.q, city: filters.city, kind: params.get('venueKind') ?? '' })}`),
    enabled: showVenues,
  });

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const clear = () => setParams(new URLSearchParams());
  const totalPages = artists.data ? Math.max(1, Math.ceil(artists.data.total / artists.data.pageSize)) : 1;
  const place = filters.city || 'Alagoas';
  const title = filters.q
    ? `Resultados para “${filters.q}”`
    : filters.instrument
      ? `${filters.instrument} em ${place}`
      : artistFeed
        ? `Oportunidades e casas de show em ${place}`
        : contractorFeed
          ? `Músicos e bandas para contratar em ${place}`
          : `${{ '': 'Músicos, bandas e casas', SOLO: 'Músicos', BAND: 'Bandas', VENUE: 'Casas de show' }[kind] ?? 'Artistas'} em ${place}`;
  const venueList = venues.data ?? [];
  const oppList = opportunities.data ?? [];
  const filterMode = venuesOnly ? 'venues' : artistFeed ? 'feed' : 'artists';
  const hasVenue = me?.organizations.some((o) => o.type === 'VENUE');

  const summary = venuesOnly
    ? venues.data
      ? `${venueList.length} casa(s) de show`
      : 'Carregando…'
    : artistFeed
      ? opportunities.data && venues.data
        ? `${oppList.length} oportunidade(s) aberta(s) e ${venueList.length} casa(s) de show`
        : 'Carregando…'
      : artists.data
        ? `${artists.data.total} perfil(is) público(s)${showVenues && venueList.length ? ` e ${venueList.length} casa(s)` : ''}`
        : 'Carregando…';

  return (
    <>
      <CategoryBar params={params} set={set} personal={!!accountType} />
      <div className="wrap mk">
        <aside className="filters" aria-label="Filtros">
          <Filters params={params} set={set} mode={filterMode} />
        </aside>
        <section aria-labelledby="res-title" className="stack" style={{ minWidth: 0 }}>
          {!me && (
            <div className="promo promo-wide">
              <div className="stack-sm">
                <span className="tape" style={{ justifySelf: 'start' }}>
                  Grátis
                </span>
                <strong>Toca em algum lugar ou contrata música ao vivo?</strong>
                <span>Crie seu perfil de artista ou de contratante e encontre apresentações em Alagoas.</span>
              </div>
              <Link className="btn cue" to="/cadastro">
                Criar conta grátis
              </Link>
            </div>
          )}
          {contractorFeed && showHome && (
            <div className="promo promo-wide">
              <div className="stack-sm">
                <strong>Precisa de música ao vivo?</strong>
                <span>Publique um evento e receba candidaturas, ou convide um artista direto pelo perfil dele.</span>
              </div>
              <Link className="btn cue" to={hasVenue ? '/painel/casas' : '/painel/eventos/novo'}>
                Publicar evento
              </Link>
            </div>
          )}

          {showHome && !artistFeed && home.data && home.data.shows.length > 0 && (
            <Strip title="Próximos shows confirmados">
              {home.data.shows.map((s) => (
                <ShowCard key={s.id} s={s} />
              ))}
            </Strip>
          )}
          {showHome && !accountType && home.data && home.data.opportunities.length > 0 && (
            <Strip
              title="Oportunidades abertas"
              action={
                <Link className="link" to="/oportunidades">
                  Ver todas
                </Link>
              }
            >
              {home.data.opportunities.map((e) => (
                <OpportunityCard key={e.id} e={e} />
              ))}
            </Strip>
          )}

          <div className="rhead">
            <div>
              <h1 id="res-title">{title}</h1>
              <p className="muted" aria-live="polite">
                {summary}
                {active.length > 0 && (
                  <>
                    {' · '}
                    <button className="link" type="button" onClick={clear}>
                      limpar filtros
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="rtools">
              <button className="btn sm fbtn" type="button" onClick={() => setFiltersOpen(true)}>
                <Icon name="list" size={16} /> Filtros{active.length ? ` (${active.length})` : ''}
              </button>
              {showArtists && (
                <>
                  <label className="sr-only" htmlFor="sort">
                    Ordenar
                  </label>
                  <select id="sort" className="input" value={filters.sort} onChange={(e) => set({ sort: e.target.value })}>
                    <option value="recent">Mais recentes</option>
                    <option value="name">Nome (A–Z)</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {(artists.error || venues.error || opportunities.error) && (
            <ErrorState error={artists.error ?? venues.error ?? opportunities.error} retry={() => (artists.refetch(), venues.refetch(), opportunities.refetch())} />
          )}

          {artistFeed && (
            <section className="stack" aria-label="Oportunidades abertas">
              <div className="rhead">
                <h2 className="sec-title">Oportunidades abertas</h2>
                <Link className="link" to="/oportunidades">
                  Ver todas
                </Link>
              </div>
              {opportunities.isLoading && (
                <div className="ads">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div className="skel" key={i} />
                  ))}
                </div>
              )}
              {opportunities.data && oppList.length === 0 && (
                <Empty title="Nenhuma oportunidade aberta com esses filtros">Volte em breve ou procure casas de show abaixo e envie seu perfil.</Empty>
              )}
              {oppList.length > 0 && (
                <div className="ads">
                  {oppList.slice(0, 12).map((e) => (
                    <OpportunityCard key={e.id} e={e} />
                  ))}
                </div>
              )}
            </section>
          )}

          {showArtists && artists.isLoading && (
            <div className="ads">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="skel" key={i} />
              ))}
            </div>
          )}
          {showArtists && artists.data && artists.data.items.length === 0 && (!showVenues || venueList.length === 0) && (
            <Empty title="Nenhum resultado com esses filtros" action={active.length ? <button className="btn sm" type="button" onClick={clear}>Limpar filtros</button> : undefined}>
              Tente outra cidade, outro estilo ou outro termo de busca.
            </Empty>
          )}
          {showArtists && artists.data && artists.data.items.length > 0 && (
            <div className="ads" style={{ opacity: artists.isPlaceholderData ? 0.6 : 1 }}>
              {artists.data.items.map((a) => (
                <ArtistAd key={a.id} a={a} />
              ))}
            </div>
          )}
          {showArtists && totalPages > 1 && (
            <nav className="row pager" aria-label="Paginação">
              <button className="btn sm" type="button" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>
                Anterior
              </button>
              <span className="muted">
                Página {page} de {totalPages}
              </span>
              <button className="btn sm" type="button" disabled={page >= totalPages} onClick={() => set({ page: String(page + 1) })}>
                Próxima
              </button>
            </nav>
          )}

          {showVenues && venueList.length > 0 && (
            <section className="stack" aria-label="Casas de show">
              {!venuesOnly && <h2 className="sec-title">Casas de show</h2>}
              <div className="ads">
                {(venuesOnly ? venueList : venueList.slice(0, 8)).map((v) => (
                  <VenueAd key={v.id} v={v} />
                ))}
              </div>
              {!venuesOnly && venueList.length > 8 && (
                <button className="btn sm" type="button" onClick={() => set({ kind: 'VENUE' })}>
                  Ver todas as casas de show
                </button>
              )}
            </section>
          )}
          {(venuesOnly || artistFeed) && venues.data && venueList.length === 0 && <Empty title="Nenhuma casa de show encontrada" />}
        </section>
        <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
          <div className="stack">
            <Filters params={params} set={set} mode={filterMode} />
            <button className="btn cue block" type="button" onClick={() => setFiltersOpen(false)}>
              Ver resultados
            </button>
          </div>
        </Dialog>
      </div>
    </>
  );
}
