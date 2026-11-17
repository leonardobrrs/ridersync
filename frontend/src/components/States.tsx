import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../lib/api';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  if (e?.status === 403) {
    return (
      <div className="errorbox" role="alert">
        <span>Acesso negado: {e.message}</span>
        <Link className="btn sm" to="/painel">
          Voltar ao painel
        </Link>
      </div>
    );
  }
  if (e?.status === 404) {
    return (
      <div className="empty" role="alert">
        <strong>Não encontrado</strong>
        <span>{e.message}</span>
        <Link className="btn sm" to="/">
          Ir para o início
        </Link>
      </div>
    );
  }
  return (
    <div className="errorbox" role="alert">
      <span>{error instanceof Error ? error.message : 'Não foi possível carregar.'}</span>
      {retry && (
        <button className="btn sm" type="button" onClick={retry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}

export function Status({ value, map }: { value: string; map: Record<string, [string, string]> }) {
  const [label, tone] = map[value] ?? [value, 'neutral'];
  return <span className={`st ${tone}`}>{label}</span>;
}
