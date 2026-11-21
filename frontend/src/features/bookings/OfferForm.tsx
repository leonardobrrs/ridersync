import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { applyServerErrors, FormError, TextArea, TextField } from '../../components/Fields';
import { centsFromReais, fromLocalInput, money, reaisFromCents, toLocalInput } from '../../lib/format';

const reais = (label: string) => z.string().trim().refine((v) => v === '' || /^\d+([.,]\d{1,2})?$/.test(v), `${label} inválido (ex.: 300 ou 300,00).`);
const days = (label: string, min: number, max: number) =>
  z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), `${label}: de ${min} a ${max}.`);
const dateOnly = z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data inválida.');

const OfferFormSchema = z
  .object({
    performanceAt: z
      .string()
      .min(1, 'Informe data e horário.')
      .refine((v) => new Date(fromLocalInput(v)).getTime() > Date.now(), 'A data deve estar no futuro.'),
    durationMinutes: z.string().refine((v) => /^\d+$/.test(v) && Number(v) >= 15 && Number(v) <= 720, 'Entre 15 e 720 minutos.'),
    fee: z.string().trim().refine((v) => /^\d+([.,]\d{1,2})?$/.test(v), 'Informe o cachê (ex.: 800 ou 800,00).'),
    terms: z.string().trim().max(2000),
    message: z.string().trim().max(2000),
    // Condições do contrato — todas opcionais; o que faltar aparece como "[A PREENCHER]" no contrato.
    presentationDesc: z.string().trim().max(300, 'No máximo 300 caracteres.'),
    advanceMinutes: days('Antecedência', 0, 1440),
    signal: reais('Sinal'),
    signalDueDate: dateOnly,
    balanceDueDate: dateOnly,
    paymentMethod: z.string().trim().max(80, 'No máximo 80 caracteres.'),
    rescissionDays: days('Prazo de rescisão', 0, 365),
    substitutionDays: days('Prazo de substituição', 0, 365),
  })
  .refine((v) => v.signal === '' || v.fee === '' || (centsFromReais(v.signal) ?? 0) <= (centsFromReais(v.fee) ?? 0), {
    path: ['signal'],
    message: 'O sinal não pode ser maior que o cachê.',
  });
type Values = z.infer<typeof OfferFormSchema>;

export interface OfferPayload {
  offer: {
    performanceAt: string;
    durationMinutes: number;
    feeCents: number;
    terms: string;
    presentationDesc: string | null;
    advanceMinutes: number | null;
    signalCents: number | null;
    signalDueDate: string | null;
    balanceDueDate: string | null;
    paymentMethod: string | null;
    rescissionDays: number | null;
    substitutionDays: number | null;
  };
  message?: string;
}

export interface OfferInitial {
  performanceAt?: string;
  durationMinutes?: number | null;
  feeCents?: number | null;
  terms?: string;
  presentationDesc?: string | null;
  advanceMinutes?: number | null;
  signalCents?: number | null;
  signalDueDate?: string | null;
  balanceDueDate?: string | null;
  paymentMethod?: string | null;
  rescissionDays?: number | null;
  substitutionDays?: number | null;
}

const intOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
const textOrNull = (v: string) => (v.trim() === '' ? null : v.trim());
/** ISO (meia-noite UTC, coluna DATE) → valor de <input type="date">. */
const dateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

