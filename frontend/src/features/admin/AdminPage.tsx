import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Dialog } from '../../components/Dialog';
import { FormError, TextField } from '../../components/Fields';
import { PasswordField } from '../../components/PasswordField';
import { ErrorState, Loading, Status } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { BOOKING_STATUS, dateTime, EVENT_STATUS } from '../../lib/format';

/**
 * Painel de administração — acessível só por /adm (sem link no sistema). Login próprio, independente das contas.
 * Serve para limpar dados de teste sem resetar o banco: as exclusões são definitivas.
 */

type Row = { id: string } & Record<string, unknown>;
interface Col {
  label: string;
  render: (r: Row) => ReactNode;
}
interface Section {
  id: string;
  label: string;
  endpoint: string;
  noun: string;
  cols: Col[];
  title: (r: Row) => string;
  consequence: string;
}

const s = (v: unknown) => (v == null ? '—' : String(v));
const people = (list: unknown) => ((list as { name: string; role?: string }[]) ?? []).map((m) => `${m.name}${m.role ? ` (${ROLE[m.role] ?? m.role})` : ''}`).join(', ') || '—';
const ROLE: Record<string, string> = { OWNER: 'proprietário', ADMIN: 'admin', MEMBER: 'integrante' };

const SECTIONS: Section[] = [
  {
    id: 'users',
    label: 'Contas',
    endpoint: '/admin/users',
    noun: 'conta',
    title: (r) => `${s(r.name)} (${s(r.email)})`,
    consequence:
      'Apaga a conta, o perfil individual, sessões, notificações e arquivos enviados. Bandas e casas em que ela é a única integrante também são apagadas (com eventos e negociações); onde há outras pessoas, a propriedade passa para outra integrante.',
    cols: [
      { label: 'Nome', render: (r) => <strong>{s(r.name)}</strong> },
      { label: 'E-mail', render: (r) => s(r.email) },
      { label: 'Tipo', render: (r) => (r.accountType === 'ARTIST' ? 'Artista' : r.accountType === 'CONTRACTOR' ? 'Contratante' : '—') },
      {
        label: 'Vínculos',
        render: (r) =>
          [r.profile ? `Perfil: ${s(r.profile)}` : '', ...((r.bands as { name: string }[]) ?? []).map((b) => `Banda: ${b.name}`), ...((r.organizations as { name: string }[]) ?? []).map((o) => `Casa: ${o.name}`)]
            .filter(Boolean)
            .join(' · ') || '—',
      },
      { label: 'Criada', render: (r) => dateTime(r.createdAt as string) },
    ],
  },
  {
    id: 'artists',
    label: 'Artistas e bandas',
    endpoint: '/admin/artists',
    noun: 'perfil artístico',
    title: (r) => s(r.name),
    consequence: 'Apaga o perfil (ou a banda), com rider, portfólio, candidaturas, negociações e contratos. As contas das pessoas continuam.',
    cols: [
      { label: 'Nome', render: (r) => <strong>{s(r.name)}</strong> },
      { label: 'Tipo', render: (r) => (r.kind === 'BAND' ? 'Banda' : 'Solo') },
      { label: 'Responsável', render: (r) => (r.owner ? s((r.owner as { name: string }).name) : people(r.members)) },
      { label: 'Visível', render: (r) => (r.visibility === 'PUBLIC' ? 'Público' : 'Privado') },
      { label: 'Cand./Neg.', render: (r) => `${s(r.applications)} / ${s(r.bookings)}` },
      { label: 'Criado', render: (r) => dateTime(r.createdAt as string) },
    ],
  },
  {
    id: 'organizations',
    label: 'Casas e contratantes',
    endpoint: '/admin/organizations',
    noun: 'casa/contratante',
    title: (r) => s(r.name),
    consequence: 'Apaga a casa (ou o perfil de contratante), com inventário, eventos, candidaturas, negociações e contratos. As contas das pessoas continuam.',
    cols: [
      { label: 'Nome', render: (r) => <strong>{s(r.name)}</strong> },
      { label: 'Tipo', render: (r) => (r.type === 'VENUE' ? 'Casa de show' : 'Contratante (pessoa física)') },
      { label: 'Cidade', render: (r) => s(r.city) },
      { label: 'Responsáveis', render: (r) => people(r.members) },
      { label: 'Eventos/Neg.', render: (r) => `${s(r.events)} / ${s(r.bookings)}` },
    ],
  },
  {
    id: 'events',
    label: 'Eventos',
    endpoint: '/admin/events',
    noun: 'evento',
    title: (r) => s(r.title),
    consequence: 'Apaga o evento, as candidaturas e as negociações ligadas a ele (com mensagens e contratos).',
    cols: [
      { label: 'Título', render: (r) => <strong>{s(r.title)}</strong> },
      { label: 'Organizador', render: (r) => s(r.organizer) },
      { label: 'Estado', render: (r) => <Status value={String(r.status)} map={EVENT_STATUS} /> },
      { label: 'Data', render: (r) => dateTime(r.startsAt as string) },
      { label: 'Cand./Neg.', render: (r) => `${s(r.applications)} / ${s(r.bookings)}` },
    ],
  },
  {
    id: 'bookings',
    label: 'Negociações',
    endpoint: '/admin/bookings',
    noun: 'negociação',
    title: (r) => s(r.title),
    consequence: 'Apaga a negociação com propostas, mensagens, contrato e registro de apresentação.',
    cols: [
      { label: 'Título', render: (r) => <strong>{s(r.title)}</strong> },
      { label: 'Artista', render: (r) => s(r.artist) },
      { label: 'Contratante', render: (r) => s(r.organization) },
      { label: 'Estado', render: (r) => <Status value={String(r.status)} map={BOOKING_STATUS} /> },
      { label: 'Contrato', render: (r) => (r.hasContract ? 'Sim' : 'Não') },
      { label: 'Criada', render: (r) => dateTime(r.createdAt as string) },
    ],
  },
];

