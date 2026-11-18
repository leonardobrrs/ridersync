import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHead } from '../../components/Layout';
import { Empty, ErrorState, Loading } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import type { NotificationCategory, NotificationItem, NotificationPreferences } from '../../lib/types';

const CATEGORY: Record<NotificationCategory, string> = {
  ACCOUNT: 'Conta e segurança',
  INVITATIONS: 'Convites',
  APPLICATIONS: 'Candidaturas',
  BOOKINGS: 'Negociações',
  EVENTS: 'Eventos',
};

export function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['notifications', 'page', unreadOnly],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.get<{ items: NotificationItem[]; nextBefore: string | null }>(
        `/me/notifications?limit=20${unreadOnly ? '&unread=true' : ''}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextBefore,
  });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['notifications'] });
    await qc.invalidateQueries({ queryKey: ['me'] });
  };
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHead
        title="Notificações"
        subtitle="Tudo o que precisa da sua atenção: convites, candidaturas, propostas, eventos e avisos da conta."
        actions={
          <>
            <Link className="btn sm" to="/painel/notificacoes/preferencias">
              Preferências
            </Link>
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                await api.post('/me/notifications/read-all');
                await refresh();
              }}
            >
              Marcar todas como lidas
            </button>
          </>
        }
      />
      <label className="check">
        <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
        Mostrar apenas não lidas
      </label>
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data && items.length === 0 && <Empty title={unreadOnly ? 'Nenhuma notificação não lida' : 'Nenhuma notificação ainda'} />}
      <ul className="notif-list">
        {items.map((n) => (
          <li key={n.id} className={n.readAt ? '' : 'unread'}>
            <div className="stack-sm">
              <span className="chip sm">{CATEGORY[n.category]}</span>
              <strong>{n.title}</strong>
              {n.body && <span>{n.body}</span>}
              <small className="muted">{dateTime(n.createdAt)}</small>
            </div>
            <div className="row">
              {n.link && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={async () => {
                    if (!n.readAt) await api.post(`/me/notifications/${n.id}/read`).catch(() => undefined);
                    await refresh();
                    navigate(n.link!);
                  }}
                >
                  Abrir
                </button>
              )}
              {!n.readAt && (
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={async () => {
                    await api.post(`/me/notifications/${n.id}/read`);
                    await refresh();
                  }}
                >
                  Marcar como lida
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <button type="button" className="btn" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </>
  );
}

const PREF_ROWS: { key: keyof NotificationPreferences; label: string; hint: string }[] = [
  { key: 'emailInvitations', label: 'Convites', hint: 'Convites para bandas e casas e respostas a convites enviados.' },
  { key: 'emailApplications', label: 'Candidaturas', hint: 'Novas candidaturas, seleção e não seleção.' },
  { key: 'emailBookings', label: 'Negociações', hint: 'Propostas, contrapropostas, mensagens, confirmações e cancelamentos.' },
  { key: 'emailEvents', label: 'Eventos', hint: 'Vagas preenchidas, adiamentos, remarcações e cancelamentos.' },
];

export function NotificationPreferencesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['notification-prefs'], queryFn: () => api.get<NotificationPreferences>('/me/notification-preferences') });
  const save = async (patch: Partial<NotificationPreferences>) => {
    const next = await api.put<NotificationPreferences>('/me/notification-preferences', patch);
    qc.setQueryData(['notification-prefs'], next);
    toast('Preferências salvas.');
  };
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const p = q.data!;
  return (
    <>
      <PageHead title="Preferências de notificação" back="/painel/notificacoes" subtitle="As notificações sempre aparecem no sino. Aqui você escolhe o que também chega por e-mail." />
      <section className="box stack">
        <label className="switch">
          <input type="checkbox" checked={p.emailEnabled} onChange={(e) => save({ emailEnabled: e.target.checked })} />
          <span>
            <strong>Receber notificações por e-mail</strong>
            <small>Desative para parar todos os e-mails de notificação com um clique.</small>
          </span>
        </label>
        <fieldset className="stack" disabled={!p.emailEnabled}>
          <legend className="lbl">Categorias por e-mail</legend>
          {PREF_ROWS.map((r) => (
            <label className="switch" key={r.key}>
              <input type="checkbox" checked={p[r.key]} onChange={(e) => save({ [r.key]: e.target.checked })} />
              <span>
                <strong>{r.label}</strong>
                <small>{r.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="hint">Avisos de segurança e de funcionamento da conta (ex.: troca de senha, transferência de propriedade) são sempre enviados por e-mail.</p>
      </section>
    </>
  );
}
