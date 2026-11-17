import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { ConfirmButton, Dialog } from '../../components/Dialog';
import { applyServerErrors, ChipPicker, FormError, SelectField, TextArea, TextField } from '../../components/Fields';
import { PageHead } from '../../components/Layout';
import { Poster } from '../../components/Poster';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { APPLICATION_STATUS, BOOKING_STATUS, centsFromReais, dateTime, duration, EVENT_STATUS, fromLocalInput, money, reaisFromCents, toLocalInput } from '../../lib/format';
import { useMeta } from '../../lib/hooks';
import type { BookingDetail, EventManage } from '../../lib/types';
import { CompatibilityView } from '../artist/Compatibility';
import { OfferForm, type OfferPayload } from '../bookings/OfferForm';

const EventFormSchema = z
  .object({
    title: z.string().trim().min(3, 'Título com ao menos 3 caracteres.').max(120),
    description: z.string().trim().max(4000),
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
type EventValues = z.infer<typeof EventFormSchema>;

const toValues = (e?: Partial<EventManage>): EventValues => ({
  title: e?.title ?? '',
  description: e?.description ?? '',
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
const toPayload = (v: EventValues) => ({
  title: v.title,
  description: v.description,
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

function EventForm({ initial, submitLabel, onSubmit }: { initial?: Partial<EventManage>; submitLabel: string; onSubmit: (p: ReturnType<typeof toPayload>) => Promise<unknown> }) {
  const { data: meta } = useMeta();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<EventValues>({ resolver: zodResolver(EventFormSchema), defaultValues: toValues(initial) });
  const e = form.formState.errors;
  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await onSubmit(toPayload(v));
    } catch (err) {
      setFormError(applyServerErrors(err, form.setError));
    }
  });
  return (
    <form className="box form" onSubmit={submit} noValidate aria-label="Dados da publicação">
      <FormError message={formError} />
      <TextField label="Título" {...form.register('title')} error={e.title} />
      <TextArea label="Descrição" {...form.register('description')} error={e.description} />
      <div className="row3">
        <TextField label="Data e horário da apresentação" type="datetime-local" {...form.register('startsAt')} error={e.startsAt} />
        <TextField label="Duração (min)" type="number" {...form.register('durationMinutes')} error={e.durationMinutes} />
        <TextField label="Prazo de candidatura" type="datetime-local" {...form.register('applicationDeadline')} error={e.applicationDeadline} />
      </div>
      <div className="row3">
        <TextField label="Vagas" type="number" min={1} max={50} {...form.register('slots')} error={e.slots} />
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
      <PageHead title="Nova publicação" back={`/painel/casas/${orgId}`} subtitle="A publicação é criada como rascunho (não pública). Publique quando estiver pronta." />
      <EventForm
        submitLabel="Salvar rascunho"
        onSubmit={async (p) => {
          const ev = await api.post<EventManage>(`/organizations/${orgId}/events`, p);
          await qc.invalidateQueries({ queryKey: ['org-events', orgId] });
          toast('Rascunho criado.');
          navigate(`/painel/eventos/${ev.id}`);
        }}
      />
    </>
  );
}

const TRANSITIONS: Record<string, { action: string; label: string; cls: string; confirm?: string }[]> = {
  DRAFT: [
    { action: 'publish', label: 'Publicar e abrir inscrições', cls: 'btn cue' },
    { action: 'cancel', label: 'Cancelar', cls: 'btn danger', confirm: 'Cancelar esta publicação?' },
  ],
  OPEN: [
    { action: 'close', label: 'Encerrar inscrições', cls: 'btn', confirm: 'Encerrar inscrições? Novas candidaturas serão bloqueadas.' },
    { action: 'cancel', label: 'Cancelar evento', cls: 'btn danger', confirm: 'Cancelar este evento?' },
  ],
  CLOSED: [
    { action: 'reopen', label: 'Reabrir inscrições', cls: 'btn' },
    { action: 'complete', label: 'Marcar como concluído', cls: 'btn' },
    { action: 'cancel', label: 'Cancelar evento', cls: 'btn danger', confirm: 'Cancelar este evento?' },
  ],
};

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

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const ev = q.data!;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      qc.setQueryData(key, (await fn()) as EventManage);
      await qc.invalidateQueries({ queryKey: ['org-events', ev.organizerId] });
      toast(ok);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const app = ev.applications.find((a) => a.id === negotiate);
  const accepted = ev.applications.filter((a) => a.status === 'ACCEPTED').length;

  return (
    <>
      <PageHead
        title={ev.title}
        back={`/painel/casas/${ev.organizerId}`}
        subtitle={
          <>
            <Status value={ev.status} map={EVENT_STATUS} /> · {dateTime(ev.startsAt)} · prazo {dateTime(ev.applicationDeadline)}
          </>
        }
        actions={
          <>
            {(TRANSITIONS[ev.status] ?? []).map((t) =>
              t.confirm ? (
                <ConfirmButton key={t.action} className={t.cls} confirm={t.confirm} onConfirm={() => run(() => api.post(`/events/${ev.id}/transition`, { action: t.action }), 'Publicação atualizada.')}>
                  {t.label}
                </ConfirmButton>
              ) : (
                <button key={t.action} type="button" className={t.cls} onClick={() => run(() => api.post(`/events/${ev.id}/transition`, { action: t.action }), 'Publicação atualizada.')}>
                  {t.label}
                </button>
              ),
            )}
            {['DRAFT', 'OPEN', 'CLOSED'].includes(ev.status) && (
              <button type="button" className="btn ghost" onClick={() => setEditing((x) => !x)}>
                {editing ? 'Fechar edição' : 'Editar'}
              </button>
            )}
          </>
        }
      />
      {ev.status !== 'DRAFT' && (
        <p className="hint">
          Página pública:{' '}
          <Link className="link" to={`/oportunidades/${ev.id}`}>
            ver como artistas veem
          </Link>
        </p>
      )}
      {editing ? (
        <EventForm
          initial={ev}
          submitLabel="Salvar alterações"
          onSubmit={async (p) => {
            qc.setQueryData(key, await api.patch<EventManage>(`/events/${ev.id}`, p));
            setEditing(false);
            toast('Publicação atualizada.');
          }}
        />
      ) : (
        <section className="box">
          <dl className="attrs">
            <div>
              <dt>Vagas</dt>
              <dd>
                {accepted}/{ev.slots} selecionadas
              </dd>
            </div>
            <div>
              <dt>Duração</dt>
              <dd>{duration(ev.durationMinutes)}</dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>{ev.paymentType ?? '—'}</dd>
            </div>
            <div>
              <dt>Cachê</dt>
              <dd>{money(ev.feeCents)}</dd>
            </div>
          </dl>
          {ev.description && <p className="prose">{ev.description}</p>}
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
                  <button className="btn sm ghost" type="button" onClick={() => setCompare(a.artist.id)}>
                    Comparar rider
                  </button>
                  {a.status === 'PENDING' && (
                    <>
                      <button className="btn sm cue" type="button" onClick={() => run(() => api.post(`/applications/${a.id}/accept`, {}), 'Candidatura selecionada. Isso não confirma a contratação.')}>
                        Selecionar
                      </button>
                      <ConfirmButton className="btn sm danger" confirm={`Recusar a candidatura de ${a.artist.name}?`} onConfirm={() => run(() => api.post(`/applications/${a.id}/reject`, {}), 'Candidatura recusada.')}>
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
        <p className="note">Selecionar uma candidatura não confirma a contratação: a negociação e a confirmação são etapas próprias.</p>
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
    </>
  );
}