export function AdminPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Administração · RiderSync';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.title = prev;
      meta.remove();
    };
  }, []);
  const session = useQuery({ queryKey: ['admin', 'session'], queryFn: () => api.get<{ authenticated: boolean }>('/admin/session'), retry: false });

  if (session.isLoading) return <AdminShell><Loading /></AdminShell>;
  const err = session.error as ApiError | null;
  if (err?.status === 404) return <AdminShell><div className="box"><h1>Página não encontrada</h1></div></AdminShell>;
  if (err && err.status !== 401) return <AdminShell><ErrorState error={err} retry={session.refetch} /></AdminShell>;
  if (!session.data) return <AdminShell><AdminLogin /></AdminShell>;
  return <AdminPanel />;
}

function AdminShell({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) {
  return (
    <div className="adm">
      <header className="adm-top">
        <span className="adm-brand">RIDERSYNC</span>
        <span className="adm-sub">Administração</span>
        {onLogout && (
          <button type="button" className="btn sm ghost adm-out" onClick={onLogout}>
            Sair
          </button>
        )}
      </header>
      <main className="adm-main">{children}</main>
    </div>
  );
}

function AdminLogin() {
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/login', { username, password });
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="box form adm-login" onSubmit={submit} aria-label="Entrar no painel de administração">
      <h1>Entrar</h1>
      <FormError message={error} />
      <TextField label="Usuário" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <PasswordField label="Senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn cue" type="submit" disabled={busy || !username || !password}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

function AdminPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(SECTIONS[0].id);
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<Record<string, number>>('/admin/overview') });
  const logout = async () => {
    await api.post('/admin/logout').catch(() => undefined);
    // Volta tudo do painel ao estado inicial: a sessão é consultada de novo (401) e a tela de login aparece.
    await qc.resetQueries({ queryKey: ['admin'] });
  };
  const o = overview.data;
  const section = SECTIONS.find((x) => x.id === tab)!;
  return (
    <AdminShell onLogout={logout}>
      <p className="adm-warn" role="note">
        Exclusões são <strong>definitivas</strong> e afetam o banco compartilhado (produção e staging). Use para limpar dados de teste.
      </p>
      {o && (
        <dl className="adm-kpis" aria-label="Totais">
          {[
            ['Contas', o.users],
            ['Artistas solo', o.solo],
            ['Bandas', o.bands],
            ['Casas', o.venues],
            ['Contratantes PF', o.individuals],
            ['Eventos', o.events],
            ['Negociações', o.bookings],
            ['Contratos', o.contracts],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="tabs" role="tablist" aria-label="Dados">
        {SECTIONS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <AdminTable key={section.id} section={section} />
    </AdminShell>
  );
}

function AdminTable({ section }: { section: Section }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Row[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const list = useQuery({
    queryKey: ['admin', section.id, debounced],
    queryFn: () => api.get<Row[]>(`${section.endpoint}${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`),
  });
  const rows = useMemo(() => list.data ?? [], [list.data]);
  const remove = useMutation({
    mutationFn: async (targets: Row[]) => {
      const failed: string[] = [];
      for (const r of targets) {
        try {
          await api.delete(`${section.endpoint}/${r.id}`);
        } catch (e) {
          // Já apagado por uma exclusão anterior em cascata: não é erro.
          if (!(e instanceof ApiError && e.status === 404)) failed.push(section.title(r));
        }
      }
      return { done: targets.length - failed.length, failed };
    },
    onSuccess: async ({ done, failed }) => {
      setConfirm(null);
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ['admin'] });
      if (failed.length) toast(`Excluídos: ${done}. Falharam: ${failed.join(', ')}`, 'error');
      else toast(done === 1 ? 'Excluído.' : `${done} itens excluídos.`);
    },
  });
  const toggle = (id: string) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <section className="box adm-sec" aria-label={section.label}>
      <div className="adm-bar">
        <input className="input" type="search" placeholder={`Buscar em ${section.label.toLowerCase()}…`} aria-label={`Buscar em ${section.label}`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn sm danger" disabled={selected.size === 0} onClick={() => setConfirm(rows.filter((r) => selected.has(r.id)))}>
          Excluir selecionados ({selected.size})
        </button>
      </div>
      {list.isLoading && <Loading />}
      {list.error && <ErrorState error={list.error} retry={list.refetch} />}
      {list.data && rows.length === 0 && <p className="hint">Nada encontrado.</p>}
      {rows.length > 0 && (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Selecionar todos" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))} />
                </th>
                {section.cols.map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? 'on' : ''}>
                  <td>
                    <input type="checkbox" aria-label={`Selecionar ${section.title(r)}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  {section.cols.map((c) => (
                    <td key={c.label}>{c.render(r)}</td>
                  ))}
                  <td>
                    <button type="button" className="btn sm danger" onClick={() => setConfirm([r])}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Mostrando até 50 itens, do mais recente ao mais antigo. Use a busca para encontrar outros.</p>
        </div>
      )}
      <Dialog open={!!confirm} onClose={() => !remove.isPending && setConfirm(null)} title={confirm?.length === 1 ? `Excluir ${section.noun}?` : `Excluir ${confirm?.length ?? 0} itens?`}>
        {confirm && (
          <div className="stack-sm">
            <ul className="adm-list">
              {confirm.slice(0, 8).map((r) => (
                <li key={r.id}>{section.title(r)}</li>
              ))}
              {confirm.length > 8 && <li>… e mais {confirm.length - 8}</li>}
            </ul>
            <p>{section.consequence}</p>
            <p className="adm-warn">Esta ação não pode ser desfeita.</p>
            <div className="actions">
              <button type="button" className="btn ghost" disabled={remove.isPending} onClick={() => setConfirm(null)}>
                Cancelar
              </button>
              <button type="button" className="btn danger" disabled={remove.isPending} onClick={() => remove.mutate(confirm)}>
                {remove.isPending ? 'Excluindo…' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
