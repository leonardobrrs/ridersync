import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { Avatar, Poster } from '../../components/Poster';
import { ErrorState, Loading } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { money, PORTFOLIO_KIND } from '../../lib/format';
import { useMe } from '../../lib/hooks';
import type { BookingDetail, PublicArtist } from '../../lib/types';
import { CompatibilityView } from '../artist/Compatibility';
import { OfferForm } from '../bookings/OfferForm';

export function ArtistPublicPage() {
  const { slug } = useParams();
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ['artist', slug], queryFn: () => api.get<PublicArtist>(`/public/artists/${slug}`) });
  const [proposal, setProposal] = useState(false);
  const [compareOrg, setCompareOrg] = useState<string | null>(null);
  const [orgId, setOrgId] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  if (q.isLoading) return <Loading />;
  if (q.error) return <div className="wrap page"><ErrorState error={q.error} retry={q.refetch} /></div>;
  const a = q.data!;
  const orgs = me?.organizations ?? [];
  const selectedOrg = orgId || orgs[0]?.id || '';
  const isMine = me?.musician?.id === a.id || me?.bands.some((b) => b.artist.id === a.id);
  const ridersByCat = a.rider.items.reduce<Record<string, typeof a.rider.items>>((acc, i) => {
    const k = i.category ?? 'Outros';
    (acc[k] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="wrap page">
      <ol className="bc" aria-label="Navegação estrutural">
        <li>
          <Link to="/">Artistas</Link>
        </li>
        <li aria-current="page">{a.name}</li>
      </ol>
      <div className="adp">
        <div className="stack">
          <div className="gal">
            <div className="gal-main">
              <Poster name={a.name} photoUrl={a.photoUrl} top={[a.city ?? '', a.state]} bottom={[a.genres.join(' · '), a.formats.join(' · ')]} ratio="16/10" />
            </div>
          </div>
          <section className="box">
            <div className="adh">
              <span className="tape" style={{ justifySelf: 'start' }}>
                {a.kind === 'BAND' ? 'Banda' : (a.mainInstrument ?? 'Músico')}
              </span>
              <h1>{a.name}</h1>
              {a.headline && <p className="muted">{a.headline}</p>}
              <div className="chips">
                {a.genres.map((g) => (
                  <span className="chip" key={g}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
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
              {a.kind === 'SOLO' && (
                <div>
                  <dt>Instrumentos</dt>
                  <dd>{[a.mainInstrument, ...a.instruments].filter(Boolean).join(', ') || '—'}</dd>
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

          <section className="box sec" aria-labelledby="pf-h">
            <h2 id="pf-h">Portfólio</h2>
            {a.portfolio.length === 0 ? (
              <p className="muted">Nenhum material publicado.</p>
            ) : (
              <div className="pf">
                {a.portfolio.map((p) => (
                  <a key={p.id} href={p.url ?? '#'} target="_blank" rel="noopener noreferrer">
                    <small>{PORTFOLIO_KIND[p.kind]}</small>
                    <strong>{p.title}</strong>
                    {p.description && <span className="hint">{p.description}</span>}
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="box sec" aria-labelledby="rd-h">
            <h2 id="rd-h">Rider técnico</h2>
            {a.rider.items.length === 0 ? (
              <p className="muted">Rider ainda não informado.</p>
            ) : (
              Object.entries(ridersByCat).map(([cat, items]) => (
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
              ))
            )}
            {a.rider.notes && <p className="note">{a.rider.notes}</p>}
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
                          <small>{m.instrument ?? ''}</small>
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
                    {b.name}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="side">
          <section className="box">
            <div className="price" style={{ fontSize: 28, margin: 0 }}>
              {a.baseFeeCents != null ? money(a.baseFeeCents) : 'A combinar'}
              <small>{a.baseFeeCents != null ? 'cachê a partir de (referência)' : 'cachê'}</small>
            </div>
            {!me && (
              <Link className="btn cue block" to={`/entrar?next=/artistas/${a.slug}`}>
                Entrar para enviar proposta
              </Link>
            )}
            {me && orgs.length > 0 && !isMine && (
              <>
                {orgs.length > 1 && (
                  <label className="field">
                    <span>Propor como</span>
                    <select className="input" value={selectedOrg} onChange={(e) => setOrgId(e.target.value)}>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button className="btn cue block" type="button" onClick={() => setProposal(true)}>
                  Enviar proposta
                </button>
                <button className="btn block" type="button" onClick={() => setCompareOrg(selectedOrg)}>
                  Comparar rider com minha casa
                </button>
              </>
            )}
            {me && orgs.length === 0 && !isMine && (
              <p className="hint">
                Para enviar propostas, <Link className="link" to="/painel/casas">cadastre sua casa de show</Link>.
              </p>
            )}
            {isMine && <p className="hint">Este é um perfil que você administra.</p>}
            <p className="tip">A RiderSync não intermedeia pagamentos: valores e condições são combinados entre as partes.</p>
          </section>
          <section className="box">
            <h2 className="lbl">Contatos públicos</h2>
            <dl className="contact">
              {a.contacts.instagram && (
                <div>
                  <dt>Instagram</dt>
                  <dd>@{a.contacts.instagram}</dd>
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
                  <dd>{a.contacts.phone}</dd>
                </div>
              )}
              {a.contacts.website && (
                <div>
                  <dt>Site</dt>
                  <dd>
                    <a className="link" href={a.contacts.website} target="_blank" rel="noopener noreferrer">
                      {a.contacts.website.replace(/^https:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
              {!Object.values(a.contacts).some(Boolean) && <p className="hint">Nenhum contato público informado.</p>}
            </dl>
          </section>
        </aside>
      </div>

      <Dialog open={proposal} onClose={() => setProposal(false)} title={`Proposta para ${a.name}`}>
        {proposal && (
          <OfferForm
            submitLabel="Enviar proposta"
            onCancel={() => setProposal(false)}
            initial={{ feeCents: a.baseFeeCents }}
            onSubmit={async (p) => {
              const b = await api.post<BookingDetail>('/bookings', { organizationId: selectedOrg, artistId: a.id, ...p });
              await qc.invalidateQueries({ queryKey: ['bookings'] });
              toast('Proposta enviada.');
              navigate(`/painel/negociacoes/${b.id}`);
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!compareOrg} onClose={() => setCompareOrg(null)} title="Compatibilidade técnica" wide>
        {compareOrg && <CompatibilityView artistId={a.id} organizationId={compareOrg} />}
      </Dialog>
    </div>
  );
}
