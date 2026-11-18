import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import type { NotificationItem } from '../lib/types';
import { Icon } from './Icon';

const POLL_MS = 30_000;

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unread: number }>('/me/notifications/unread-count'),
    enabled,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Sino no topo: contador de não lidas e as notificações mais recentes. */
export function NotificationBell() {
  const location = useLocation();
  // Aberto apenas na rota em que foi aberto: fecha sozinho ao navegar.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === location.pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenPath((typeof v === 'function' ? v(open) : v) ? location.pathname : null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const unread = useUnreadCount(true);
  const list = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api.get<{ items: NotificationItem[] }>('/me/notifications?limit=8'),
    enabled: open,
  });
  const count = unread.data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpenPath(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenPath(null);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const openItem = async (n: NotificationItem) => {
    if (!n.readAt) await api.post(`/me/notifications/${n.id}/read`).catch(() => undefined);
    await refresh();
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className="hlink"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={count ? `Notificações: ${count} não lida(s)` : 'Notificações'}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" />
        {count > 0 && <span className="n">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="menu bell-menu" role="dialog" aria-label="Notificações recentes">
          <div className="bell-h">
            <strong>Notificações</strong>
            {count > 0 && (
              <button
                type="button"
                className="link"
                onClick={async () => {
                  await api.post('/me/notifications/read-all');
                  await refresh();
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          {list.isLoading && <p className="muted bell-empty">Carregando…</p>}
          {list.data?.items.length === 0 && <p className="muted bell-empty">Nenhuma notificação por aqui.</p>}
          <ul className="bell-list">
            {list.data?.items.map((n) => (
              <li key={n.id}>
                <button type="button" className={n.readAt ? '' : 'unread'} onClick={() => openItem(n)}>
                  <strong>{n.title}</strong>
                  {n.body && <span>{n.body}</span>}
                  <small>{dateTime(n.createdAt)}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="bell-f">
            <Link to="/painel/notificacoes">Ver todas</Link>
            <Link to="/painel/notificacoes/preferencias">Preferências</Link>
          </div>
        </div>
      )}
    </div>
  );
}
