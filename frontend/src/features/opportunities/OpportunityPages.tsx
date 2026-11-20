import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { NeedsPicker } from './NeedsPicker';
import { FormError } from '../../components/Fields';
import { Poster } from '../../components/Poster';
import { OpportunityCard } from '../marketplace/MarketplacePage';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage, qs } from '../../lib/api';
import { APPLICATION_STATUS, dateTime, duration, EVENT_STATUS, money } from '../../lib/format';
import { useMe, useMeta } from '../../lib/hooks';
import type { ApplicationStatus, EventPublic, Need } from '../../lib/types';

/** Área do artista: "Oportunidades de apresentação" (o mesmo Event que a casa chama de publicação). */
export function OpportunitiesPage() {
  const [params, setParams] = useSearchParams();
  const { data: meta } = useMeta();
  const { data: me } = useMe();
  const closed = params.get('status') === 'encerrados';
  const f = { q: params.get('q') ?? '', genre: params.get('genre') ?? '', city: params.get('city') ?? '' };
  const query = closed ? { ...f, state: 'closed' } : f;
  const q = useQuery({ queryKey: ['events', query], queryFn: () => api.get<EventPublic[]>(`/public/events${qs(query)}`) });
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
          <h1 tabIndex={-1}>{closed ? 'Eventos encerrados' : 'Oportunidades de apresentação'}</h1>
          <p>
            {closed
              ? 'Eventos com vagas preenchidas, inscrições encerradas ou já realizados — com as atrações confirmadas.'
              : 'Vagas abertas por casas de show e contratantes. Candidate-se com seu perfil individual ou com sua banda.'}
          </p>
        </div>
      </div>
      <div className="seg ev-tabs" role="tablist" aria-label="Situação dos eventos">
        <button type="button" role="tab" aria-selected={!closed} className={closed ? '' : 'on'} onClick={() => set('status', '')}>
          Inscrições abertas
        </button>
        <button type="button" role="tab" aria-selected={closed} className={closed ? 'on' : ''} onClick={() => set('status', 'encerrados')}>
          Encerrados
        </button>
      </div>
      <div className="box cmp-f" style={{ marginBottom: 16 }}>
        <label className="field">
          <span>Buscar</span>
          <input className="input" type="search" defaultValue={f.q} placeholder="Título, casa…" onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} />
        </label>
        <label className="field">
          <span>Estilo</span>
          <select className="input" value={f.genre} onChange={(e) => set('genre', e.target.value)}>
            <option value="">Todos</option>
            {meta?.genres.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Cidade</span>
          <select className="input" value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">Todas</option>
            {meta?.allCities.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {me?.user.accountType === 'ARTIST' && (
        <p className="hint" style={{ marginBottom: 12 }}>
          Eventos marcados como <span className="st draft">Privado</span> aparecem só para contas de artista e não são divulgados na página inicial.
        </p>
      )}
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data?.length === 0 && <Empty title={closed ? 'Nenhum evento encerrado' : 'Nenhuma oportunidade aberta'}>Volte em breve ou ajuste os filtros.</Empty>}
      {!!q.data?.length && (
        <div className="ads">
          {q.data.map((e) => (
            <OpportunityCard key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}

interface MyApp {
  id: string;
  artistId: string;
  status: ApplicationStatus;
  booking: { id: string; status: string } | null;
}

export function OpportunityPage() {
  const { eventId } = useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['event', eventId], queryFn: () => api.get<EventPublic>(`/public/events/${eventId}`) });
  const mine = useQuery({
    queryKey: ['event-my-apps', eventId],
    queryFn: () => api.get<MyApp[]>(`/events/${eventId}/my-applications`),
    enabled: !!me,
  });
  const identities = [
    ...(me?.musician ? [{ id: me.musician.id, name: me.musician.name, kind: 'Perfil individual', visibility: me.musician.visibility }] : []),
    ...(me?.bands.filter((b) => b.role !== 'MEMBER').map((b) => ({ id: b.artist.id, name: b.artist.name, kind: 'Banda', visibility: b.artist.visibility })) ?? []),
  ];
  const [artistId, setArtistId] = useState('');
  const [message, setMessage] = useState('');
  const [needs, setNeeds] = useState<Need[]>([]);
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <Loading />;
  if (q.error) return <div className="wrap page"><ErrorState error={q.error} retry={q.refetch} /></div>;
  const e = q.data!;
  const appsByArtist = new Map((mine.data ?? []).map((a) => [a.artistId, a]));
  const selected = artistId || identities.find((i) => !appsByArtist.has(i.id) || appsByArtist.get(i.id)!.status === 'WITHDRAWN')?.id || '';

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['event-my-apps', eventId] });
    await qc.invalidateQueries({ queryKey: ['my-applications'] });
  };
  const apply = async () => {
    setErr(null);
    if (!selected) return setErr('Escolha com qual identidade artística deseja se candidatar.');
    setBusy(true);
    try {
      await api.post(`/events/${e.id}/applications`, { artistId: selected, message, needs });
      setMessage('');
      setNeeds([]);
      await refresh();
      toast('Candidatura enviada! Acompanhe o andamento aqui.');
      navigate('/painel/candidaturas');
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async (id: string) => {
    try {
      await api.post(`/applications/${id}/withdraw`);
      await refresh();
      toast('Candidatura retirada.');
    } catch (x) {
      toast(errorMessage(x), 'error');
    }
  };
  const place = e.location;

  return (
    <div className="wrap page">
      <ol className="bc">
        <li>
          <Link to="/oportunidades">Oportunidades</Link>
        </li>
        <li aria-current="page">{e.title}</li>
      </ol>
      <div className="adp">
        <div className="stack">
          <section className="box">
            <div className="adh">
              <div className="row">
                <Status value={e.status} map={EVENT_STATUS} />
                {e.visibility === 'PRIVATE' && <span className="st draft">Evento privado</span>}
                {e.visibility === 'HIDDEN' && <span className="st draft">Evento oculto (só convidados)</span>}
              </div>
              <h1 tabIndex={-1}>{e.title}</h1>
              <p className="muted">
                por{' '}
                {e.organizer.slug ? (
                  <Link className="link" to={`/casas/${e.organizer.slug}`}>
                    {e.organizer.name}
                  </Link>
                ) : (
                  <>{e.organizer.name} (contratante individual)</>
                )}
                {e.venue && e.venue.id !== e.organizer.id && <> · local: {e.venue.name}</>}
              </p>
              {e.status === 'POSTPONED' && <div className="inline-msg warn">Evento adiado: o organizador vai informar a nova data.</div>}
              {['FILLED', 'CLOSED', 'COMPLETED', 'CANCELLED'].includes(e.status) && (
                <div className={`inline-msg ${e.status === 'CANCELLED' ? 'warn' : 'info'}`} role="status">
                  {e.status === 'COMPLETED'
                    ? 'Evento realizado.'
                    : e.status === 'CANCELLED'
                      ? 'Evento cancelado pelo organizador.'
                      : e.status === 'FILLED'
                        ? 'Evento fechado: todas as vagas têm contratação confirmada.'
                        : 'Evento fechado: as inscrições foram encerradas.'}{' '}
                  As informações continuam disponíveis abaixo.
                </div>
              )}
            </div>
            <dl className="attrs">
              <div>
                <dt>Apresentação</dt>
                <dd>{dateTime(e.startsAt)}</dd>
              </div>
              <div>
                <dt>Duração</dt>
                <dd>{duration(e.durationMinutes)}</dd>
              </div>
              <div>
                <dt>Inscrições até</dt>
                <dd>{dateTime(e.applicationDeadline)}</dd>
              </div>
              <div>
                <dt>Vagas</dt>
                <dd>
                  {e.filledSlots !== undefined ? `${e.filledSlots} de ${e.slots} confirmada(s)` : e.slots}
                </dd>
              </div>
              <div>
                <dt>Local</dt>
                <dd>
                  {place.venueSlug ? <Link to={`/casas/${place.venueSlug}`}>{place.name}</Link> : place.name}
                  {place.name ? ' — ' : ''}
                  {place.address ? `${place.address}, ` : ''}
                  {place.city}/{place.state}
                </dd>
              </div>
              <div>
                <dt>Pagamento</dt>
                <dd>
                  {e.paymentType ?? '—'} {e.feeCents != null && `· ${money(e.feeCents)}`}
                </dd>
              </div>
            </dl>
            {e.genres.length > 0 && (
              <div className="chips">
                {e.genres.map((g) => (
                  <span className="chip" key={g}>
                    {g}
                  </span>
                ))}
              </div>
            )}
            {e.description && <p className="prose">{e.description}</p>}
            {e.conditions && (
              <div className="sec">
                <h2>Condições</h2>
                <p className="prose">{e.conditions}</p>
              </div>
            )}
            {e.notes && (
              <div className="sec">
                <h2>Observações</h2>
                <p className="prose">{e.notes}</p>
              </div>
            )}
            {!!e.lineup?.length && (
              <div className="sec">
                <h2>Atrações confirmadas</h2>
                <ul className="lineup">
                  {e.lineup.map((a) => (
                    <li key={a.id}>
                      <Link className="link" to={`/artistas/${a.slug}`}>
                        {a.name}
                      </Link>
                      <small className="muted">{a.kind === 'BAND' ? 'Banda' : (a.mainInstrument ?? 'Artista')}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
        <aside className="side">
          <section className="box" aria-label="Candidatura">
            {e.imageUrl ? (
              <img className="ev-cover" src={e.imageUrl} alt={`Imagem do evento ${e.title}`} />
            ) : (
              <Poster name={e.organizer.name} photoUrl={e.organizer.photoUrl} top={[place.city ?? '', place.state ?? '']} bottom={[e.organizer.venueKind ?? '', '']} />
            )}
            {!e.acceptingApplications && (
              <div className="inline-msg info">{e.status === 'FILLED' ? 'Todas as vagas foram preenchidas.' : 'Inscrições encerradas para esta oportunidade.'}</div>
            )}
            {!me && e.acceptingApplications && (
              <Link className="btn cue block" to={`/entrar?next=/oportunidades/${e.id}`}>
                Entrar para se candidatar
              </Link>
            )}
            {me && mine.data && mine.data.length > 0 && (
              <ul className="list-plain">
                {mine.data.map((a) => {
                  const ident = identities.find((i) => i.id === a.artistId);
                  return (
                    <li key={a.id} className="row between">
                      <span>
                        <strong>{ident?.name ?? 'Identidade'}</strong> <Status value={a.status} map={APPLICATION_STATUS} />
                      </span>
                      {(a.status === 'PENDING' || a.status === 'ACCEPTED') && !a.booking && (
                        <button className="btn sm ghost danger" type="button" onClick={() => withdraw(a.id)}>
                          Retirar
                        </button>
                      )}
                      {a.booking && (
                        <Link className="btn sm" to={`/painel/negociacoes/${a.booking.id}`}>
                          Negociação
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {me && e.acceptingApplications && identities.length === 0 && (
              <p className="hint">
                Para se candidatar, <Link className="link" to="/painel/perfil">crie seu perfil</Link> ou administre uma banda.
              </p>
            )}
            {me && e.acceptingApplications && identities.length > 0 && (
              <div className="form">
                <FormError message={err} />
                <label className="field">
                  <span>Candidatar-se como</span>
                  <select className="input" value={selected} onChange={(x) => setArtistId(x.target.value)}>
                    <option value="">Selecione…</option>
                    {identities.map((i) => {
                      const existing = appsByArtist.get(i.id);
                      const blocked = existing && existing.status !== 'WITHDRAWN';
                      return (
                        <option key={i.id} value={i.id} disabled={!!blocked}>
                          {i.name} ({i.kind}){i.visibility !== 'PUBLIC' ? ' — perfil privado' : ''}
                          {blocked ? ' — já candidatado' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {selected && <NeedsPicker artistId={selected} value={needs} onChange={setNeeds} />}
                <label className="field">
                  <span>Mensagem para a casa</span>
                  <textarea className="input" maxLength={1500} value={message} onChange={(x) => setMessage(x.target.value)} style={{ minHeight: 90 }} />
                </label>
                <button className="btn cue block" type="button" onClick={apply} disabled={busy}>
                  {busy ? 'Enviando…' : 'Enviar candidatura'}
                </button>
                <p className="hint">Somente perfis públicos podem se candidatar. A seleção não confirma a contratação.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
