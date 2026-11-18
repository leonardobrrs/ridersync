import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { CityField } from '../../components/CityField';
import { ConfirmButton, Dialog, TextPromptDialog } from '../../components/Dialog';
import { applyServerErrors, ChipPicker, FormError, SelectField, TextArea, TextField } from '../../components/Fields';
import { PageHead } from '../../components/Layout';
import { ImagePicker, uploadForm } from '../../components/Media';
import { Poster } from '../../components/Poster';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { APPLICATION_STATUS, BOOKING_STATUS, centsFromReais, date, dateTime, duration, EVENT_STATUS, fromLocalInput, money, reaisFromCents, toLocalInput } from '../../lib/format';
import { useMe, useMeta } from '../../lib/hooks';
import type { BookingDetail, EventManage, EventVisibility, OrgEventRow } from '../../lib/types';
import { CompatibilityView } from '../artist/Compatibility';
import { OfferForm, type OfferPayload } from '../bookings/OfferForm';

const EventFormSchema = (independent: boolean) =>
  z
    .object({
      title: z.string().trim().min(3, 'Título com ao menos 3 caracteres.').max(120),
      description: z.string().trim().max(4000),
      visibility: z.enum(['PUBLIC', 'PRIVATE']),
      locationName: z.string().trim().max(120),
      locationAddress: z.string().trim().max(160),
      locationCity: independent ? z.string().trim().min(2, 'Informe a cidade do evento.') : z.string().trim(),
      startsAt: z.string().min(1, 'Informe data e horário.'),
      durationMinutes: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 15 && Number(v) <= 1440), 'Entre 15 e 1440 minutos.'),
      applicationDeadline: z.string().min(1, 'Informe o prazo de candidatura.'),
      slots: z.string().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 50, 'Entre 1 e 50 vagas.'),
      genres: z.array(z.string()).max(6),
      paymentType: z.string(),
      fee: z.string().trim().refine((v) => v === '' || /^\d+([.,]\d{1,2})?$/.test(v), 'Valor inválido.'),
      conditions: z.string().trim().max(2000),
      requirements: z.string().trim().max(2000),
    })
    .refine((v) => !v.startsAt || !v.applicationDeadline || v.applicationDeadline <= v.startsAt, {
      path: ['applicationDeadline'],
      message: 'O prazo deve ser anterior ou igual à data da apresentação.',
    });
type EventValues = z.infer<ReturnType<typeof EventFormSchema>>;

const toValues = (e?: Partial<EventManage>): EventValues => ({
  title: e?.title ?? '',
  description: e?.description ?? '',
  visibility: e?.visibility ?? 'PUBLIC',
  locationName: e?.locationFields?.locationName ?? '',
  locationAddress: e?.locationFields?.locationAddress ?? '',
  locationCity: e?.locationFields?.locationCity ?? '',
  startsAt: toLocalInput(e?.startsAt),
  durationMinutes: e?.durationMinutes ? String(e.durationMinutes) : '',
  applicationDeadline: toLocalInput(e?.applicationDeadline),
  slots: String(e?.slots ?? 1),
  genres: e?.genres ?? [],
  paymentType: e?.paymentType ?? '',
  fee: reaisFromCents(e?.feeCents),
  conditions: e?.conditions ?? '',
  requirements: e?.requirements ?? '',
});
const toPayload = (v: EventValues, independent: boolean) => ({
  title: v.title,
  description: v.description,
  visibility: v.visibility,
  ...(independent ? { locationName: v.locationName || null, locationAddress: v.locationAddress || null, locationCity: v.locationCity } : {}),
  startsAt: fromLocalInput(v.startsAt),
  durationMinutes: v.durationMinutes ? Number(v.durationMinutes) : null,
  applicationDeadline: fromLocalInput(v.applicationDeadline),
  slots: Number(v.slots),
  genres: v.genres,
  paymentType: v.paymentType || null,
  feeCents: centsFromReais(v.fee),
  conditions: v.conditions,
  requirements: v.requirements,
});

/** Alteração da imagem pedida no formulário: novo arquivo, remoção da atual ou nada. */
type ImageChange = { file: File } | 'remove' | null;