/** Formulário de proposta/contraproposta. Cada envio cria uma nova oferta no histórico. */
export function OfferForm({
  initial,
  withMessage = true,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: OfferInitial;
  withMessage?: boolean;
  submitLabel: string;
  onSubmit: (p: OfferPayload) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(OfferFormSchema),
    defaultValues: {
      performanceAt: toLocalInput(initial?.performanceAt),
      durationMinutes: String(initial?.durationMinutes ?? 60),
      fee: reaisFromCents(initial?.feeCents),
      terms: initial?.terms ?? '',
      message: '',
      presentationDesc: initial?.presentationDesc ?? '',
      advanceMinutes: initial?.advanceMinutes == null ? '' : String(initial.advanceMinutes),
      signal: reaisFromCents(initial?.signalCents),
      signalDueDate: dateInput(initial?.signalDueDate),
      balanceDueDate: dateInput(initial?.balanceDueDate),
      paymentMethod: initial?.paymentMethod ?? '',
      rescissionDays: initial?.rescissionDays == null ? '' : String(initial.rescissionDays),
      substitutionDays: initial?.substitutionDays == null ? '' : String(initial.substitutionDays),
    },
  });
  const e = form.formState.errors;
  const [fee, signal] = useWatch({ control: form.control, name: ['fee', 'signal'] });
  const feeCents = centsFromReais(fee);
  const signalCents = centsFromReais(signal);
  const balanceCents = feeCents != null && signalCents != null && signalCents <= feeCents ? feeCents - signalCents : null;
  const hasContractTerms = !!initial && [initial.presentationDesc, initial.advanceMinutes, initial.signalCents, initial.paymentMethod].some((x) => x != null && x !== '');
  const contractErrors = ['presentationDesc', 'advanceMinutes', 'signal', 'signalDueDate', 'balanceDueDate', 'paymentMethod', 'rescissionDays', 'substitutionDays'].some(
    (k) => k in e,
  );

  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await onSubmit({
        offer: {
          performanceAt: fromLocalInput(v.performanceAt),
          durationMinutes: Number(v.durationMinutes),
          feeCents: centsFromReais(v.fee) ?? 0,
          terms: v.terms,
          presentationDesc: textOrNull(v.presentationDesc),
          advanceMinutes: intOrNull(v.advanceMinutes),
          signalCents: centsFromReais(v.signal),
          signalDueDate: v.signalDueDate || null,
          balanceDueDate: v.balanceDueDate || null,
          paymentMethod: textOrNull(v.paymentMethod),
          rescissionDays: intOrNull(v.rescissionDays),
          substitutionDays: intOrNull(v.substitutionDays),
        },
        message: v.message || undefined,
      });
    } catch (err) {
      setFormError(applyServerErrors(err, form.setError));
    }
  });
  return (
    <form className="form" onSubmit={submit} noValidate>
      <FormError message={formError} />
      <div className="row3">
        <TextField label="Data e horário (Maceió)" type="datetime-local" {...form.register('performanceAt')} error={e.performanceAt} />
        <TextField label="Duração (min)" type="number" min={15} max={720} {...form.register('durationMinutes')} error={e.durationMinutes} />
        <TextField label="Cachê (R$)" inputMode="decimal" {...form.register('fee')} error={e.fee} />
      </div>
      <TextArea label="Condições" placeholder="Som, luz, alimentação, transporte, passagem de som…" {...form.register('terms')} error={e.terms} style={{ minHeight: 80 }} />
      <details className="contract-terms" open={hasContractTerms || contractErrors}>
        <summary>Condições do contrato (opcional)</summary>
        <div className="stack-sm">
          <p className="hint">
            Estes dados preenchem o contrato gerado quando a contratação for confirmada. O que ficar em branco aparece como “[A PREENCHER]”.
          </p>
          <TextField label="Descrição da apresentação" placeholder="Ex.: Show de forró pé de serra" maxLength={300} {...form.register('presentationDesc')} error={e.presentationDesc} />
          <div className="row3">
            <TextField label="Sinal (R$)" inputMode="decimal" {...form.register('signal')} error={e.signal} hint={balanceCents != null ? `Saldo: ${money(balanceCents)}` : undefined} />
            <TextField label="Prazo do sinal" type="date" {...form.register('signalDueDate')} error={e.signalDueDate} />
            <TextField label="Prazo do saldo" type="date" {...form.register('balanceDueDate')} error={e.balanceDueDate} />
          </div>
          <div className="row2">
            <TextField label="Forma de pagamento" placeholder="Ex.: Pix" maxLength={80} {...form.register('paymentMethod')} error={e.paymentMethod} />
            <TextField label="Chegada com antecedência (min)" type="number" min={0} max={1440} {...form.register('advanceMinutes')} error={e.advanceMinutes} />
          </div>
          <div className="row2">
            <TextField label="Aviso de rescisão (dias)" type="number" min={0} max={365} placeholder="Padrão: 2" {...form.register('rescissionDays')} error={e.rescissionDays} />
            <TextField label="Aviso de substituição de integrante (dias)" type="number" min={0} max={365} placeholder="Padrão: 5" {...form.register('substitutionDays')} error={e.substitutionDays} />
          </div>
        </div>
      </details>
      {withMessage && <TextArea label="Mensagem (opcional)" {...form.register('message')} error={e.message} style={{ minHeight: 70 }} />}
      <p className="hint">O pagamento é combinado e realizado fora da plataforma.</p>
      <div className="actions">
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Enviando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
