import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ProfilePhoto } from '../../components/Media';
import { Avatar, Poster } from '../../components/Poster';
import { Empty, ErrorState, Loading } from '../../components/States';
import { api, qs } from '../../lib/api';
import { dateTime, dayMonth } from '../../lib/format';
import { formatPhone, phoneDigits } from '../../lib/phone';
import { ReviewsSummary } from '../../components/Stars';
import { useMeta } from '../../lib/hooks';
import type { PublicVenue, VenueCard } from '../../lib/types';
import { RiderList } from './ArtistPublicPage';
import { VenueAd } from './MarketplacePage';

/** Visitantes descobrem e pesquisam casas de show (nome, @handle, bairro, tipo e cidade). */
export function VenuesPage() {
  const [params, setParams] = useSearchParams();
  const { data: meta } = useMeta();
  const f = { q: params.get('q') ?? '', city: params.get('city') ?? '', kind: params.get('kind') ?? '' };
  const [term, setTerm] = useState(f.q);
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
          <h1 tabIndex={-1}>Casas de show</h1>
          <p>Espaços que contratam música ao vivo em Alagoas, com estrutura técnica informada.</p>
        </div>
      </div>
      <form
        className="searchbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set('q', term.trim());
        }}
      >
        <label className="field grow">
          <span className="sr-only">Buscar casa de show</span>
          <input className="input" type="search" placeholder="Buscar por nome, @perfil, bairro…" value={term} onChange={(e) => setTerm(e.target.value)} />
        </label>
        <label className="field">
          <span className="sr-only">Cidade</span>
          <select className="input" value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">Todas as cidades</option>
            {meta?.allCities.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="sr-only">Tipo de espaço</span>
          <select className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="">Todos os tipos</option>
            {meta?.venueKinds.map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <button className="btn cue" type="submit">
          Buscar
        </button>
      </form>
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data?.length === 0 && <Empty title="Nenhuma casa encontrada">Tente outro nome, bairro ou cidade.</Empty>}
      <div className="ads">
        {q.data?.map((v) => (
          <VenueAd key={v.id} v={v} />
        ))}
      </div>
    </div>
  );
}

export function VenuePublicPage() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['venue', slug], queryFn: () => api.get<PublicVenue>(`/public/venues/${slug}`) });
  if (q.isLoading) return <Loading />;
  if (q.error)
    return (
      <div className="wrap page">
        <ErrorState error={q.error} retry={q.refetch} />
      </div>
    );
  const v = q.data!;
  return (
    <div className="wrap page">
      <ol className="bc" aria-label="Navegação estrutural">
        <li>
          <Link to="/casas">Casas de show</Link>
        </li>
        <li aria-current="page">{v.name}</li>
      </ol>
      <div className="adp">
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="gal">
            <div className="gal-main">
              {v.photoUrl ? (
                <ProfilePhoto thumbUrl={v.photoThumbUrl} largeUrl={v.photoUrl} name={v.name} />
              ) : (
                <Poster name={v.name} top={[v.city, v.state]} bottom={[v.venueKind ?? '', v.capacity ? `${v.capacity} pessoas` : '']} ratio="16/10" />
              )}
            </div>
          </div>
          <section className="box">
            <div className="adh">
              <h1 tabIndex={-1}>{v.name}</h1>
              <Link className="handle" to={`/casas/${v.slug}`}>
                @{v.slug}
              </Link>
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
            <h2>Próximos shows</h2>
            {v.upcomingShows.length === 0 ? (
              <p className="muted">Nenhum show confirmado no momento.</p>
            ) : (
              <ul className="dates">
                {v.upcomingShows.map((s) => {
                  const d = dayMonth(s.startsAt);
                  return (
                    <li key={s.id}>
                      <span className="dt">
                        <b>{d.day}</b>
                        <small>{d.month}</small>
                      </span>
                      <span className="row">
                        <Avatar name={s.artist.name} photoUrl={s.artist.photoUrl} size={36} />
                        <span>
                          <strong>
                            <Link to={`/artistas/${s.artist.slug}`}>{s.artist.name}</Link>
                          </strong>
                          <small>
                            {s.eventId ? <Link to={`/oportunidades/${s.eventId}`}>{s.title}</Link> : s.title} ·{' '}
                            {new Date(s.startsAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' })}
                          </small>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="box sec">
            <h2>Avaliações de artistas</h2>
            <ReviewsSummary r={v.reviews} empty="Ainda sem avaliações." />
          </section>
          <section className="box sec">
            <h2>Estrutura técnica</h2>
            <RiderList rider={{ notes: '', items: v.equipment }} empty="A casa ainda não informou sua estrutura técnica." />
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
                  <dd>
                    <a className="link" href={`https://instagram.com/${v.instagram}`} target="_blank" rel="noopener noreferrer">
                      @{v.instagram}
                    </a>
                  </dd>
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
                  <dd>
                    <a className="link" href={`tel:+55${phoneDigits(v.contactPhone)}`}>{formatPhone(v.contactPhone)}</a>
                  </dd>
                </div>
              )}
              {v.website && (
                <div>
                  <dt>Site</dt>
                  <dd>
                    <a className="link" href={v.website} target="_blank" rel="noopener noreferrer">
                      Abrir site
                    </a>
                  </dd>
                </div>
              )}
              {!v.instagram && !v.contactEmail && !v.contactPhone && !v.website && <p className="hint">Nenhum contato público informado.</p>}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
