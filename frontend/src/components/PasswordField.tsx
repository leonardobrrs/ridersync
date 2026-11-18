import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import type { FieldError } from 'react-hook-form';
import { PASSWORD_RULES } from '../lib/password';
import { Icon } from './Icon';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: FieldError | { message?: string };
  hint?: string;
  /** Exibe a lista de requisitos marcando os já atendidos (usar no cadastro/troca de senha). */
  showRules?: boolean;
  watchValue?: string;
};

/**
 * Campo de senha com alternância de visibilidade: olho fechado = senha oculta, olho aberto = senha visível.
 */
export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { label, error, hint, showRules, watchValue = '', ...rest },
  ref,
) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-h` : '', showRules ? `${id}-r` : '', error?.message ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input
          id={id}
          ref={ref}
          className="input"
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...rest}
        />
        <button
          type="button"
          className="pw-t"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          aria-controls={id}
        >
          <Icon name={visible ? 'eye' : 'eyeOff'} size={20} />
        </button>
      </div>
      {hint && <small id={`${id}-h`}>{hint}</small>}
      {showRules && (
        <ul className="pw-rules" id={`${id}-r`} aria-label="Requisitos da senha">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(watchValue);
            return (
              <li key={r.label} className={ok ? 'ok' : ''}>
                <Icon name={ok ? 'check' : 'x'} size={14} />
                <span>{r.label}</span>
                <span className="sr-only">{ok ? '(atendido)' : '(pendente)'}</span>
              </li>
            );
          })}
        </ul>
      )}
      {error?.message && (
        <span className="err" id={`${id}-e`}>
          {error.message}
        </span>
      )}
    </div>
  );
});
