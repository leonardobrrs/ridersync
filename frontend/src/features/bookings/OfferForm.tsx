import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { applyServerErrors, FormError, TextArea, TextField } from '../../components/Fields';
import { centsFromReais, fromLocalInput, reaisFromCents, toLocalInput } from '../../lib/format';

const OfferFormSchema = z.object({
  performanceAt: z
    .string()
    .min(1, 'Informe data e horário.')
    .refine((v) => new Date(fromLocalInput(v)).getTime() > Date.now(), 'A data deve estar no futuro.'),
  durationMinutes: z.string().refine((v) => /^\d+$/.test(v) && Number(v) >= 15 && Number(v) <= 720, 'Entre 15 e 720 minutos.'),
  fee: z.string().trim().refine((v) => /^\d+([.,]\d{1,2})?$/.test(v), 'Informe o cachê (ex.: 800 ou 800,00).'),
  terms: z.string().trim().max(2000),
  message: z.string().trim().max(2000),
});
type Values = z.infer<typeof OfferFormSchema>;

export interface OfferPayload {
  offer: { performanceAt: string; durationMinutes: number; feeCents: number; terms: string };
  message?: string;
}

/** Formulário de proposta/contraproposta. Cada envio cria uma nova oferta no histórico. */
export function OfferForm({
  initial,
  withMessage = true,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { performanceAt?: string; durationMinutes?: number | null; feeCents?: number | null; terms?: string };
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
    },
  });
  const e = form.formState.errors;
  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await onSubmit({
        offer: {
          performanceAt: fromLocalInput(v.performanceAt),
          durationMinutes: Number(v.durationMinutes),
          feeCents: centsFromReais(v.fee) ?? 0,
          terms: v.terms,
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
