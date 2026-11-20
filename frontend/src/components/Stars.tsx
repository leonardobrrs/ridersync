import { useId } from 'react';
import type { ReviewSummary } from '../lib/types';

const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z';

function Star({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={filled ? 'star on' : 'star'}>
      <path d={STAR} />
    </svg>
  );
}

/** Nota exibida (0 a 5), com texto para leitor de tela. */
export function Stars({ value, size }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="stars" role="img" aria-label={`${value.toLocaleString('pt-BR')} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= full} size={size} />
      ))}
    </span>
  );
}

/** Escolha da nota de 0 a 5 estrelas (grupo de opções acessível por teclado). */
export function StarInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const name = useId();
  return (
    <fieldset className="star-input">
      <legend>Nota</legend>
      <div className="star-row">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`star-opt${value !== null && n <= value && n > 0 ? ' on' : ''}${n === 0 ? ' zero' : ''}`} title={`${n} estrela${n === 1 ? '' : 's'}`}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            {n === 0 ? <span className="zero-label">0</span> : <Star filled={value !== null && n <= value} size={30} />}
            <span className="sr-only">{n} estrela{n === 1 ? '' : 's'}</span>
          </label>
        ))}
      </div>
      <small className="hint">{value === null ? 'Escolha de 0 a 5 estrelas.' : `${value} de 5 estrelas`}</small>
    </fieldset>
  );
}

/** Resumo público: média, quantidade e comentários recentes. */
export function ReviewsSummary({ r, empty }: { r: ReviewSummary; empty: string }) {
  if (!r.count) return <p className="muted">{empty}</p>;
  return (
    <div className="reviews">
      <p className="row" style={{ gap: 8 }}>
        <strong style={{ fontSize: 22 }}>{r.average?.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</strong>
        <Stars value={r.average ?? 0} />
        <span className="muted">
          ({r.count} avaliaç{r.count === 1 ? 'ão' : 'ões'})
        </span>
      </p>
      <ul className="review-list">
        {r.recent.map((x) => (
          <li key={x.id}>
            <span className="row" style={{ gap: 8 }}>
              <Stars value={x.rating} size={14} />
              <small className="muted">
                {x.authorName} · {new Date(x.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' })}
              </small>
            </span>
            {x.comment && <p>{x.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
