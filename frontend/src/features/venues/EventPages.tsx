import { zodResolver } from '@hookform/resolvers/zod';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
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
import { InviteArtists, sendInvites, type InvitedArtist } from './InviteArtists';

const EventFormSchema = (independent: boolean) =>
  z
    .object({
      title: z.string().trim().min(3, 'Título com ao menos 3 caracteres.').max(120),
      description: z.string().trim().max(4000),
      visibility: z.enum(['PUBLIC', 'PRIVATE', 'HIDDEN']),
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
      notes: z.string().trim().max(2000),
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
  notes: e?.notes ?? '',
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
  notes: v.notes,
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
  HIDDEN: 'Só você e os artistas que você convidar veem o evento. Não aparece em nenhuma listagem e não recebe candidaturas: os convidados respondem pela negociação.',
};
const VISIBILITY_LABEL: Record<EventVisibility, string> = { PUBLIC: 'Público', PRIVATE: 'Privado', HIDDEN: 'Oculto' };

function EventForm({
  initial,
  independent,
  submitLabel,
  withInvites = false,
  onSubmit,
}: {
  initial?: Partial<EventManage>;
  independent: boolean;
  submitLabel: string;
  /** Criação: permite escolher artistas e enviar os convites junto. */
  withInvites?: boolean;
  onSubmit: (p: ReturnType<typeof toPayload>, image: ImageChange, invites: InvitedArtist[]) => Promise<unknown>;
}) {
  const { data: meta } = useMeta();
  const [formError, setFormError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [invites, setInvites] = useState<InvitedArtist[]>([]);
  const form = useForm<EventValues>({ resolver: zodResolver(EventFormSchema(independent)), defaultValues: toValues(initial) });
  const e = form.formState.errors;
  const visibility = useWatch({ control: form.control, name: 'visibility' });
  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    if (invites.length && !v.fee) {
      form.setError('fee', { message: 'Informe o cachê: ele vai na proposta enviada aos convidados.' });
      return;
    }
    try {
      await onSubmit(toPayload(v, independent), image ? { file: image } : removeImage ? 'remove' : null, invites);
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
          {(['PUBLIC', 'PRIVATE', 'HIDDEN'] as const).map((v) => (
            <label key={v} className={visibility === v ? 'on' : ''}>
              <input type="radio" value={v} {...form.register('visibility')} />
              {VISIBILITY_LABEL[v]}
            </label>
          ))}
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
          <small className="hint">Em eventos privados ou ocultos, o endereço só é exibido para quem pode ver o evento.</small>
        </fieldset>
      )}
      <div className="row3">
        <TextField label="Data e horário da apresentação" type="datetime-local" {...form.register('startsAt')} error={e.startsAt} />
        <TextField label="Duração (min)" type="number" {...form.register('durationMinutes')} error={e.durationMinutes} />
        <TextField label="Prazo de candidatura" type="datetime-local" {...form.register('applicationDeadline')} error={e.applicationDeadline} />
      </div>
      <div className="row3">
        <TextField
          label="Vagas"
          type="number"
          min={1}
          max={50}
          {...form.register('slots')}
          error={e.slots}
          hint="Uma vaga é ocupada quando a contratação é confirmada. Com todas confirmadas, o evento muda sozinho para “Vagas preenchidas”."
        />
        <SelectField label="Forma de pagamento" {...form.register('paymentType')}>
          <option value="">—</option>
          {meta?.paymentTypes.map((p) => <option key={p}>{p}</option>)}
        </SelectField>
        <TextField label="Cachê oferecido (R$)" inputMode="decimal" {...form.register('fee')} error={e.fee} hint="Com cachê definido, você pode contratar direto nas condições do evento." />
      </div>
      <Controller control={form.control} name="genres" render={({ field }) => <ChipPicker legend="Estilos procurados" options={meta?.genres ?? []} value={field.value} onChange={field.onChange} max={6} />} />
      <div className="row2">
        <TextArea label="Condições da apresentação" {...form.register('conditions')} error={e.conditions} style={{ minHeight: 90 }} />
        <TextArea label="Observações" placeholder="Informações extras para os artistas (ex.: chegar 1h antes, estacionamento…)" {...form.register('notes')} error={e.notes} style={{ minHeight: 90 }} />
      </div>
      {withInvites && (
        <fieldset className="stack-sm">
          <legend>Convites (opcional{visibility === 'HIDDEN' ? ' — recomendados em evento oculto' : ''})</legend>
          <InviteArtists value={invites} onChange={setInvites} />
          {invites.length > 0 && <small className="hint">Ao salvar, o evento é publicado e cada artista recebe uma proposta com a data, a duração e o cachê do evento.</small>}
        </fieldset>
      )}
      <div className="actions">
        <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Salvando…' : invites.length ? 'Publicar e enviar convites' : submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * Criação de evento única (reunião 19/11): pela casa de show ou pelos "Meus eventos", a mesma tela. O contratante
 * escolhe onde será (uma de suas casas ou outro local) e a visibilidade (público, privado ou oculto).
 */
export function NewEventPage() {
  const { orgId } = useParams();
  const [sp] = useSearchParams();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const venues = me?.organizations.filter((o) => o.type === 'VENUE') ?? [];
  const [choice, setChoice] = useState<string | null>(orgId ?? sp.get('casa'));
  const target = choice ?? venues[0]?.id ?? 'INDIVIDUAL';
  const independent = target === 'INDIVIDUAL';
  const back = orgId ? `/painel/casas/${orgId}` : '/painel/eventos';
  return (
    <>
      <PageHead title="Novo evento" back={back} subtitle="Criado como rascunho. Publique para receber candidaturas ou envie convites a artistas." />
      <section className="box form" aria-label="Onde será o evento">
        <SelectField label="Onde será o evento?" value={target} onChange={(e) => setChoice(e.target.value)}>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} (minha casa de show)
            </option>
          ))}
          <option value="INDIVIDUAL">Outro local (sem casa de show)</option>
        </SelectField>
        <small className="hint">
          {independent ? 'Você informa o local (ex.: aniversário, casamento, festa de condomínio).' : 'O evento usa o endereço e o inventário técnico da casa.'}
        </small>
      </section>
      <EventForm
        key={target}
        independent={independent}
        withInvites
        submitLabel="Salvar rascunho"
        onSubmit={async (p, image, invites) => {
          const ev = independent ? await api.post<EventManage>('/me/independent-events', p) : await api.post<EventManage>(`/organizations/${target}/events`, p);
          await applyImageChange(ev.id, image, toast);
          if (invites.length) {
            const published = await api.post<EventManage>(`/events/${ev.id}/transition`, { action: 'publish' });
            const { failed } = await sendInvites(published, invites);
            toast(
              failed.length ? `Evento publicado. ${invites.length - failed.length} convite(s) enviado(s); falharam: ${failed.map((f) => f.name).join(', ')}.` : `Evento publicado e ${invites.length} convite(s) enviado(s).`,
              failed.length ? 'error' : undefined,
            );
          } else {
            toast('Rascunho criado.');
          }
          await qc.invalidateQueries({ queryKey: ['me'] });
          await qc.invalidateQueries({ queryKey: ['org-events'] });
          navigate(`/painel/eventos/${ev.id}`);
        }}
      />
    </>
  );
}