/** Aplica a alteração de imagem depois de salvar o evento. Falha no envio não desfaz o evento salvo. */
async function applyImageChange(eventId: string, change: ImageChange, toast: (m: string, t?: 'error') => void): Promise<EventManage | null> {
  if (!change) return null;
  try {
    if (change === 'remove') return await api.delete<EventManage>(`/events/${eventId}/image`);
    return await api.upload<EventManage>('PUT', `/events/${eventId}/image`, uploadForm(change.file));
  } catch (err) {
    toast(`O evento foi salvo, mas a imagem não pôde ser atualizada: ${errorMessage(err)}`, 'error');
    return null;
  }
}

const VISIBILITY_HELP: Record<EventVisibility, string> = {
  PUBLIC: 'Aparece para todos: página inicial, oportunidades e agenda pública dos artistas.',
  PRIVATE: 'Aparece só para contas de artista (para se candidatarem). Não vai para a página inicial e, na agenda do artista, aparece apenas como “Evento privado”.',
};

function EventForm({
  initial,
  independent,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<EventManage>;
  independent: boolean;
  submitLabel: string;
  onSubmit: (p: ReturnType<typeof toPayload>, image: ImageChange) => Promise<unknown>;
}) {
  const { data: meta } = useMeta();
  const [formError, setFormError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const form = useForm<EventValues>({ resolver: zodResolver(EventFormSchema(independent)), defaultValues: toValues(initial) });
  const e = form.formState.errors;
  const visibility = useWatch({ control: form.control, name: 'visibility' });
  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await onSubmit(toPayload(v, independent), image ? { file: image } : removeImage ? 'remove' : null);
    } catch (err) {
      setFormError(applyServerErrors(err, form.setError));
    }
  });
  return (
    <form className="box form" onSubmit={submit} noValidate aria-label="Dados do evento">
      <FormError message={formError} />
      <TextField label="Título" {...form.register('title')} error={e.title} />
      <ImagePicker
        label="Imagem do evento (opcional)"
        wide
        value={image}
        onChange={(f) => {
          setImage(f);
          setRemoveImage(false);
        }}
        currentUrl={removeImage ? null : initial?.imageUrl}
        onRemoveCurrent={() => setRemoveImage(true)}
        hint="Aparece no card do evento. Prefira uma imagem horizontal (cartaz, foto do palco ou do local)."
      />
      <TextArea label="Descrição" {...form.register('description')} error={e.description} />
      <fieldset className="stack-sm">
        <legend>Visibilidade do evento</legend>
        <div className="seg" role="radiogroup">
          <label className={visibility === 'PUBLIC' ? 'on' : ''}>
            <input type="radio" value="PUBLIC" {...form.register('visibility')} />
            Público
          </label>
          <label className={visibility === 'PRIVATE' ? 'on' : ''}>
            <input type="radio" value="PRIVATE" {...form.register('visibility')} />
            Privado
          </label>
        </div>
        <small className="hint">{VISIBILITY_HELP[visibility]}</small>
      </fieldset>
      {independent && (
        <fieldset className="stack-sm">
          <legend>Local do evento</legend>
          <div className="row2">
            <TextField label="Nome do local (opcional)" placeholder="Ex.: Salão de festas do condomínio" {...form.register('locationName')} error={e.locationName} />
            <TextField label="Endereço (opcional)" {...form.register('locationAddress')} error={e.locationAddress} />
          </div>
          <CityField {...form.register('locationCity')} error={e.locationCity} />
          <small className="hint">Em eventos privados, o endereço só é exibido para artistas autenticados e para quem negociar com você.</small>
        </fieldset>
      )}
      <div className="row3">
        <TextField label="Data e horário da apresentação" type="datetime-local" {...form.register('startsAt')} error={e.startsAt} />
        <TextField label="Duração (min)" type="number" {...form.register('durationMinutes')} error={e.durationMinutes} />
        <TextField label="Prazo de candidatura" type="datetime-local" {...form.register('applicationDeadline')} error={e.applicationDeadline} />
      </div>
      <div className="row3">
        <TextField label="Vagas" type="number" min={1} max={50} {...form.register('slots')} error={e.slots} hint="Ao ocupar todas, o evento muda sozinho para “Vagas preenchidas”." />
        <SelectField label="Forma de pagamento" {...form.register('paymentType')}>
          <option value="">—</option>
          {meta?.paymentTypes.map((p) => <option key={p}>{p}</option>)}
        </SelectField>
        <TextField label="Cachê oferecido (R$)" inputMode="decimal" {...form.register('fee')} error={e.fee} />
      </div>
      <Controller control={form.control} name="genres" render={({ field }) => <ChipPicker legend="Estilos procurados" options={meta?.genres ?? []} value={field.value} onChange={field.onChange} max={6} />} />
      <div className="row2">
        <TextArea label="Condições da apresentação" {...form.register('conditions')} error={e.conditions} style={{ minHeight: 90 }} />
        <TextArea label="Requisitos" {...form.register('requirements')} error={e.requirements} style={{ minHeight: 90 }} />
      </div>
      <div className="actions">
        <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function NewEventPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  return (
    <>
      <PageHead title="Novo evento" back={`/painel/casas/${orgId}`} subtitle="O evento é criado como rascunho (não visível). Publique quando estiver pronto." />
      <EventForm
        independent={false}
        submitLabel="Salvar rascunho"
        onSubmit={async (p, image) => {
          const ev = await api.post<EventManage>(`/organizations/${orgId}/events`, p);
          await applyImageChange(ev.id, image, toast);
          await qc.invalidateQueries({ queryKey: ['org-events', orgId] });
          toast('Rascunho criado.');
          navigate(`/painel/eventos/${ev.id}`);
        }}
      />
    </>
  );
}

