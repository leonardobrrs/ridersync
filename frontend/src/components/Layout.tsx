import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useMe } from '../lib/hooks';
import { Icon } from './Icon';
import { Loading } from './States';
import { useToast } from './Toast';

function Header() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const [q, setQ] = useState(location.pathname === '/' ? (params.get('q') ?? '') : '');
  // Menu aberto apenas na rota em que foi aberto (fecha ao navegar).
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menu = menuPath === location.pathname;
  const qc = useQueryClient();
  const toast = useToast();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };
  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    qc.clear();
    await qc.invalidateQueries({ queryKey: ['me'] });
    toast('Você saiu da sua conta.');
    navigate('/');
  };

  return (
    <header className="hdr">
      <div className="wrap">
        <Link to="/" className="logo" aria-label="RiderSync — início">
          RIDERSYNC
        </Link>
        <form className="hs hdr-search" role="search" onSubmit={submit}>
          <label htmlFor="hq" className="sr-only">
            Buscar músicos e bandas
          </label>
          <input id="hq" type="search" placeholder="Buscar músicos, bandas, estilos…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" aria-label="Buscar">
            <Icon name="search" />
          </button>
        </form>
        <nav className="hact" aria-label="Principal">
          <NavLink to="/" end className="hlink hide-m">
            <span className="t">Artistas</span>
          </NavLink>
          <NavLink to="/oportunidades" className="hlink hide-m">
            <span className="t">Oportunidades</span>
          </NavLink>
          <NavLink to="/casas" className="hlink hide-m">
            <span className="t">Casas</span>
          </NavLink>
          {me ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="hlink"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenuPath(menu ? null : location.pathname)}
              >
                <Icon name="user" />
                <span className="t">{me.user.name.split(' ')[0]}</span>
                {me.pendingInvitations > 0 && <span className="n">{me.pendingInvitations}</span>}
              </button>
              {menu && (
                <div className="menu" role="menu" style={{ top: 48, right: 0 }}>
                  <Link role="menuitem" to="/painel">
                    Painel
                  </Link>
                  <Link role="menuitem" to="/painel/perfil">
                    Meu perfil
                  </Link>
                  <Link role="menuitem" to="/painel/negociacoes">
                    Negociações
                  </Link>
                  <Link role="menuitem" to="/painel/conta">
                    Conta
                  </Link>
                  <hr />
                  <button role="menuitem" type="button" onClick={logout}>
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/entrar" className="hlink">
                Entrar
              </Link>
              <Link to="/cadastro" className="btn cue sm">
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteLayout() {
  return (
    <>
      <a className="skip" href="#main">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <MobileTabbar />
      <footer className="foot">
        <div className="wrap">
          <span>RiderSync · profissionalização artística em Alagoas · a plataforma não intermedeia pagamentos</span>
          <a className="link" href="/api/docs">
            API
          </a>
        </div>
      </footer>
    </>
  );
}

/** Barra inferior no celular (públicos e painel). */
function MobileTabbar() {
  const { data: me } = useMe();
  if (!me) {
    return (
      <nav className="tabbar" aria-label="Atalhos">
        <NavLink to="/" end>
          <Icon name="music" />
          Artistas
        </NavLink>
        <NavLink to="/oportunidades">
          <Icon name="ticket" />
          Vagas
        </NavLink>
        <NavLink to="/casas">
          <Icon name="venue" />
          Casas
        </NavLink>
        <NavLink to="/entrar">
          <Icon name="user" />
          Entrar
        </NavLink>
      </nav>
    );
  }
  return (
    <nav className="tabbar" aria-label="Atalhos">
      <NavLink to="/" end>
        <Icon name="music" />
        Artistas
      </NavLink>
      <NavLink to="/oportunidades">
        <Icon name="ticket" />
        Vagas
      </NavLink>
      <NavLink to="/painel" end>
        <Icon name="home" />
        Painel
      </NavLink>
      <NavLink to="/painel/negociacoes">
        <Icon name="chat" />
        Propostas
      </NavLink>
      <NavLink to="/painel/menu">
        <Icon name="list" />
        Menu
        {me.pendingInvitations > 0 && <i className="badge">{me.pendingInvitations}</i>}
      </NavLink>
    </nav>
  );
}

/** Exige sessão. Visitante é levado ao login e volta para onde estava. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <Loading />;
  if (!me) return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

const PANEL_LINKS: { to: string; label: string; icon: string; end?: boolean; badge?: 'inv' }[] = [
  { to: '/painel', label: 'Visão geral', icon: 'home', end: true },
  { to: '/painel/convites', label: 'Convites', icon: 'mail', badge: 'inv' },
  { to: '/painel/perfil', label: 'Meu perfil', icon: 'user' },
  { to: '/painel/bandas', label: 'Minhas bandas', icon: 'users' },
  { to: '/painel/candidaturas', label: 'Candidaturas', icon: 'ticket' },
  { to: '/painel/negociacoes', label: 'Negociações', icon: 'chat' },
  { to: '/painel/agenda', label: 'Apresentações', icon: 'calendar' },
  { to: '/painel/comparar', label: 'Comparar rider', icon: 'compare' },
  { to: '/painel/casas', label: 'Casas de show', icon: 'venue' },
  { to: '/painel/conta', label: 'Conta', icon: 'gear' },
];

export function PanelLinks() {
  const { data: me } = useMe();
  return (
    <>
      {PANEL_LINKS.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end}>
          <Icon name={l.icon} size={18} />
          {l.label}
          {l.badge === 'inv' && (me?.pendingInvitations ?? 0) > 0 && <span className="n">{me!.pendingInvitations}</span>}
        </NavLink>
      ))}
    </>
  );
}

export function PanelLayout() {
  return (
    <RequireAuth>
      <div className="wrap panel">
        <nav className="pnav" aria-label="Painel">
          <span className="lbl">Painel</span>
          <PanelLinks />
        </nav>
        <div className="stack" style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </RequireAuth>
  );
}

export function PageHead({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="pagehead">
      <div className="stack-sm">
        {back && (
          <Link to={back} className="link row" style={{ gap: 4 }}>
            <Icon name="arrowLeft" size={16} /> Voltar
          </Link>
        )}
        <h1 tabIndex={-1}>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