/** Mesmo formulário: a rota de "evento particular" usa a tela única de criação. */
export const NewIndependentEventPage = NewEventPage;

/** Meus eventos: todos os eventos das casas e dos eventos particulares do contratante, em uma lista. */
export function IndependentEventsPage() {
  const { data: me } = useMe();
  const orgs = me?.organizations ?? [];
  const results = useQueries({
    queries: orgs.map((o) => ({ queryKey: ['org-events', o.id], queryFn: () => api.get<OrgEventRow[]>(`/organizations/${o.id}/events`) })),
  });
  const loading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error;
  const rows = results
    .flatMap((r, i) => (r.data ?? []).map((e) => ({ ...e, orgName: orgs[i].type === 'VENUE' ? orgs[i].name : 'Outro local' })))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return (
    <>
      <PageHead
        title="Meus eventos"
        subtitle="Eventos das suas casas de show e em outros locais. Abertos, fechados e realizados ficam todos aqui."
        actions={
          <Link className="btn cue" to="/painel/eventos/novo">
            Novo evento
          </Link>
        }
      />
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {!loading && rows.length === 0 && <Empty title="Nenhum evento ainda">Crie seu primeiro evento para receber candidaturas ou convidar artistas.</Empty>}
      <div className="stack-sm">
        {rows.map((e) => (
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
                {e.visibility !== 'PUBLIC' && <span className="st draft">{VISIBILITY_LABEL[e.visibility]}</span>}
                <span>{e.orgName}</span>
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState<InvitedArtist[]>([]);
  const [inviting, setInviting] = useState(false);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const ev = q.data!;
  const independent = ev.organizer.type === 'INDIVIDUAL';
  const back = independent ? '/painel/eventos' : `/painel/casas/${ev.organizerId}`;
  const canInvite = ['DRAFT', 'OPEN', 'CLOSED', 'POSTPONED'].includes(ev.status);
  const invite = async () => {
    if (!invites.length) return;
    setInviting(true);
    try {
      const current = ev.status === 'DRAFT' ? await api.post<EventManage>(`/events/${ev.id}/transition`, { action: 'publish' }) : ev;
      const { failed } = await sendInvites(current, invites);
      qc.setQueryData(key, await api.get<EventManage>(`/events/${ev.id}/manage`));
      setInvites([]);
      setInviteOpen(false);
      toast(failed.length ? `Falharam: ${failed.map((x) => `${x.name} (${x.reason})`).join('; ')}` : 'Convite(s) enviado(s).', failed.length ? 'error' : undefined);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setInviting(false);
    }
  };

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

  /**
   * Selecionar candidatura: a negociação começa com o cachê publicado do evento (sem redigitar) ou, se o artista
   * enviou contraproposta, com ela pendente para o contratante responder. Só quando o evento é "a combinar" e não há
   * contraproposta abre o formulário de proposta.
   */
  const startNegotiation = (a: (typeof ev.applications)[number], opts: { label: string; className?: string; disabled?: boolean }) => {
    const className = opts.className ?? 'btn sm';
    if (ev.feeCents == null && a.proposedFeeCents == null) {
      return (
        <button className={className} type="button" disabled={opts.disabled} onClick={() => setNegotiate(a.id)}>
          {opts.label}
        </button>
      );
    }
    const confirm =
      a.proposedFeeCents != null
        ? `Selecionar ${a.artist.name} e abrir a negociação com a contraproposta dele: cachê de ${money(a.proposedFeeCents)} em ${dateTime(ev.startsAt)}. Você poderá aceitar, recusar ou responder com outro valor.`
        : `Selecionar ${a.artist.name} e abrir a negociação com as condições publicadas: ${dateTime(ev.startsAt)}, ${duration(ev.durationMinutes ?? 60)}, cachê de ${money(ev.feeCents)}. O artista poderá aceitar ou enviar uma contraproposta. Nenhuma vaga é ocupada até a confirmação.`;
    return (
      <ConfirmButton
        className={className}
        disabled={opts.disabled}
        confirm={confirm}
        confirmLabel="Abrir negociação"
        onConfirm={async () => {
          try {
            const b = await api.post<BookingDetail>(`/applications/${a.id}/booking`, {});
            await qc.invalidateQueries({ queryKey: ['bookings'] });
            toast(a.proposedFeeCents != null ? 'Negociação aberta com a contraproposta do artista.' : 'Negociação aberta com o cachê do evento.');
            navigate(`/painel/negociacoes/${b.id}`);
          } catch (e) {
            toast(errorMessage(e), 'error');
          }
        }}
      >
        {opts.label}
      </ConfirmButton>
    );
  };

  return (
    <>
      <PageHead
        title={ev.title}
        back={back}
        subtitle={
          <>
            <Status value={ev.status} map={EVENT_STATUS} /> {ev.visibility !== 'PUBLIC' && <span className="st draft">{VISIBILITY_LABEL[ev.visibility]}</span>} · {dateTime(ev.startsAt)} · prazo{' '}
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
            {canInvite && (
              <button type="button" className="btn" onClick={() => setInviteOpen(true)}>
                Convidar artistas
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
      {ev.status === 'FILLED' && (
        <div className="inline-msg ok">Todas as vagas têm contratação confirmada: as inscrições foram fechadas automaticamente. Se uma contratação for cancelada, o evento reabre sozinho.</div>
      )}
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
              <dt>Vagas confirmadas</dt>
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
          {ev.notes && (
            <p className="prose">
              <strong>Observações:</strong> {ev.notes}
            </p>
          )}
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
          <p className="hint">Convites são propostas enviadas pelo perfil do artista com este evento vinculado. Convites não ocupam vaga; a vaga só é preenchida quando a contratação é confirmada.</p>
        </section>
      )}

      <section className="box" aria-label="Candidaturas recebidas">
        <h2 className="lbl">Candidaturas recebidas ({ev.applications.length})</h2>
        {ev.applications.length === 0 ? (
          <Empty title="Nenhuma candidatura ainda">{ev.status === 'DRAFT' ? 'Publique para receber candidaturas.' : 'As candidaturas aparecem aqui.'}</Empty>
        ) : (
          <div className="stack-sm">
            {ev.applications.map((a) => (
              <article className="prow app-card" key={a.id}>
                <Poster name={a.artist.name} photoUrl={a.artist.photoUrl} top={[a.artist.city ?? '', '']} bottom={[a.artist.genres[0] ?? '', '']} />
                <div>
                  <h3>
                    <Link className="link" to={`/artistas/${a.artist.slug}`}>
                      {a.artist.name}
                    </Link>
                  </h3>
                  <div className="meta">
                    {/* Com negociação aberta, o estado dela é o que importa; sem ela, o da candidatura. */}
                    {a.booking ? <Status value={a.booking.status} map={BOOKING_STATUS} /> : <Status value={a.status} map={APPLICATION_STATUS} />}
                    <span>
                      {a.artist.kind === 'BAND' ? 'Banda' : 'Músico'} · enviada {dateTime(a.createdAt)}
                    </span>
                  </div>
                  {a.proposedFeeCents != null && (
                    <p className="counter-note" role="note">
                      <strong>Contraproposta de cachê: {money(a.proposedFeeCents)}</strong>
                      {ev.feeCents != null && <> (cachê publicado: {money(ev.feeCents)})</>}
                    </p>
                  )}
                  {a.message && (
                    <p className="app-msg" title={a.message}>
                      “{a.message}”
                    </p>
                  )}
                </div>
                <div className="acts">
                  {!independent && (
                    <button className="btn sm ghost" type="button" onClick={() => setCompare(a.id)}>
                      Comparar rider
                    </button>
                  )}
                  {a.status === 'PENDING' && (
                    <>
                      <ConfirmButton
                        className="btn sm cue"
                        disabled={ev.filledSlots >= ev.slots || ev.feeCents == null || a.proposedFeeCents != null}
                        title={
                          a.proposedFeeCents != null
                            ? 'O artista enviou contraproposta: use "Selecionar e negociar" para responder.'
                            : ev.feeCents == null
                              ? 'Defina o cachê do evento para contratar direto.'
                              : undefined
                        }
                        confirm={`Contratar ${a.artist.name} nas condições do evento: ${dateTime(ev.startsAt)}, ${duration(ev.durationMinutes ?? 60)}, cachê ${money(ev.feeCents)}. A contratação é confirmada na hora e ocupa uma vaga.`}
                        confirmLabel="Contratar agora"
                        onConfirm={async () => {
                          try {
                            const b = await api.post<BookingDetail>(`/applications/${a.id}/hire`);
                            await qc.invalidateQueries({ queryKey: ['bookings'] });
                            toast('Contratação confirmada nas condições do evento.');
                            navigate(`/painel/negociacoes/${b.id}`);
                          } catch (e) {
                            toast(errorMessage(e), 'error');
                          }
                        }}
                      >
                        Contratar nas condições
                      </ConfirmButton>
                      {/* Selecionar abre a negociação já com o cachê publicado (ou a contraproposta do artista); não ocupa vaga. */}
                      {startNegotiation(a, { label: 'Selecionar e negociar', disabled: ev.filledSlots >= ev.slots })}
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
                  {a.status === 'ACCEPTED' && !a.booking && startNegotiation(a, { label: 'Iniciar negociação', className: 'btn sm dark' })}
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
        <p className="note">
          {!independent && 'Use “Comparar rider” para ver o rider do artista diante do inventário da casa. '}
          Selecionar uma candidatura abre a negociação com o artista e não ocupa vaga — você pode negociar com mais de um. A vaga só é ocupada quando uma
          contratação é confirmada.
        </p>
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
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Convidar artistas">
        <div className="stack">
          <InviteArtists value={invites} onChange={setInvites} />
          <p className="hint">
            Cada artista recebe uma proposta com a data ({dateTime(ev.startsAt)}), a duração ({duration(ev.durationMinutes ?? 60)}) e o cachê ({money(ev.feeCents ?? 0)}) do
            evento.{ev.status === 'DRAFT' ? ' O evento será publicado ao enviar.' : ''}
            {ev.feeCents == null ? ' Defina o cachê do evento antes de convidar.' : ''}
          </p>
          <div className="actions">
            <button className="btn cue" type="button" onClick={invite} disabled={inviting || !invites.length || ev.feeCents == null}>
              {inviting ? 'Enviando…' : `Enviar ${invites.length || ''} convite(s)`}
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog open={!!compare} onClose={() => setCompare(null)} title="Compatibilidade técnica" wide>
        {compare && <CompatibilityView applicationId={compare} perspective="VENUE" />}
      </Dialog>
      <TextPromptDialog
        open={prompt === 'cancel'}
        title="Cancelar evento"
        message="Candidaturas pendentes serão recusadas, contratações e negociações vinculadas serão encerradas. Os artistas serão avisados."
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
