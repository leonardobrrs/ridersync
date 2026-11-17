import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import { Poster } from '../../components/Poster';
import { Empty, ErrorState, Loading } from '../../components/States';
import { api, qs } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useMeta } from '../../lib/hooks';
import type { PublicVenue, VenueCard } from '../../lib/types';

export function VenuesPage() {
  const [params, setParams] = useSearchParams();
  const { data: meta } = useMeta();
  const f = { q: params.get('q') ?? '', city: params.get('city') ?? '' };
  const q = useQuery({ queryKey: ['venues', f], queryFn: () => api.get<VenueCard[]>(`/public/venues${qs(f)}`) });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n);
  };
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div>
          <h1>Casas de show</h1>
          <p>Espaços que contratam música ao vivo, com estrutura técnica informada.</p>
        </div>
        <div className="cmp-f">
          <label className="field">
            <span className="sr-only">Buscar casa</span>
            <input className="input" type="search" placeholder="Buscar casa…" defaultValue={f.q} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} />
          </label>
          <label className="field">
            <span className="sr-only">Cidade</span>
            <select className="input" value={f.city} onChange={(e) => set('city', e.target.value)}>
              <option value="">Todas as cidades</option>
              {meta?.cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data?.length === 0 && <Empty title="Nenhuma casa encontrada" />}
      <div className="ads">
        {q.data?.map((v) => (
          <article className="ad" key={v.id}>
            <Link to={`/casas/${v.slug}`}>
              {v.openEvents > 0 && <span className="tape">{v.openEvents} vaga(s) aberta(s)</span>}
              <Poster name={v.name} photoUrl={v.photoUrl} top={[v.city, v.state]} bottom={[v.venueKind ?? '', v.capacity ? `${v.capacity} pessoas` : '']} />
              <div className="ad-b">
                <h3>{v.name}</h3>
                <span className="sub">{v.venueKind ?? 'Espaço cultural'}</span>
                <span className="loc">
                  <span>
                    {v.neighborhood ? `${v.neighborhood}, ` : ''}
                    {v.city}
                  </span>
                  <span>{v.equipmentItems} itens técnicos</span>
                </span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export function VenuePublicPage() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['venue', slug], queryFn: () => api.get<PublicVenue>(`/public/venues/${slug}`) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <div className="wrap page"><ErrorState error={q.error} retry={q.refetch} /></div>;
  const v = q.data!;
  return (
    <div className="wrap page">
      <ol className="bc">
        <li>
          <Link to="/casas">Casas</Link>
        </li>
        <li aria-current="page">{v.name}</li>
      </ol>
      <div className="adp">
        <div className="stack">
          <div className="gal">
            <div className="gal-main">
              <Poster name={v.name} photoUrl={v.photoUrl} top={[v.city, v.state]} bottom={[v.venueKind ?? '', v.capacity ? `${v.capacity} pessoas` : '']} ratio="16/10" />
            </div>
          </div>
          <section className="box">
            <div className="adh">
              <h1>{v.name}</h1>
              <p className="muted">{v.venueKind}</p>
            </div>
            <dl className="attrs">
              <div>
                <dt>Endereço</dt>
                <dd>{[v.addressLine, v.neighborhood].filter(Boolean).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Cidade</dt>
                <dd>
                  {v.city}/{v.state}
                </dd>
              </div>
              <div>
                <dt>Capacidade</dt>
                <dd>{v.capacity ? `${v.capacity} pessoas` : '—'}</dd>
              </div>
            </dl>
            {v.description && <p className="prose">{v.description}</p>}
          </section>
          <section className="box sec">
            <h2>Estrutura técnica</h2>
            {v.equipment.length === 0 ? (
              <p className="muted">A casa ainda não informou sua estrutura técnica.</p>
            ) : (
              <ul className="ilist">
                {v.equipment.map((i) => (
                  <li key={i.id}>
                    <span className="ch">{i.isCustom ? 'outro' : ''}</span>
                    <span>
                      {i.name}
                      {i.notes && <small>{i.notes}</small>}
                    </span>
                    <span className="qty">
                      {i.quantity} {i.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="side">
          <section className="box">
            <h2 className="lbl">Oportunidades abertas</h2>
            {v.openEvents.length === 0 ? (
              <p className="hint">Nenhuma inscrição aberta no momento.</p>
            ) : (
              <ul className="list-plain">
                {v.openEvents.map((e) => (
                  <li key={e.id}>
                    <Link className="link" to={`/oportunidades/${e.id}`}>
                      {e.title}
                    </Link>
                    <small className="hint" style={{ display: 'block' }}>
                      {dateTime(e.startsAt)} · inscrições até {dateTime(e.applicationDeadline)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="box">
            <h2 className="lbl">Contatos públicos</h2>
            <dl className="contact">
              {v.instagram && (
                <div>
                  <dt>Instagram</dt>
                  <dd>@{v.instagram}</dd>
                </div>
              )}
              {v.contactEmail && (
                <div>
                  <dt>E-mail</dt>
                  <dd>{v.contactEmail}</dd>
                </div>
              )}
              {v.contactPhone && (
                <div>
                  <dt>Telefone</dt>
                  <dd>{v.contactPhone}</dd>
                </div>
              )}
              {!v.instagram && !v.contactEmail && !v.contactPhone && <p className="hint">Nenhum contato público informado.</p>}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
