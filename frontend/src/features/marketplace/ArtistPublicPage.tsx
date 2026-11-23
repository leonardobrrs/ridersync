import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { ProfilePhoto, Thumb } from '../../components/Media';
import { Avatar, Poster } from '../../components/Poster';
import { ErrorState, Loading } from '../../components/States';
import { Tabs } from '../../components/Tabs';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { dateTime, dayMonth, money, PORTFOLIO_KIND } from '../../lib/format';
import { formatPhone, phoneDigits } from '../../lib/phone';
import { ReviewsSummary } from '../../components/Stars';
import { useMe } from '../../lib/hooks';
import type { BookingDetail, OrgEventRow, PastShow, PortfolioItem, PublicArtist, Rider, UpcomingEvent } from '../../lib/types';
import { OfferForm, type OfferPayload } from '../bookings/OfferForm';
import { InstrumentLabel } from '../../components/InstrumentLabel';

export function PortfolioGrid({ items }: { items: PortfolioItem[] }) {
  if (items.length === 0) return <p className="muted">Nenhum material publicado.</p>;
  return (
    <div className="pf-grid">
      {items.map((p) => (
        <a key={p.id} className="pf-card" href={p.url ?? '#'} target="_blank" rel="noopener noreferrer">
          <span className="pf-thumb">
            <Thumb src={p.thumbnailUrl} alt="" fallback={<Icon name={p.kind === 'VIDEO' ? 'play' : p.kind === 'AUDIO' ? 'music' : 'external'} size={28} />} />
            {p.kind === 'VIDEO' && p.thumbnailUrl && (
              <span className="pf-play" aria-hidden="true">
                <Icon name="play" size={20} />
              </span>
            )}
          </span>
          <span className="pf-b">
            <small>{PORTFOLIO_KIND[p.kind]}</small>
            <strong>{p.title}</strong>
            {p.description && <span className="hint">{p.description}</span>}
          </span>
        </a>
      ))}
    </div>
  );
}

