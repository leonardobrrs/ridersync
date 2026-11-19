import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { useMe } from '../lib/hooks';
import { useDismiss } from '../lib/useDismiss';
import type { AccountType, Me } from '../lib/types';
import { AccountGate } from './AccountGate';
import { ExploreSheet } from './ExploreSheet';
import { Icon } from './Icon';
import { NotificationBell } from './NotificationBell';
import { Avatar } from './Poster';
import { Loading } from './States';
import { useToast } from './Toast';

function UserMenu({ me }: { me: Me }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  // Menu aberto apenas na rota em que foi aberto (fecha ao navegar), ao clicar/tocar fora e com Esc.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === location.pathname;
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setMenuPath(null), []);
  useDismiss(open, box, close, trigger);
  const venues = me.organizations.filter((o) => o.type === 'VENUE');
  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    qc.clear();
    await qc.invalidateQueries({ queryKey: ['me'] });
    toast('Você saiu da sua conta.');
    navigate('/');
  };
  const isArtist = me.user.accountType === 'ARTIST';
  return (
    <div style={{ position: 'relative' }} ref={box}>
      <button ref={trigger} type="button" className="hlink" aria-haspopup="menu" aria-expanded={open} onClick={() => setMenuPath(open ? null : location.pathname)}>
        <Avatar name={me.user.name} photoUrl={me.user.profilePhotoUrl} size={28} />
        <span className="t">{me.user.name.split(' ')[0]}</span>
        {me.pendingInvitations > 0 && <span className="n">{me.pendingInvitations}</span>}
      </button>
      {open && (
        <div className="menu" role="menu" style={{ top: 48, right: 0 }}>
          <span className="menu-who">
            <strong>{me.user.name}</strong>
            <small>{isArtist ? 'Conta de artista' : me.user.accountType === 'CONTRACTOR' ? 'Conta de contratante' : 'Tipo de conta pendente'}</small>
          </span>
          <hr />
          {isArtist && (
            <>
              <Link role="menuitem" to="/painel/perfil">
                <Icon name="user" size={16} /> Meu perfil
              </Link>
              <Link role="menuitem" to="/painel/bandas">
                <Icon name="users" size={16} /> Minhas bandas
              </Link>
            </>
          )}
          {me.user.accountType === 'CONTRACTOR' && (
            <>
              {venues.map((v) => (
                <Link key={v.id} role="menuitem" to={`/painel/casas/${v.id}`} className="menu-venue">
                  <Icon name="venue" size={16} />
                  <span>
                    {v.name}
                    <small>Minha casa de show</small>
                  </span>
                </Link>
              ))}
              {venues.length === 0 && (
                <Link role="menuitem" to="/painel/casas">
                  <Icon name="venue" size={16} /> Cadastrar casa de show
                </Link>
              )}
              <Link role="menuitem" to="/painel/eventos">
                <Icon name="calendar" size={16} /> Eventos particulares
              </Link>
            </>
          )}
          <hr />
          <Link role="menuitem" to="/painel">
            Painel
          </Link>
          <Link role="menuitem" to="/painel/negociacoes">
            Negociações
          </Link>
          <Link role="menuitem" to="/painel/notificacoes">
            Notificações
          </Link>
          <Link role="menuitem" to="/painel/conta">
            Conta e privacidade
          </Link>
          <hr />
          <button role="menuitem" type="button" onClick={logout}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const [q, setQ] = useState(location.pathname === '/' ? (params.get('q') ?? '') : '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/?q=${encodeURIComponent(term)}` : '/');
  };

  return (
    <header className="hdr">
      <div className="wrap">
        <Link to="/" className="logo" aria-label="RiderSync — início">
          RIDERSYNC
        </Link>
        <form className="hs hdr-search" role="search" onSubmit={submit}>
          <label htmlFor="hq" className="sr-only">
            Buscar músicos, bandas e casas de show
          </label>
          <input id="hq" type="search" placeholder="Buscar músico, banda ou casa de show" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" aria-label="Buscar">
            <Icon name="search" />
          </button>
        </form>
        <nav className="hact" aria-label="Principal">
          <NavLink to="/" end className="hlink hide-m">
            <span className="t">Início</span>
          </NavLink>
          {/* Oportunidades são vagas para artistas: contratantes não as veem no menu principal. */}
          {me?.user.accountType !== 'CONTRACTOR' && (
            <NavLink to="/oportunidades" className="hlink hide-m">
              <span className="t">Oportunidades</span>
            </NavLink>
          )}
          <NavLink to="/casas" className="hlink hide-m">
            <span className="t">Casas de show</span>
          </NavLink>
          {me ? (
            <>
              <NotificationBell />
              <UserMenu me={me} />
            </>
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
          <nav className="foot-links" aria-label="Institucional">
            <Link className="link" to="/ajuda">
              Documentação
            </Link>
            <Link className="link" to="/privacidade">
              Privacidade
            </Link>
            <Link className="link" to="/termos">
              Termos de uso
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

/** Botão "Explorar" da barra inferior: abre as categorias da página inicial (no lugar da barra do topo no celular). */
function ExploreTab({ accountType }: { accountType: AccountType | null }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const active = pathname === "/";
  return (
    <>
      <button type="button" className={`tab-btn${active ? " active" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="search" />
        Explorar
      </button>
      <ExploreSheet open={open} onClose={close} accountType={accountType} />
    </>
  );
}

/** Barra inferior no celular (públicos e painel). */
function MobileTabbar() {
  const { data: me } = useMe();
  const { pathname } = useLocation();
  if (!me) {
    return (
      <nav className="tabbar" aria-label="Atalhos">
        <ExploreTab accountType={null} />
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
  const contractor = me.user.accountType === 'CONTRACTOR';
  const venues = me.organizations.filter((o) => o.type === 'VENUE');
  const venueLink = venues.length === 1 ? `/painel/casas/${venues[0].id}` : '/painel/casas';
  const inVenue = contractor && pathname.startsWith('/painel/casas');
  const inPanel = pathname.startsWith('/painel') && !inVenue && !/^\/painel\/(negociacoes|menu)(\/|$)/.test(pathname);
  return (
    <nav className="tabbar" aria-label="Atalhos">
      <ExploreTab accountType={me.user.accountType} />
      {contractor ? (
        <Link to={venueLink} aria-current={inVenue ? 'page' : undefined} className={inVenue ? 'active' : undefined}>
          <Icon name="venue" />
          {venues.length === 1 ? 'Minha casa' : 'Casas'}
        </Link>
      ) : (
        <NavLink to="/oportunidades">
          <Icon name="ticket" />
          Vagas
        </NavLink>
      )}
      {/* "Painel" fica ativo em todas as subpáginas do painel que não têm atalho próprio (agenda, perfil, eventos…). */}
      <Link to="/painel" aria-current={inPanel ? 'page' : undefined} className={inPanel ? 'active' : undefined}>
        <Icon name="grid" />
        Painel
      </Link>
      <NavLink to="/painel/negociacoes">
        <Icon name="chat" />
        Propostas
      </NavLink>
      <NavLink to="/painel/menu">
        <Icon name="list" />
        Menu
        {me.pendingInvitations + me.unreadNotifications > 0 && <i className="badge">{me.pendingInvitations + me.unreadNotifications}</i>}
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

/** Restringe a página ao tipo de conta (a autorização real continua no servidor). */
export function RequireAccountType({ type, children }: { type: AccountType; children: ReactNode }) {
  const { data: me } = useMe();
  if (me && me.user.accountType !== type) {
    return (
      <div className="empty" role="alert">
        <strong>Área exclusiva de contas de {type === 'ARTIST' ? 'artista/banda' : 'contratante/casa de show'}</strong>
        <span>Artistas e contratantes usam contas separadas no RiderSync.</span>
        <Link className="btn sm" to="/painel">
          Voltar ao painel
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

type PanelLink = { to: string; label: string; icon: string; end?: boolean; badge?: 'inv' | 'notif'; only?: AccountType };

const PANEL_LINKS: PanelLink[] = [
  { to: '/painel', label: 'Visão geral', icon: 'home', end: true },
  { to: '/painel/notificacoes', label: 'Notificações', icon: 'bell', badge: 'notif' },
  { to: '/painel/convites', label: 'Convites', icon: 'mail', badge: 'inv' },
  { to: '/painel/perfil', label: 'Meu perfil', icon: 'user', only: 'ARTIST' },
  { to: '/painel/bandas', label: 'Minhas bandas', icon: 'users', only: 'ARTIST' },
  { to: '/painel/candidaturas', label: 'Candidaturas', icon: 'ticket', only: 'ARTIST' },
  { to: '/painel/casas', label: 'Casas de show', icon: 'venue', only: 'CONTRACTOR' },
  { to: '/painel/eventos', label: 'Eventos particulares', icon: 'calendar', only: 'CONTRACTOR' },
  { to: '/painel/negociacoes', label: 'Negociações', icon: 'chat' },
  { to: '/painel/agenda', label: 'Agenda', icon: 'calendar' },
  { to: '/painel/comparar', label: 'Comparar rider', icon: 'compare', only: 'ARTIST' },
  { to: '/painel/conta', label: 'Conta e privacidade', icon: 'gear' },
];

export function PanelLinks() {
  const { data: me } = useMe();
  const type = me?.user.accountType;
  return (
    <>
      {PANEL_LINKS.filter((l) => !l.only || l.only === type).map((l) => {
        const n = l.badge === 'inv' ? (me?.pendingInvitations ?? 0) : l.badge === 'notif' ? (me?.unreadNotifications ?? 0) : 0;
        return (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <Icon name={l.icon} size={18} />
            {l.label}
            {n > 0 && <span className="n">{n}</span>}
          </NavLink>
        );
      })}
    </>
  );
}

export function PanelLayout() {
  return (
    <RequireAuth>
      <AccountGate />
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
