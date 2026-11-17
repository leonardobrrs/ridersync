import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { Poster } from '../../components/Poster';
import { Empty, ErrorState } from '../../components/States';
import { api, qs } from '../../lib/api';
import { money } from '../../lib/format';
import { useMe, useMeta } from '../../lib/hooks';
import type { ArtistCard, Paged } from '../../lib/types';

export function ArtistAd({ a }: { a: ArtistCard }) {
  return (
    <article className="ad">
      <Link to={`/artistas/${a.slug}`} aria-label={`${a.name} — ver perfil`}>
        <span className="tape">{a.kind === 'BAND' ? 'Banda' : (a.mainInstrument ?? 'Músico')}</span>
        <Poster name={a.name} photoUrl={a.photoUrl} top={[a.city ?? '', a.state]} bottom={[a.genres.slice(0, 2).join(' · '), a.formats[0] ?? '']} />
        <div className="ad-b">
          <h3>{a.name}</h3>
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

function Filters({ params, set }: { params: URLSearchParams; set: (k: string, v: string) => void }) {
  const { data: meta } = useMeta();
  const radio = (name: string, value: string, label: string): ReactNode => (
    <label className="check" key={value || 'all'}>
      <input type="radio" name={name} checked={(params.get(name) ?? '') === value} onChange={() => set(name, value)} />
      {label}
    </label>
  );
  return (
    <>
      <div className="fgroup">
        <h3 className="lbl">Tipo</h3>
        {radio('kind', '', 'Todos')}
        {radio('kind', 'SOLO', 'Músicos')}
        {radio('kind', 'BAND', 'Bandas')}
      </div>
      <label className="fgroup">
        <span className="lbl">Estilo</span>
        <select className="input" value={params.get('genre') ?? ''} onChange={(e) => set('genre', e.target.value)}>
          <option value="">Todos os estilos</option>
          {meta?.genres.map((g) => <option key={g}>{g}</option>)}
        </select>
      </label>
      <label className="fgroup">
        <span className="lbl">Cidade</span>
        <select className="input" value={params.get('city') ?? ''} onChange={(e) => set('city', e.target.value)}>
          <option value="">Todas as cidades</option>
          {meta?.cities.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="fgroup">
        <span className="lbl">Formação</span>
        <select className="input" value={params.get('format') ?? ''} onChange={(e) => set('format', e.target.value)}>
          <option value="">Qualquer formação</option>
          {meta?.formats.map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
    </>
  );
}

export function MarketplacePage() {
  const [params, setParams] = useSearchParams();
  const { data: me } = useMe();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const page = Number(params.get('page') ?? '1') || 1;
  const filters = {
    q: params.get('q') ?? '',
    genre: params.get('genre') ?? '',
    city: params.get('city') ?? '',
    kind: params.get('kind') ?? '',
    format: params.get('format') ?? '',
    sort: params.get('sort') ?? 'recent',
    page,
  };
  const q = useQuery({
    queryKey: ['artists', filters],
    queryFn: () => api.get<Paged<ArtistCard>>(`/public/artists${qs({ ...filters, pageSize: 24 })}`),
    placeholderData: keepPreviousData,
  });
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next);
  };
  const active = ['q', 'genre', 'city', 'kind', 'format'].filter((k) => params.get(k));
  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <div className="wrap mk">
      <aside className="filters" aria-label="Filtros">
        <Filters params={params} set={set} />
        {!me && (
          <div className="promo">
            <strong>É músico, banda ou casa de show?</strong>
            <p>Crie seu perfil, publique seu rider e encontre apresentações em Alagoas.</p>
            <Link className="btn cue sm" to="/cadastro">
              Criar conta grátis
            </Link>
          </div>
        )}
      </aside>
      <section aria-labelledby="res-title">
        <div className="rhead">
          <div>
            <h1 id="res-title">{filters.q ? `Resultados para “${filters.q}”` : 'Músicos e bandas'}</h1>
            <p className="muted" aria-live="polite">
              {q.data ? `${q.data.total} perfil(is) público(s)` : 'Carregando…'}
              {active.length > 0 && (
                <>
                  {' · '}
                  <button className="link" type="button" onClick={() => setParams(new URLSearchParams())}>
                    limpar filtros
                  </button>
                </>
              )}
            </p>
          </div>
          <div className="rtools">
            <button className="btn sm fbtn" type="button" onClick={() => setFiltersOpen(true)}>
              Filtros{active.length ? ` (${active.length})` : ''}
            </button>
            <label className="sr-only" htmlFor="sort">
              Ordenar
            </label>
            <select id="sort" className="input" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="recent">Mais recentes</option>
              <option value="name">Nome (A–Z)</option>
            </select>
          </div>
        </div>
        {q.error && <ErrorState error={q.error} retry={q.refetch} />}
        {q.isLoading && (
          <div className="ads">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="skel" key={i} />
            ))}
          </div>
        )}
        {q.data && q.data.items.length === 0 && (
          <Empty title="Nenhum perfil encontrado" action={active.length ? <button className="btn sm" type="button" onClick={() => setParams(new URLSearchParams())}>Limpar filtros</button> : undefined}>
            Tente outros filtros ou termos de busca.
          </Empty>
        )}
        {q.data && q.data.items.length > 0 && (
          <div className="ads" style={{ opacity: q.isPlaceholderData ? 0.6 : 1 }}>
            {q.data.items.map((a) => (
              <ArtistAd key={a.id} a={a} />
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <nav className="row" style={{ justifyContent: 'center', marginTop: 20 }} aria-label="Paginação">
            <button className="btn sm" type="button" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>
              Anterior
            </button>
            <span className="muted">
              Página {page} de {totalPages}
            </span>
            <button className="btn sm" type="button" disabled={page >= totalPages} onClick={() => set('page', String(page + 1))}>
              Próxima
            </button>
          </nav>
        )}
      </section>
      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
        <div className="stack">
          <Filters params={params} set={set} />
          <button className="btn cue block" type="button" onClick={() => setFiltersOpen(false)}>
            Ver resultados
          </button>
        </div>
      </Dialog>
    </div>
  );
}