export function RiderList({ rider, empty = 'Rider ainda não informado.' }: { rider: Rider; empty?: string }) {
  if (rider.items.length === 0) return <p className="muted">{empty}</p>;
  const byCat = rider.items.reduce<Record<string, Rider['items']>>((acc, i) => {
    (acc[i.category ?? 'Outros'] ??= []).push(i);
    return acc;
  }, {});
  return (
    <>
      {Object.entries(byCat).map(([cat, items]) => (
        <div key={cat} className="icat">
          <h3 className="lbl">{cat}</h3>
          <ul className="ilist">
            {items.map((i) => (
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
        </div>
      ))}
      {rider.notes && <p className="note">{rider.notes}</p>}
    </>
  );
}

export function UpcomingEvents({ items }: { items: UpcomingEvent[] }) {
  if (items.length === 0) return <p className="muted">Nenhum show confirmado no momento.</p>;
  return (
    <ul className="dates">
      {items.map((e, i) => {
        const d = dayMonth(e.startsAt);
        const time = new Date(e.startsAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
        return (
          <li key={`${e.startsAt}-${i}`}>
            <span className="dt">
              <b>{d.day}</b>
              <small>{d.month}</small>
            </span>
            {e.private ? (
              <span>
                <strong>Evento privado</strong>
                <small>{time}</small>
              </span>
            ) : (
              <span>
                <strong>{e.eventId ? <Link to={`/oportunidades/${e.eventId}`}>{e.title ?? e.place.name ?? 'Show confirmado'}</Link> : (e.title ?? e.place.name ?? 'Show confirmado')}</strong>
                <small>
                  {e.place.venueSlug ? <Link to={`/casas/${e.place.venueSlug}`}>{e.place.name}</Link> : e.place.name}
                  {e.place.city ? ` · ${e.place.city}` : ''} · {time}
                </small>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Histórico de shows realizados (privados aparecem só como "Evento privado"). */
export function ShowHistory({ total, items }: { total: number; items: PastShow[] }) {
  if (total === 0) return <p className="muted">Nenhum show realizado pela plataforma ainda.</p>;
  return (
    <>
      <p className="show-total">
        <b>{total}</b> {total === 1 ? 'show realizado' : 'shows realizados'} pelo RiderSync
      </p>
      <ul className="dates past">
        {items.map((e, i) => {
          const d = new Date(e.performedAt);
          const label = d.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: 'short', year: 'numeric' });
          return (
            <li key={`${e.performedAt}-${i}`}>
              <span className="dt">
                <b>{d.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit' })}</b>
                <small>{d.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', month: 'short', year: '2-digit' }).replace('.', '')}</small>
              </span>
              {e.private ? (
                <span>
                  <strong>Evento privado</strong>
                  <small>{label}</small>
                </span>
              ) : (
                <span>
                  <strong>{e.eventId ? <Link to={`/oportunidades/${e.eventId}`}>{e.title ?? e.place.name ?? 'Show'}</Link> : (e.title ?? e.place.name ?? 'Show')}</strong>
                  <small>
                    {e.place.venueSlug ? <Link to={`/casas/${e.place.venueSlug}`}>{e.place.name}</Link> : e.place.name}
                    {e.place.city ? ` · ${e.place.city}` : ''} · {label}
                  </small>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {total > items.length && <p className="hint">Mostrando os {items.length} mais recentes.</p>}
    </>
  );
}

function ProposalBox({ a }: { a: PublicArtist }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  /** Proposta preenchida aguardando confirmação. */
  const [pending, setPending] = useState<OfferPayload | null>(null);
  const [sending, setSending] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [eventId, setEventId] = useState('');
  const orgs = me?.organizations ?? [];
  const selectedOrg = orgId || orgs[0]?.id || '';
  const events = useQuery({
    queryKey: ['org-events', selectedOrg],
    queryFn: () => api.get<OrgEventRow[]>(`/organizations/${selectedOrg}/events`),
    enabled: open && !!selectedOrg,
  });
  const invitable = (events.data ?? []).filter((e) => ['DRAFT', 'OPEN', 'CLOSED', 'POSTPONED'].includes(e.status) && e.filledSlots < e.slots);

  if (!me) {
    return (
      <Link className="btn cue block" to={`/entrar?next=/artistas/${a.slug}`}>
        Entrar para enviar proposta
      </Link>
    );
  }
  if (me.user.accountType !== 'CONTRACTOR') return <p className="hint">Propostas são enviadas por contas de contratante (casas de show ou pessoas que contratam música).</p>;
  if (orgs.length === 0) {
    return (
      <p className="hint">
        Para enviar propostas, <Link className="link" to="/painel/casas">cadastre sua casa de show</Link> ou{' '}
        <Link className="link" to="/painel/eventos">crie um evento particular</Link>.
      </p>
    );
  }
  return (
    <>
      {orgs.length > 1 && (
        <label className="field">
          <span>Propor como</span>
          <select className="input" value={selectedOrg} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.type === 'INDIVIDUAL' ? ' (contratante individual)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="btn cue block" type="button" onClick={() => setOpen(true)}>
        Enviar proposta
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Proposta para ${a.name}`}>
        {open && (
          <div className="stack">
            {invitable.length > 0 && (
              <label className="field">
                <span>Vincular a um evento (opcional)</span>
                <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  <option value="">Sem evento — proposta avulsa</option>
                  {invitable.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.slots - e.filledSlots} vaga(s) livre(s))
                    </option>
                  ))}
                </select>
                <small>O convite não ocupa vaga: a vaga só é preenchida quando a contratação é confirmada.</small>
              </label>
            )}
            <OfferForm
              submitLabel="Enviar proposta"
              onCancel={() => setOpen(false)}
              initial={{ feeCents: a.baseFeeCents }}
              onSubmit={async (p) => setPending(p)}
            />
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        title="Enviar proposta?"
        message={
          pending && (
            <>
              Você está enviando a {a.name} uma proposta de <strong>{money(pending.offer.feeCents)}</strong> para {dateTime(pending.offer.performanceAt)}. O artista
              poderá aceitar, recusar ou enviar uma contraproposta.
            </>
          )
        }
        confirmLabel="Enviar proposta"
        busy={sending}
        onClose={() => !sending && setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          setSending(true);
          try {
            const b = await api.post<BookingDetail>('/bookings', { organizationId: selectedOrg, artistId: a.id, eventId: eventId || undefined, ...pending });
            await qc.invalidateQueries({ queryKey: ['bookings'] });
            toast('Proposta enviada.');
            navigate(`/painel/negociacoes/${b.id}`);
          } catch (e) {
            toast(errorMessage(e), 'error');
          } finally {
            setSending(false);
            setPending(null);
          }
        }}
      />
    </>
  );
}

const TABS = ['sobre', 'portfolio', 'rider'] as const;
type Tab = (typeof TABS)[number];

export function ArtistPublicPage() {
  const { slug } = useParams();
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const q = useQuery({ queryKey: ['artist', slug], queryFn: () => api.get<PublicArtist>(`/public/artists/${slug}`) });
  const tab: Tab = TABS.includes(params.get('aba') as Tab) ? (params.get('aba') as Tab) : 'sobre';
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
  const a = q.data!;
  const isMine = me?.musician?.id === a.id || me?.bands.some((b) => b.artist.id === a.id);

  return (
    <div className="wrap page">
      <ol className="bc" aria-label="Navegação estrutural">
        <li>
          <Link to="/">Início</Link>
        </li>
        <li>
          <Link to={`/?kind=${a.kind}`}>{a.kind === 'BAND' ? 'Bandas' : 'Músicos'}</Link>
        </li>
        <li aria-current="page">{a.name}</li>
      </ol>
      <div className="adp">
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="gal">
            <div className="gal-main">
              {a.photoUrl ? (
                <ProfilePhoto thumbUrl={a.photoUrl} largeUrl={a.photoLargeUrl} name={a.name} />
              ) : (
                <Poster name={a.name} top={[a.city ?? '', a.state]} bottom={[a.genres.join(' · '), a.formats.join(' · ')]} ratio="16/10" />
              )}
            </div>
          </div>
          <section className="box">
            <div className="adh">
              {a.kind === 'BAND' ? (
                <span className="tape" style={{ justifySelf: 'start' }}>
                  <Icon name="users" size={12} />
                  Banda
                </span>
              ) : (
                <InstrumentLabel className="tape tape-start" size={12} value={a.mainInstrument ?? 'Músico'} />
              )}
              <h1 tabIndex={-1}>{a.name}</h1>
              <Link className="handle" to={`/artistas/${a.slug}`}>
                @{a.slug}
              </Link>
              {a.headline && <p className="muted">{a.headline}</p>}
              <div className="chips">
                {a.genres.map((g) => (
                  <Link className="chip" key={g} to={`/?genre=${encodeURIComponent(g)}`}>
                    {g}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <Tabs
            label="Seções do perfil"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'sobre', label: 'Sobre' },
              { id: 'portfolio', label: 'Portfólio', count: a.portfolio.length },
              { id: 'rider', label: 'Rider técnico', count: a.rider.items.length },
            ]}
          >
            {tab === 'sobre' && (
              <div className="stack">
                <section className="box">
                  <dl className="attrs">
                    <div>
                      <dt>Cidade</dt>
                      <dd>
                        {a.city ?? '—'}/{a.state}
                      </dd>
                    </div>
                    <div>
                      <dt>Formações</dt>
                      <dd>{a.formats.join(', ') || '—'}</dd>
                    </div>
                    <div>
                      <dt>Em atividade desde</dt>
                      <dd>{a.careerStartYear ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Shows realizados</dt>
                      <dd>{a.showHistory.total}</dd>
                    </div>
                    {a.kind === 'SOLO' && (
                      <div>
                        <dt>Instrumentos</dt>
                        <dd>
                          {[a.mainInstrument, ...a.instruments].filter(Boolean).length ? (
                            <span className="insts">
                              {[...new Set([a.mainInstrument, ...a.instruments].filter((x): x is string => !!x))].map((i) => (
                                <InstrumentLabel key={i} value={i} />
                              ))}
                            </span>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {a.bio && (
                    <div className="sec">
                      <h2>Sobre</h2>
                      <p className="prose">{a.bio}</p>
                    </div>
                  )}
                </section>
                <section className="box sec" aria-labelledby="ev-h">
                  <h2 id="ev-h">Próximos eventos</h2>
                  <UpcomingEvents items={a.upcomingEvents} />
                </section>
                <section className="box sec" aria-labelledby="hist-h">
                  <h2 id="hist-h">Histórico de shows ({a.showHistory.total})</h2>
                  <ShowHistory total={a.showHistory.total} items={a.showHistory.items} />
                </section>
                <section className="box sec" aria-labelledby="rv-h">
                  <h2 id="rv-h">Avaliações de contratantes</h2>
                  <ReviewsSummary r={a.reviews} empty="Ainda sem avaliações." />
                </section>
                {a.members && (
                  <section className="box sec" aria-labelledby="mb-h">
                    <h2 id="mb-h">Integrantes</h2>
                    <p className="muted">{a.members.total} integrante(s) ativo(s).</p>
                    {a.members.public.length > 0 && (
                      <ul className="members">
                        {a.members.public.map((m) => (
                          <li key={m.slug}>
                            <Link to={`/artistas/${m.slug}`}>
                              <Avatar name={m.name} photoUrl={m.photoUrl} />
                              <span>
                                {m.name}
                                <small>@{m.slug}</small>
                                {m.instrument && <InstrumentLabel value={m.instrument} size={13} />}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
                {a.bands.length > 0 && (
                  <section className="box sec">
                    <h2>Bandas</h2>
                    <div className="chips">
                      {a.bands.map((b) => (
                        <Link className="chip" key={b.slug} to={`/artistas/${b.slug}`}>
                          {b.name} <span className="handle">@{b.slug}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
            {tab === 'portfolio' && (
              <section className="box sec">
                <h2>Portfólio</h2>
                <PortfolioGrid items={a.portfolio} />
              </section>
            )}
            {tab === 'rider' && (
              <section className="box sec">
                <h2>Rider técnico</h2>
                <p className="hint">Equipamentos que o artista já possui e leva para os shows. O que a casa precisa fornecer é combinado em cada candidatura ou negociação.</p>
                <RiderList rider={a.rider} />
              </section>
            )}
          </Tabs>
        </div>

        <aside className="side">
          <section className="box stack">
            <div className="price" style={{ fontSize: 28, margin: 0 }}>
              {a.baseFeeCents != null ? money(a.baseFeeCents) : 'A combinar'}
              <small>{a.baseFeeCents != null ? 'cachê a partir de (referência)' : 'cachê'}</small>
            </div>
            {isMine ? <p className="hint">Este é um perfil que você administra.</p> : <ProposalBox a={a} />}
            <p className="tip">A RiderSync não intermedeia pagamentos: valores e condições são combinados entre as partes.</p>
          </section>
          <section className="box">
            <h2 className="lbl">Contatos públicos</h2>
            <dl className="contact">
              {a.contacts.instagram && (
                <div>
                  <dt>Instagram</dt>
                  <dd>
                    <a className="link" href={`https://instagram.com/${a.contacts.instagram}`} target="_blank" rel="noopener noreferrer">
                      @{a.contacts.instagram}
                    </a>
                  </dd>
                </div>
              )}
              {a.contacts.email && (
                <div>
                  <dt>E-mail</dt>
                  <dd>{a.contacts.email}</dd>
                </div>
              )}
              {a.contacts.phone && (
                <div>
                  <dt>Telefone</dt>
                  <dd>
                    <a className="link" href={`tel:+55${phoneDigits(a.contacts.phone)}`}>{formatPhone(a.contacts.phone)}</a>
                  </dd>
                </div>
              )}
              {a.contacts.website && (
                <div>
                  <dt>Site</dt>
                  <dd>
                    <a className="link" href={a.contacts.website} target="_blank" rel="noopener noreferrer">
                      Abrir site
                    </a>
                  </dd>
                </div>
              )}
              {!Object.values(a.contacts).some(Boolean) && <p className="hint">Nenhum contato público informado.</p>}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
