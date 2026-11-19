import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmButton, Dialog, TextPromptDialog } from '../../components/Dialog';
import { PageHead } from '../../components/Layout';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { BOOKING_STATUS, dateTime, duration, money, OFFER_STATUS, SIDE_LABEL } from '../../lib/format';
import { BookingChat } from './BookingChat';
import type { BookingDetail, BookingRow } from '../../lib/types';
import { CompatibilityView } from '../artist/Compatibility';
import { OfferForm } from './OfferForm';

export function BookingsPage() {
  const q = useQuery({ queryKey: ['bookings'], queryFn: () => api.get<BookingRow[]>('/bookings') });
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const rows = (q.data ?? []).filter((b) => filter === 'all' || ['NEGOTIATING', 'AGREED', 'CONFIRMED'].includes(b.status));
  return (
    <>
      <PageHead title="Negociações" subtitle="Propostas diretas e negociações iniciadas a partir de candidaturas — o mesmo fluxo." />
      <div className="seg" role="tablist" aria-label="Filtro">
        <button type="button" role="tab" aria-selected={filter === 'open'} onClick={() => setFilter('open')}>
          Ativas
        </button>
        <button type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>
          Todas
        </button>
      </div>
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data && rows.length === 0 && (
        <Empty title="Nenhuma negociação">
          Casas enviam propostas pelo marketplace; artistas recebem propostas e respondem aqui.
        </Empty>
      )}
      <div className="stack-sm">
        {rows.map((b) => (
          <Link key={b.id} to={`/painel/negociacoes/${b.id}`} className="card">
            <div className="row between">
              <h3>{b.title}</h3>
              <span className="row" style={{ gap: 6 }}>
                {b.awaitingMe && <span className="st falta">Aguardando você</span>}
                <Status value={b.status} map={BOOKING_STATUS} />
              </span>
            </div>
            <div className="meta">
              <span>Casa: {b.organization.name}</span>
              <span>
                {b.artist.kind === 'BAND' ? 'Banda' : 'Artista'}: {b.artist.name}
              </span>
              <span>Origem: {b.origin === 'DIRECT' ? 'proposta direta' : `candidatura${b.event ? ` · ${b.event.title}` : ''}`}</span>
              {b.latestOffer && (
                <span>
                  Última oferta ({SIDE_LABEL[b.latestOffer.authorSide]}): {money(b.latestOffer.feeCents)} · {dateTime(b.latestOffer.performanceAt)}
                </span>
              )}
              <span>Você atua como: {b.mySides.map((s) => SIDE_LABEL[s]).join(' e ')}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function BookingPage() {
  const { bookingId } = useParams();
  const key = ['booking', bookingId];
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: key, queryFn: () => api.get<BookingDetail>(`/bookings/${bookingId}`), refetchInterval: 20_000 });
  const [counter, setCounter] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [perfNotes, setPerfNotes] = useState('');

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const b = q.data!;

  const apply = async (fn: () => Promise<BookingDetail>, ok: string) => {
    try {
      qc.setQueryData(key, await fn());
      await qc.invalidateQueries({ queryKey: ['bookings'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      await qc.invalidateQueries({ queryKey: ['schedule'] });
      toast(ok);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  /** Conversa visível: zera o contador de não lidas e os avisos de "nova mensagem" desta negociação. */
  const markRead = async () => {
    try {
      await api.post(`/bookings/${b.id}/messages/read`);
      qc.setQueryData<BookingDetail>(key, (old) => (old ? { ...old, unreadMessages: 0 } : old));
      await qc.invalidateQueries({ queryKey: ['notifications'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
    } catch {
      // Sem impacto para quem está lendo: o contador volta a ser calculado na próxima atualização.
    }
  };
  /** A conversa já mostra a mensagem enviada: sem aviso de sucesso; em erro avisa e mantém o texto no campo. */
  const sendMessage = async (text: string) => {
    try {
      qc.setQueryData(key, await api.post<BookingDetail>(`/bookings/${b.id}/messages`, { body: text }));
      await qc.invalidateQueries({ queryKey: ['bookings'] });
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    }
  };
  const p = b.pendingOffer;

  return (
    <>
      <PageHead
        title={b.title}
        back="/painel/negociacoes"
        subtitle={
          <>
            <Status value={b.status} map={BOOKING_STATUS} /> · {b.origin === 'DIRECT' ? 'Proposta direta pelo marketplace' : 'Iniciada a partir de candidatura'}
            {b.mySide && <> · você atua como {SIDE_LABEL[b.mySide].toLowerCase()}</>}
          </>
        }
      />
      {b.bothSides && <div className="inline-msg info">Você administra os dois lados desta negociação; ações devem ser feitas por outra pessoa.</div>}

      <div className="adp">
        <div className="stack">
          <section className="box" aria-label="Partes">
            <dl className="attrs">
              <div>
                <dt>{b.organization.type === 'VENUE' ? 'Casa de show' : 'Contratante'}</dt>
                <dd>
                  {b.organization.slug ? (
                    <Link className="link" to={`/casas/${b.organization.slug}`}>
                      {b.organization.name}
                    </Link>
                  ) : (
                    b.organization.name
                  )}
                </dd>
              </div>
              {b.event && (
                <div>
                  <dt>Evento</dt>
                  <dd>
                    {b.event.title} {b.event.visibility === 'PRIVATE' && <span className="st draft">Privado</span>}
                  </dd>
                </div>
              )}
              <div>
                <dt>{b.artist.kind === 'BAND' ? 'Banda' : 'Artista'}</dt>
                <dd>
                  <Link className="link" to={`/artistas/${b.artist.slug}`}>
                    {b.artist.name}
                  </Link>
                </dd>
              </div>
              {b.event && (
                <div>
                  <dt>Oportunidade</dt>
                  <dd>{b.event.title}</dd>
                </div>
              )}
              {b.confirmedAt && (
                <div>
                  <dt>Confirmada em</dt>
                  <dd>
                    {dateTime(b.confirmedAt)} {b.confirmedBy && `por ${b.confirmedBy.name}`}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="box" aria-label="Propostas e contrapropostas">
            <h2 className="lbl">Histórico de propostas ({b.offers.length})</h2>
            <ol className="offers">
              {b.offers.map((o, idx) => (
                <li key={o.id} className={`offer ${o.status.toLowerCase()}`}>
                  <div className="row between">
                    <strong>
                      #{idx + 1} · {idx === 0 ? 'Proposta' : 'Contraproposta'} — {SIDE_LABEL[o.authorSide]}
                      {o.author && ` (${o.author.name})`}
                    </strong>
                    <Status value={o.status} map={OFFER_STATUS} />
                  </div>
                  <div className="terms">
                    <span>
                      Data: <b>{dateTime(o.performanceAt)}</b>
                    </span>
                    <span>
                      Duração: <b>{duration(o.durationMinutes)}</b>
                    </span>
                    <span>
                      Cachê: <b>{money(o.feeCents)}</b>
                    </span>
                  </div>
                  {o.terms && <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{o.terms}</p>}
                  <small className="hint">
                    Enviada {dateTime(o.createdAt)}
                    {o.respondedAt && ` · respondida ${dateTime(o.respondedAt)}${o.respondedBy ? ` por ${o.respondedBy.name}` : ''}`}
                  </small>
                </li>
              ))}
            </ol>
            {b.allowed.respond && p && (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <ConfirmButton
                  className="btn danger"
                  title="Recusar proposta"
                  confirm="Recusar esta proposta? A negociação será encerrada."
                  confirmLabel="Recusar proposta"
                  danger
                  onConfirm={() => apply(() => api.post(`/bookings/${b.id}/offers/${p.id}/decline`), 'Proposta recusada.')}
                >
                  Recusar
                </ConfirmButton>
                <button className="btn" type="button" onClick={() => setCounter(true)}>
                  Contraproposta
                </button>
                <ConfirmButton
                  className="btn cue"
                  title="Aceitar proposta"
                  confirmLabel="Aceitar proposta"
                  confirm={
                    <>
                      <p>Você está aceitando os termos abaixo:</p>
                      <dl className="dl">
                        <dt>Data e horário</dt>
                        <dd>{dateTime(p.performanceAt)}</dd>
                        <dt>Duração</dt>
                        <dd>{duration(p.durationMinutes)}</dd>
                        <dt>Cachê</dt>
                        <dd>{money(p.feeCents)}</dd>
                      </dl>
                      {p.terms && <p className="note">{p.terms}</p>}
                      <p className="hint">Depois do aceite, a contratação ainda precisa ser confirmada pelo contratante. O pagamento é combinado fora da plataforma.</p>
                    </>
                  }
                  onConfirm={() => apply(() => api.post(`/bookings/${b.id}/offers/${p.id}/accept`), 'Proposta aceita. Aguardando confirmação do contratante.')}
                >
                  Aceitar proposta
                </ConfirmButton>
              </div>
            )}
            {b.status === 'NEGOTIATING' && p && !b.allowed.respond && b.mySide && (
              <p className="hint">Aguardando resposta da outra parte.</p>
            )}
            {b.allowed.confirm && (
              <div className="notice" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>Os termos foram aceitos. Confirme a contratação para registrá-la formalmente. Isso não registra pagamento.</span>
                <ConfirmButton
                  className="btn cue"
                  title="Confirmar contratação"
                  confirm="Confirmar a contratação com os termos aceitos? O show passa a aparecer na agenda."
                  confirmLabel="Confirmar contratação"
                  onConfirm={() => apply(() => api.post(`/bookings/${b.id}/confirm`), 'Contratação confirmada.')}
                >
                  Confirmar contratação
                </ConfirmButton>
              </div>
            )}
            {b.status === 'AGREED' && b.mySide === 'ARTIST' && <p className="hint">Termos aceitos. Aguardando a confirmação do contratante.</p>}
          </section>

          {b.status === 'CONFIRMED' && (
            <section className="box" aria-label="Apresentação">
              <h2 className="lbl">Apresentação</h2>
              {b.performance ? (
                <div className="inline-msg ok">
                  Apresentação registrada como realizada em {dateTime(b.performance.performedAt)}
                  {b.performance.registeredBy && ` por ${b.performance.registeredBy.name}`}. {b.performance.notes}
                </div>
              ) : b.allowed.registerPerformance ? (
                <div className="form">
                  <p>A data acordada já passou. Registre a apresentação como realizada para compor o histórico.</p>
                  <label className="field">
                    <span>Observações (opcional)</span>
                    <input className="input" value={perfNotes} maxLength={1000} onChange={(e) => setPerfNotes(e.target.value)} />
                  </label>
                  <div className="actions">
                    <button className="btn dark" type="button" onClick={() => apply(() => api.post(`/bookings/${b.id}/performance`, { notes: perfNotes }), 'Apresentação registrada.')}>
                      Registrar como realizada
                    </button>
                  </div>
                </div>
              ) : (
                <p className="hint">
                  Contratação confirmada para {dateTime(b.agreedOffer?.performanceAt)}. Após a data, qualquer uma das partes pode registrar a apresentação como realizada.
                </p>
              )}
            </section>
          )}

          <section className="box" aria-label="Auditoria">
            <h2 className="lbl">Registro de estados</h2>
            <ul className="timeline">
              {b.statusChanges.map((s) => (
                <li key={s.id}>
                  <span>{dateTime(s.createdAt)}</span>
                  <b>{BOOKING_STATUS[s.toStatus][0]}</b>
                  <span>
                    {s.actor ? `por ${s.actor.name}` : ''}
                    {s.actorSide ? ` (${SIDE_LABEL[s.actorSide]})` : ''}
                    {s.note ? ` — ${s.note}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            {b.allowed.cancel && (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn sm danger" onClick={() => setCancelOpen(true)}>
                  {b.status === 'CONFIRMED' ? 'Cancelar contratação' : 'Encerrar negociação'}
                </button>
              </div>
            )}
            <TextPromptDialog
              open={cancelOpen}
              title={b.status === 'CONFIRMED' ? 'Cancelar contratação' : 'Encerrar negociação'}
              message={
                b.event
                  ? 'Propostas pendentes serão retiradas e a vaga no evento será liberada. A outra parte será avisada.'
                  : 'Propostas pendentes serão retiradas. A outra parte será avisada.'
              }
              label="Motivo (opcional)"
              confirmLabel={b.status === 'CONFIRMED' ? 'Cancelar contratação' : 'Encerrar negociação'}
              danger
              onClose={() => setCancelOpen(false)}
              onConfirm={async (reason) => {
                await apply(() => api.post(`/bookings/${b.id}/cancel`, { reason: reason || undefined }), 'Negociação encerrada.');
                setCancelOpen(false);
              }}
            />
            {b.canCompareRider && b.mySide && (
              <div className="row" style={{ justifyContent: 'flex-start' }}>
                <button type="button" className="btn sm ghost" onClick={() => setCompareOpen(true)}>
                  Comparar rider com o inventário da casa
                </button>
              </div>
            )}
            <Dialog open={compareOpen} onClose={() => setCompareOpen(false)} title="Compatibilidade técnica" wide>
              {compareOpen && <CompatibilityView artistId={b.artistId} organizationId={b.organizationId} />}
            </Dialog>
          </section>
        </div>

        <aside className="side">
          <BookingChat b={b} onSend={sendMessage} onRead={markRead} />
        </aside>
      </div>

      <Dialog open={counter} onClose={() => setCounter(false)} title="Contraproposta">
        {counter && p && (
          <OfferForm
            initial={p}
            withMessage={false}
            submitLabel="Enviar contraproposta"
            onCancel={() => setCounter(false)}
            onSubmit={async ({ offer }) => {
              qc.setQueryData(key, await api.post<BookingDetail>(`/bookings/${b.id}/offers/${p.id}/counter`, offer));
              await qc.invalidateQueries({ queryKey: ['bookings'] });
              setCounter(false);
              toast('Contraproposta enviada. A proposta anterior foi mantida no histórico.');
            }}
          />
        )}
      </Dialog>
    </>
  );
}