/** Eventos de contratante independente (sem casa de show), ex.: aniversário, casamento, arraiá de condomínio. */
export function IndependentEventsPage() {
  const { data: me } = useMe();
  const org = me?.organizations.find((o) => o.type === 'INDIVIDUAL');
  const q = useQuery({
    queryKey: ['org-events', org?.id],
    queryFn: () => api.get<OrgEventRow[]>(`/organizations/${org!.id}/events`),
    enabled: !!org,
  });
  return (
    <>
      <PageHead
        title="Eventos particulares"
        subtitle="Contrate música para eventos sem casa de show (aniversários, casamentos, festas). Você define o local e se o evento é público ou privado."
        actions={
          <Link className="btn cue" to="/painel/eventos/novo">
            Novo evento
          </Link>
        }
      />
      {!org && <Empty title="Nenhum evento particular ainda">Crie seu primeiro evento para receber candidaturas ou convidar artistas.</Empty>}
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data?.length === 0 && <Empty title="Nenhum evento particular ainda" />}
      <div className="stack-sm">
        {q.data?.map((e) => (
          <article className="prow" key={e.id}>
            <Poster name={e.title} photoUrl={e.imageThumbUrl} top={[date(e.startsAt), '']} bottom={[e.statusLabel, '']} />
            <div>
              <h3>
                <Link className="link" to={`/painel/eventos/${e.id}`}>
                  {e.title}
                </Link>
              </h3>
              <div className="meta">
                <Status value={e.status} map={EVENT_STATUS} />
                {e.visibility === 'PRIVATE' && <span className="st draft">Privado</span>}
                <span>{dateTime(e.startsAt)}</span>
                <span>
                  {e.filledSlots}/{e.slots} vaga(s)
                </span>
              </div>
            </div>
            <div className="acts">
              <Link className="btn sm" to={`/painel/eventos/${e.id}`}>
                Gerenciar
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function NewIndependentEventPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  return (
    <>
      <PageHead title="Novo evento particular" back="/painel/eventos" subtitle="Criado como rascunho. Publique para receber candidaturas ou envie convites diretos a artistas." />
      <EventForm
        independent
        submitLabel="Salvar rascunho"
        onSubmit={async (p, image) => {
          const ev = await api.post<EventManage>('/me/independent-events', p);
          await applyImageChange(ev.id, image, toast);
          await qc.invalidateQueries({ queryKey: ['me'] });
          await qc.invalidateQueries({ queryKey: ['org-events'] });
          toast('Rascunho criado.');
          navigate(`/painel/eventos/${ev.id}`);
        }}
      />
    </>
  );
}

type Action = 'publish' | 'close' | 'reopen' | 'complete' | 'cancel' | 'postpone';
const ACTIONS: Record<string, { action: Action; label: string; cls: string; confirm?: string }[]> = {
  DRAFT: [
    { action: 'publish', label: 'Publicar e abrir inscrições', cls: 'btn cue' },
    { action: 'cancel', label: 'Cancelar', cls: 'btn danger' },
  ],
  OPEN: [
    { action: 'close', label: 'Encerrar inscrições', cls: 'btn', confirm: 'Encerrar inscrições? Novas candidaturas serão bloqueadas.' },
    { action: 'postpone', label: 'Adiar', cls: 'btn' },
    { action: 'cancel', label: 'Cancelar evento', cls: 'btn danger' },
  ],
  FILLED: [
    { action: 'postpone', label: 'Adiar', cls: 'btn' },
    { action: 'complete', label: 'Marcar como realizado', cls: 'btn', confirm: 'Marcar o evento como realizado?' },
    { action: 'cancel', label: 'Cancelar evento', cls: 'btn danger' },
  ],
  CLOSED: [
    { action: 'reopen', label: 'Reabrir inscrições', cls: 'btn' },
    { action: 'postpone', label: 'Adiar', cls: 'btn' },
    { action: 'complete', label: 'Marcar como realizado', cls: 'btn', confirm: 'Marcar o evento como realizado?' },
    { action: 'cancel', label: 'Cancelar evento', cls: 'btn danger' },
  ],
  POSTPONED: [{ action: 'cancel', label: 'Cancelar evento', cls: 'btn danger' }],
};

function RescheduleDialog({ ev, open, onClose, onDone }: { ev: EventManage; open: boolean; onClose: () => void; onDone: (e: EventManage) => void }) {
  const [startsAt, setStartsAt] = useState(toLocalInput(ev.startsAt));
  const [deadline, setDeadline] = useState(toLocalInput(ev.applicationDeadline));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title="Definir nova data">
      <div className="stack">
        <p className="hint">Artistas com candidatura ou negociação neste evento serão avisados da nova data.</p>
        <div className="row2">
          <TextField label="Nova data e horário" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <TextField label="Novo prazo de candidatura" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <TextArea label="Mensagem aos participantes (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        <FormError message={error} />
        <div className="row dlg-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Voltar
          </button>
          <button
            type="button"
            className="btn cue"
            disabled={busy || !startsAt || !deadline}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                onDone(await api.post<EventManage>(`/events/${ev.id}/reschedule`, { startsAt: fromLocalInput(startsAt), applicationDeadline: fromLocalInput(deadline), reason: reason || undefined }));
                onClose();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Salvar nova data
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function EventManagePage() {
  const { eventId } = useParams();
  const key = ['event-manage', eventId];
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: key, queryFn: () => api.get<EventManage>(`/events/${eventId}/manage`) });
  const [editing, setEditing] = useState(false);
  const [negotiate, setNegotiate] = useState<string | null>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<'cancel' | 'postpone' | null>(null);
  const [reschedule, setReschedule] = useState(false);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const ev = q.data!;
  const independent = ev.organizer.type === 'INDIVIDUAL';
  const back = independent ? '/painel/eventos' : `/painel/casas/${ev.organizerId}`;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      qc.setQueryData(key, (await fn()) as EventManage);
      await qc.invalidateQueries({ queryKey: ['org-events', ev.organizerId] });
      toast(ok);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const transition = (action: Action, reason?: string) => run(() => api.post(`/events/${ev.id}/transition`, { action, reason: reason || undefined }), 'Evento atualizado.');
  const app = ev.applications.find((a) => a.id === negotiate);

  return (
    <>
      <PageHead
        title={ev.title}
        back={back}
        subtitle={
          <>
            <Status value={ev.status} map={EVENT_STATUS} /> {ev.visibility === 'PRIVATE' && <span className="st draft">Privado</span>} · {dateTime(ev.startsAt)} · prazo{' '}
            {dateTime(ev.applicationDeadline)}
          </>
        }
        actions={
          <>
            {(ACTIONS[ev.status] ?? []).map((t) =>
              t.action === 'cancel' || t.action === 'postpone' ? (
                <button key={t.action} type="button" className={t.cls} onClick={() => setPrompt(t.action as 'cancel' | 'postpone')}>
                  {t.label}
                </button>
              ) : t.confirm ? (
                <ConfirmButton key={t.action} className={t.cls} confirm={t.confirm} confirmLabel={t.label} onConfirm={() => transition(t.action)}>
                  {t.label}
                </ConfirmButton>
              ) : (
                <button key={t.action} type="button" className={t.cls} onClick={() => transition(t.action)}>
                  {t.label}
                </button>
              ),
            )}
            {['OPEN', 'FILLED', 'CLOSED', 'POSTPONED'].includes(ev.status) && (
              <button type="button" className="btn" onClick={() => setReschedule(true)}>
                {ev.status === 'POSTPONED' ? 'Definir nova data' : 'Remarcar'}
              </button>
            )}
            {['DRAFT', 'OPEN', 'FILLED', 'CLOSED'].includes(ev.status) && (
              <button type="button" className="btn ghost" onClick={() => setEditing((x) => !x)}>
                {editing ? 'Fechar edição' : 'Editar'}
              </button>
            )}
          </>
        }
      />
      {ev.status !== 'DRAFT' && (
        <Link className="btn sm" to={`/oportunidades/${ev.id}`}>
          Ver como os artistas veem
        </Link>
      )}
      {ev.status === 'FILLED' && <div className="inline-msg ok">Todas as vagas estão ocupadas: as inscrições foram fechadas automaticamente. Se uma vaga for cancelada, o evento reabre sozinho.</div>}
      {ev.status === 'POSTPONED' && <div className="inline-msg warn">Evento adiado. Defina a nova data para retomar.</div>}
      {editing ? (
        <EventForm
          initial={ev}
          independent={independent}
          submitLabel="Salvar alterações"
          onSubmit={async (p, image) => {
            const saved = await api.patch<EventManage>(`/events/${ev.id}`, p);
            qc.setQueryData(key, (await applyImageChange(ev.id, image, toast)) ?? saved);
            await qc.invalidateQueries({ queryKey: ['org-events', ev.organizerId] });
            setEditing(false);
            toast('Evento atualizado.');
          }}
        />
      ) : (
        <section className="box">
          {ev.imageUrl ? (
            <img className="ev-cover" src={ev.imageUrl} alt={`Imagem do evento ${ev.title}`} />
          ) : (
            ['DRAFT', 'OPEN', 'FILLED', 'CLOSED'].includes(ev.status) && (
              <p className="hint">Sem imagem: o card usa um cartaz gerado. Para adicionar uma imagem, clique em “Editar”.</p>
            )
          )}
          <dl className="attrs">
            <div>
              <dt>Vagas ocupadas</dt>
              <dd>
                {ev.filledSlots}/{ev.slots}
              </dd>
            </div>
            <div>
              <dt>Local</dt>
              <dd>
                {[ev.location.name, ev.location.address].filter(Boolean).join(' — ') || '—'} {ev.location.city ? `· ${ev.location.city}` : ''}
              </dd>
            </div>
            <div>
              <dt>Duração</dt>
              <dd>{duration(ev.durationMinutes)}</dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>
                {ev.paymentType ?? '—'} · {money(ev.feeCents)}
              </dd>
            </div>
          </dl>
          {ev.description && <p className="prose">{ev.description}</p>}
        </section>
      )}

      {ev.invitations.length > 0 && (
        <section className="box" aria-label="Convites diretos">
          <h2 className="lbl">Convites diretos ({ev.invitations.length})</h2>
          <ul className="list-plain">
            {ev.invitations.map((b) => (
              <li key={b.id} className="row space">
                <Link className="link" to={`/artistas/${b.artist.slug}`}>
                  {b.artist.name}
                </Link>
                <span className="row">
                  <Status value={b.status} map={BOOKING_STATUS} />
                  <Link className="btn sm" to={`/painel/negociacoes/${b.id}`}>
                    Ver negociação
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">Convites são propostas enviadas pelo perfil do artista com este evento vinculado. Cada convite ativo ocupa uma vaga.</p>
        </section>
      )}

      <section className="box" aria-label="Candidaturas recebidas">
        <h2 className="lbl">Candidaturas recebidas ({ev.applications.length})</h2>
        {ev.applications.length === 0 ? (
          <Empty title="Nenhuma candidatura ainda">{ev.status === 'DRAFT' ? 'Publique para receber candidaturas.' : 'As candidaturas aparecem aqui.'}</Empty>
        ) : (
          <div className="stack-sm">
            {ev.applications.map((a) => (
              <article className="prow" key={a.id}>
                <Poster name={a.artist.name} photoUrl={a.artist.photoUrl} top={[a.artist.city ?? '', '']} bottom={[a.artist.genres[0] ?? '', '']} />
                <div>
                  <h3>
                    <Link className="link" to={`/artistas/${a.artist.slug}`}>
                      {a.artist.name}
                    </Link>
                  </h3>
                  <div className="meta">
                    <Status value={a.status} map={APPLICATION_STATUS} />
                    <span>{a.artist.kind === 'BAND' ? 'Banda' : 'Músico'}</span>
                    <span>enviada {dateTime(a.createdAt)}</span>
                    {a.booking && <Status value={a.booking.status} map={BOOKING_STATUS} />}
                  </div>
                  {a.message && <p style={{ marginTop: 6, fontSize: 14 }}>“{a.message}”</p>}
                </div>
                <div className="acts">
                  {!independent && (
                    <button className="btn sm ghost" type="button" onClick={() => setCompare(a.artist.id)}>
                      Comparar rider
                    </button>
                  )}
                  {a.status === 'PENDING' && (
                    <>
                      <button
                        className="btn sm cue"
                        type="button"
                        disabled={ev.filledSlots >= ev.slots}
                        onClick={() => run(() => api.post(`/applications/${a.id}/accept`, {}), 'Candidatura selecionada. Isso não confirma a contratação.')}
                      >
                        Selecionar
                      </button>
                      <ConfirmButton
                        className="btn sm danger"
                        confirm={`Recusar a candidatura de ${a.artist.name}?`}
                        confirmLabel="Recusar"
                        danger
                        onConfirm={() => run(() => api.post(`/applications/${a.id}/reject`, {}), 'Candidatura recusada.')}
                      >
                        Recusar
                      </ConfirmButton>
                    </>
                  )}
                  {a.status === 'ACCEPTED' && !a.booking && (
                    <button className="btn sm dark" type="button" onClick={() => setNegotiate(a.id)}>
                      Iniciar negociação
                    </button>
                  )}
                  {a.booking && (
                    <Link className="btn sm" to={`/painel/negociacoes/${a.booking.id}`}>
                      Ver negociação
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="note">Selecionar uma candidatura ocupa uma vaga, mas não confirma a contratação: a negociação e a confirmação são etapas próprias.</p>
      </section>

      <Dialog open={!!app} onClose={() => setNegotiate(null)} title={`Proposta para ${app?.artist.name ?? ''}`}>
        {app && (
          <OfferForm
            initial={{ performanceAt: ev.startsAt, durationMinutes: ev.durationMinutes, feeCents: ev.feeCents, terms: ev.conditions }}
            submitLabel="Enviar proposta"
            onCancel={() => setNegotiate(null)}
            onSubmit={async (p: OfferPayload) => {
              const b = await api.post<BookingDetail>(`/applications/${app.id}/booking`, p);
              await qc.invalidateQueries({ queryKey: ['bookings'] });
              toast('Negociação iniciada.');
              navigate(`/painel/negociacoes/${b.id}`);
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!compare} onClose={() => setCompare(null)} title="Compatibilidade técnica" wide>
        {compare && <CompatibilityView artistId={compare} organizationId={ev.organizerId} />}
      </Dialog>
      <TextPromptDialog
        open={prompt === 'cancel'}
        title="Cancelar evento"
        message="Candidaturas pendentes serão recusadas, vagas ocupadas serão canceladas e negociações vinculadas serão encerradas. Os artistas serão avisados."
        label="Motivo (opcional, enviado aos artistas)"
        confirmLabel="Cancelar evento"
        danger
        onClose={() => setPrompt(null)}
        onConfirm={async (reason) => {
          await transition('cancel', reason);
          setPrompt(null);
        }}
      />
      <TextPromptDialog
        open={prompt === 'postpone'}
        title="Adiar evento"
        message="O evento fica como “Adiado” e as inscrições são suspensas até você definir a nova data. Os artistas envolvidos serão avisados."
        label="Mensagem aos artistas (opcional)"
        confirmLabel="Adiar evento"
        onClose={() => setPrompt(null)}
        onConfirm={async (reason) => {
          await transition('postpone', reason);
          setPrompt(null);
        }}
      />
      {reschedule && <RescheduleDialog ev={ev} open={reschedule} onClose={() => setReschedule(false)} onDone={(e) => qc.setQueryData(key, e)} />}
    </>
  );
}
