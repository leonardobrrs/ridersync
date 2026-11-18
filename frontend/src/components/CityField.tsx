import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import type { FieldError } from 'react-hook-form';
import { useMeta } from '../lib/hooks';

/** Município de Alagoas com preenchimento automático (os 102 municípios; o servidor valida o nome). */
export const CityField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: FieldError | { message?: string } }>(
  function CityField({ label = 'Cidade (Alagoas)', error, ...rest }, ref) {
    const id = useId();
    const { data: meta } = useMeta();
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <input id={id} ref={ref} className="input" list={`${id}-l`} autoComplete="off" aria-invalid={!!error} aria-describedby={`${id}-h`} {...rest} />
        <datalist id={`${id}-l`}>
          {meta?.allCities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <small id={`${id}-h`}>No momento, o RiderSync atende apenas municípios de Alagoas.</small>
        {error?.message && <span className="err">{error.message}</span>}
      </div>
    );
  },
);
