import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { FieldError, FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../lib/api';
import { maskPhoneBR } from '../lib/phone';

interface BaseProps {
  label: string;
  error?: FieldError | { message?: string };
  hint?: ReactNode;
}

function describedBy(id: string, hint: unknown, error: unknown) {
  return [hint ? `${id}-h` : '', error ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
}

function Extra({ id, hint, error }: { id: string; hint?: ReactNode; error?: { message?: string } }) {
  return (
    <>
      {hint && <small id={`${id}-h`}>{hint}</small>}
      {error?.message && (
        <span className="err" id={`${id}-e`}>
          {error.message}
        </span>
      )}
    </>
  );
}

export function TextField({ label, error, hint, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" aria-invalid={!!error} aria-describedby={describedBy(id, hint, error?.message)} {...rest} />
      <Extra id={id} hint={hint} error={error} />
    </div>
  );
}

/** Telefone com máscara automática: (82) 3333-4444 ou (82) 99999-8888, conforme a quantidade de dígitos. */
export function PhoneField({ onChange, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <TextField
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder="(82) 99999-9999"
      maxLength={16}
      {...rest}
      onChange={(e) => {
        // Formata antes de repassar: o formulário (RHF) já recebe o valor mascarado.
        e.target.value = maskPhoneBR(e.target.value);
        onChange?.(e);
      }}
    />
  );
}

export function TextArea({ label, error, hint, ...rest }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="input" aria-invalid={!!error} aria-describedby={describedBy(id, hint, error?.message)} {...rest} />
      <Extra id={id} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({ label, error, hint, children, ...rest }: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" aria-invalid={!!error} aria-describedby={describedBy(id, hint, error?.message)} {...rest}>
        {children}
      </select>
      <Extra id={id} hint={hint} error={error} />
    </div>
  );
}

/** Grupo de chips de seleção múltipla (estilo .pick dos protótipos). */
export function ChipPicker({
  legend,
  options,
  value,
  onChange,
  max,
  error,
}: {
  legend: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  error?: { message?: string };
}) {
  return (
    <fieldset>
      <legend>
        {legend}
        {max ? <span className="hint"> (até {max})</span> : null}
      </legend>
      <div className="pick">
        {options.map((o) => {
          const checked = value.includes(o);
          return (
            <label key={o}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && !!max && value.length >= max}
                onChange={() => onChange(checked ? value.filter((v) => v !== o) : [...value, o])}
              />
              <span>{o}</span>
            </label>
          );
        })}
      </div>
      {error?.message && <span className="err">{error.message}</span>}
    </fieldset>
  );
}

/** Aplica erros de validação do backend (details[].path) aos campos do formulário. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>): string | null {
  if (!(e instanceof ApiError)) return 'Algo deu errado.';
  let applied = false;
  for (const d of e.details) {
    if (d.path) {
      setError(d.path as Path<T>, { message: d.message });
      applied = true;
    }
  }
  return applied ? null : e.message;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="inline-msg bad" role="alert">
      {message}
    </div>
  );
}
