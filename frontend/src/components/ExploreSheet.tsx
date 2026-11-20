import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import type { AccountType } from '../lib/types';
import { Icon } from './Icon';

type Item = { to: string; label: string; icon: string; hint: string; match: (path: string, kind: string) => boolean };

/**
 * Celular/tablet: categorias da página inicial em um painel aberto pelo botão "Explorar" da barra inferior
 * (a barra de categorias do topo ocupava muito espaço). Fecha ao escolher, no fundo escurecido, no X e com Esc.
 */
export function ExploreSheet({ open, onClose, accountType }: { open: boolean; onClose: () => void; accountType: AccountType | null }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const { pathname, search } = useLocation();
  const kind = new URLSearchParams(search).get('kind') ?? '';

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const home = (k: string) => (path: string, current: string) => path === '/' && current === k;
  const items: Item[] = [
    {
      to: '/',
      label: accountType ? 'Para você' : 'Todos',
      icon: accountType ? 'home' : 'grid',
      hint: accountType === 'ARTIST' ? 'Oportunidades e casas de show' : accountType === 'CONTRACTOR' ? 'Artistas para contratar e shows' : 'Músicos, bandas, casas e shows',
      match: home(''),
    },
    { to: '/?kind=SOLO', label: 'Músicos', icon: 'mic', hint: 'Perfis individuais', match: home('SOLO') },
    { to: '/?kind=BAND', label: 'Bandas', icon: 'users', hint: 'Grupos e formações', match: home('BAND') },
    { to: '/?kind=VENUE', label: 'Casas de show', icon: 'venue', hint: 'Espaços com música ao vivo', match: home('VENUE') },
  ];
  if (accountType !== 'CONTRACTOR') {
    items.push({ to: '/oportunidades', label: 'Oportunidades', icon: 'ticket', hint: 'Vagas abertas para tocar', match: (p) => p.startsWith('/oportunidades') && !search.includes('encerrados') });
  }
  items.push({ to: '/oportunidades?status=encerrados', label: 'Eventos encerrados', icon: 'calendar', hint: 'Shows fechados e realizados, com as atrações', match: (p) => p.startsWith('/oportunidades') && search.includes('encerrados') });

  // Portal: fora da barra inferior (que é um contexto de empilhamento e estiliza os próprios links).
  return createPortal(
    <>
      <div className="sheet-backdrop" aria-hidden="true" onClick={onClose} />
      <div className="sheet explore-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <div className="sheet-h">
          <strong id={titleId}>Explorar</strong>
          <button type="button" className="btn sm ghost" aria-label="Fechar" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <nav aria-label="Categorias">
          <ul className="explore-list">
            {items.map((it) => {
              const current = it.match(pathname, kind);
              return (
                <li key={it.to}>
                  <Link to={it.to} aria-current={current ? 'page' : undefined} onClick={onClose}>
                    <span className="ci">
                      <Icon name={it.icon} size={22} />
                    </span>
                    <span className="explore-t">
                      <strong>{it.label}</strong>
                      <small>{it.hint}</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>,
    document.body,
  );
}
