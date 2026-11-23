import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ProfilePhoto } from '../../components/Media';
import { Avatar, Poster } from '../../components/Poster';
import { Empty, ErrorState, Loading } from '../../components/States';
import { Tabs } from '../../components/Tabs';
import { api, qs } from '../../lib/api';
import { dateTime, dayMonth } from '../../lib/format';
import { ReviewsSummary } from '../../components/Stars';
import { useMe, useMeta } from '../../lib/hooks';
import type { PublicVenue, VenueCard } from '../../lib/types';
import { CompatibilityView } from '../artist/Compatibility';
import { RiderList } from './ArtistPublicPage';
import { VenueAd } from './MarketplacePage';
import { ContactIcons, ContactList } from '../../components/ContactLinks';

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

const VENUE_TABS = ['sobre', 'rider'] as const;
type VenueTab = (typeof VENUE_TABS)[number];

/**
 * Aba "Rider" da casa: a estrutura técnica que a casa oferece e, para artista logado, a comparação AUTOMÁTICA do rider
 * dele (o que ele precisa, descontado o que já possui) com esse inventário. A comparação só roda ao abrir a aba.
 */
function VenueRiderTab({ v }: { v: PublicVenue }) {
  const { data: me } = useMe();
  const identities = [
    ...(me?.musician ? [{ id: me.musician.id, label: `${me.musician.name} (perfil individual)` }] : []),
    ...(me?.bands.map((b) => ({ id: b.artist.id, label: `${b.artist.name} (banda)` })) ?? []),
  ];
  const [picked, setPicked] = useState('');
  const artistId = identities.some((i) => i.id === picked) ? picked : (identities[0]?.id ?? '');
  const isArtist = me?.user.accountType === 'ARTIST';
  return (
    <div className="stack">
      {isArtist && identities.length > 0 && (
        <section className="box stack" aria-label="Comparação com o seu rider">
          <div className="row between">
            <h2>Seu rider nesta casa</h2>
            {identities.length > 1 && (
              <label className="field" style={{ minWidth: 220 }}>
                <span className="sr-only">Comparar como</span>
                <select className="input" value={artistId} onChange={(e) => setPicked(e.target.value)}>
                  {identities.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="hint">
            Comparação automática do seu rider (o que você precisa para tocar, descontado o que você já possui) com a estrutura de {v.name}.
          </p>
          <CompatibilityView key={artistId} artistId={artistId} organizationId={v.id} embedded />
        </section>
      )}
      {isArtist && identities.length === 0 && (
        <section className="box">
          <p className="hint">
            Para ver como o seu rider se compara com esta casa, <Link className="link" to="/painel/perfil">crie seu perfil</Link> ou entre numa banda e cadastre o rider.
          </p>
        </section>
      )}
      {!me && (
        <section className="box">
          <p className="hint">
            <Link className="link" to="/entrar">Entre com sua conta de artista</Link> para ver, automaticamente, como o seu rider se compara com a estrutura desta casa.
          </p>
        </section>
      )}
      <section className="box sec">
        <h2>Estrutura técnica da casa</h2>
        <p className="hint">Equipamentos e recursos que a casa oferece aos artistas.</p>
        <RiderList rider={{ notes: '', items: v.equipment }} empty="A casa ainda não informou sua estrutura técnica." />
      </section>
    </div>
  );
}

export function VenuePublicPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const q = useQuery({ queryKey: ['venue', slug], queryFn: () => api.get<PublicVenue>(`/public/venues/${slug}`) });
  const tab: VenueTab = VENUE_TABS.includes(params.get('aba') as VenueTab) ? (params.get('aba') as VenueTab) : 'sobre';
  const setTab = (t: string) => {
    const n = new URLSearchParams(params);
    if (t === 'sobre') n.delete('aba');
    else n.set('aba', t);
    setParams(n, { replace: true });
  };
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
              <ContactIcons contacts={{ instagram: v.instagram, email: v.contactEmail, phone: v.contactPhone, website: v.website }} />
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
          <Tabs
            label="Seções do perfil da casa"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'sobre', label: 'Sobre' },
              { id: 'rider', label: 'Rider', count: v.equipment.length },
            ]}
          >
            {tab === 'sobre' && (
              <div className="stack">
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
              </div>
            )}
            {tab === 'rider' && <VenueRiderTab v={v} />}
          </Tabs>
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
            <ContactList contacts={{ instagram: v.instagram, email: v.contactEmail, phone: v.contactPhone, website: v.website }} />
          </section>
        </aside>
      </div>
    </div>
  );
}
