import type { AccountType } from '../lib/types';
import { Icon } from './Icon';

const OPTIONS: { value: AccountType; title: string; text: string; icon: string }[] = [
  {
    value: 'ARTIST',
    title: 'Sou artista',
    text: 'Músico ou integrante de banda: perfil profissional, portfólio, rider técnico, candidaturas e propostas.',
    icon: 'mic',
  },
  {
    value: 'CONTRACTOR',
    title: 'Sou proprietário ou contratante',
    text: 'Casa de show, bar, teatro ou pessoa que contrata música para um evento (ex.: aniversário).',
    icon: 'venue',
  },
];

/** Escolha obrigatória do tipo de conta (cartões de rádio acessíveis). */
export function AccountTypeChooser({ value, onChange, error }: { value: AccountType | null; onChange: (v: AccountType) => void; error?: string }) {
  return (
    <fieldset className="acct-type" aria-describedby={error ? 'acct-type-e' : undefined}>
      <legend>Como você vai usar o RiderSync?</legend>
      <div className="acct-type-opts">
        {OPTIONS.map((o) => (
          <label key={o.value} className={value === o.value ? 'on' : ''}>
            <input type="radio" name="accountType" value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <Icon name={o.icon} size={26} />
            <strong>{o.title}</strong>
            <span>{o.text}</span>
          </label>
        ))}
      </div>
      {error && (
        <span className="err" id="acct-type-e">
          {error}
        </span>
      )}
    </fieldset>
  );
}
