import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { Poster } from '../../components/Poster';
import { Empty, ErrorState } from '../../components/States';
import { api, qs } from '../../lib/api';
import { dayMonth, money } from '../../lib/format';
import { useMe, useMeta } from '../../lib/hooks';
import type { ArtistCard, EventPublic, HomeData, Paged, PublicShow, VenueCard } from '../../lib/types';

export function ArtistAd({ a }: { a: ArtistCard }) {
  return (
    <article className="ad">
      <Link to={`/artistas/${a.slug}`} aria-label={`${a.name} — ver perfil`}>
        <span className="tape">{a.kind === 'BAND' ? 'Banda' : (a.mainInstrument ?? 'Músico')}</span>
        <Poster name={a.name} photoUrl={a.photoUrl} top={[a.city ?? '', a.state]} bottom={[a.genres.slice(0, 2).join(' · '), a.formats[0] ?? '']} />
        <div className="ad-b">
          <h3>{a.name}</h3>
          <span className="handle">@{a.slug}</span>
          <span className="sub">{a.headline || a.genres.join(', ') || '—'}</span>
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
          <h3>{v.name}</h3>
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
        <Link className="show-a" to={`/artistas/${s.artist.slug}`}>
          {s.artist.name}
        </Link>
        <span className="show-t">{s.title}</span>
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

function OpportunityTile({ e }: { e: EventPublic }) {
  return (
    <Link className="opp-tile" to={`/oportunidades/${e.id}`}>
      <strong>{e.title}</strong>
      <span>
        {e.location.name ?? e.organizer.name} · {e.location.city}
      </span>
      <small>
        {e.slots} vaga(s) · {e.feeCents != null ? money(e.feeCents) : (e.paymentType ?? 'Cachê a combinar')}
      </small>
    </Link>
  );
}

const CATEGORIES = [
  { kind: '', label: 'Todos', icon: 'grid' },
  { kind: 'SOLO', label: 'Músicos', icon: 'mic' },
  { kind: 'BAND', label: 'Bandas', icon: 'users' },
  { kind: 'VENUE', label: 'Casas de show', icon: 'venue' },
];

function CategoryBar({ params, set }: { params: URLSearchParams; set: (patch: Record<string, string>) => void }) {
  const { data: meta } = useMeta();
  const kind = params.get('kind') ?? '';
  const instrument = params.get('instrument') ?? '';
  return (
    <nav className="cats" aria-label="Categorias">
      <div className="wrap">
        {CATEGORIES.map((c) => (
          <button key={c.label} type="button" className="cat" aria-pressed={!instrument && kind === c.kind} onClick={() => set({ kind: c.kind, instrument: '' })}>
            <span className="ci">
              <Icon name={c.icon} size={22} />
            </span>
            {c.label}
          </button>
        ))}
        <span className="vsep" aria-hidden="true" />
        {meta?.instruments.map((i) => (
          <button key={i} type="button" className="cat sm" aria-pressed={instrument === i} onClick={() => set({ instrument: instrument === i ? '' : i, kind: '' })}>
            <span className="ci">
              <Icon name="music" size={18} />
            </span>
            {i}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Filters({ params, set, venues }: { params: URLSearchParams; set: (patch: Record<string, string>) => void; venues: boolean }) {
  const { data: meta } = useMeta();
  return (
    <>
      <label className="fgroup">
        <span className="lbl">Cidade</span>
        <select className="input" value={params.get('city') ?? ''} onChange={(e) => set({ city: e.target.value })}>
          <option value="">Todas as cidades de Alagoas</option>
          {meta?.allCities.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      {venues ? (
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

export function MarketplacePage() {
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const home = useQuery({ queryKey: ['home'], queryFn: () => api.get<HomeData>('/public/home'), enabled: showHome });
  const artists = useQuery({
    queryKey: ['artists', filters],
    queryFn: () => api.get<Paged<ArtistCard>>(`/public/artists${qs({ ...filters, pageSize: 24 })}`),
    placeholderData: keepPreviousData,
    enabled: !venuesOnly,
  });
  const showVenues = venuesOnly || (!kind && !filters.instrument && !filters.genre && !filters.format);
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
      : `${{ '': 'Músicos, bandas e casas', SOLO: 'Músicos', BAND: 'Bandas', VENUE: 'Casas de show' }[kind] ?? 'Artistas'} em ${place}`;
  const venueList = venues.data ?? [];

  return (
    <>
      <CategoryBar params={params} set={set} />
      <div className="wrap mk">
        <aside className="filters" aria-label="Filtros">
          <Filters params={params} set={set} venues={venuesOnly} />
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

          {showHome && home.data && home.data.shows.length > 0 && (
            <Strip title="Próximos shows confirmados">
              {home.data.shows.map((s) => (
                <ShowCard key={s.id} s={s} />
              ))}
            </Strip>
          )}
          {showHome && home.data && home.data.opportunities.length > 0 && (
            <Strip
              title="Oportunidades abertas"
              action={
                <Link className="link" to="/oportunidades">
                  Ver todas
                </Link>
              }
            >
              {home.data.opportunities.map((e) => (
                <OpportunityTile key={e.id} e={e} />
              ))}
            </Strip>
          )}

          <div className="rhead">
            <div>
              <h1 id="res-title">{title}</h1>
              <p className="muted" aria-live="polite">
                {venuesOnly
                  ? venues.data
                    ? `${venueList.length} casa(s) de show`
                    : 'Carregando…'
                  : artists.data
                    ? `${artists.data.total} perfil(is) público(s)${showVenues && venueList.length ? ` e ${venueList.length} casa(s)` : ''}`
                    : 'Carregando…'}
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
              {!venuesOnly && (
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

          {(artists.error || venues.error) && <ErrorState error={artists.error ?? venues.error} retry={() => (artists.refetch(), venues.refetch())} />}
          {!venuesOnly && artists.isLoading && (
            <div className="ads">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="skel" key={i} />
              ))}
            </div>
          )}
          {!venuesOnly && artists.data && artists.data.items.length === 0 && (!showVenues || venueList.length === 0) && (
            <Empty title="Nenhum resultado com esses filtros" action={active.length ? <button className="btn sm" type="button" onClick={clear}>Limpar filtros</button> : undefined}>
              Tente outra cidade, outro estilo ou outro termo de busca.
            </Empty>
          )}
          {!venuesOnly && artists.data && artists.data.items.length > 0 && (
            <div className="ads" style={{ opacity: artists.isPlaceholderData ? 0.6 : 1 }}>
              {artists.data.items.map((a) => (
                <ArtistAd key={a.id} a={a} />
              ))}
            </div>
          )}
          {!venuesOnly && totalPages > 1 && (
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
          {venuesOnly && venues.data && venueList.length === 0 && <Empty title="Nenhuma casa de show encontrada" />}
        </section>
        <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
          <div className="stack">
            <Filters params={params} set={set} venues={venuesOnly} />
            <button className="btn cue block" type="button" onClick={() => setFiltersOpen(false)}>
              Ver resultados
            </button>
          </div>
        </Dialog>
      </div>
    </>
  );
}
