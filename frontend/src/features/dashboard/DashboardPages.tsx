import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PageHead, PanelLinks } from '../../components/Layout';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { BOOKING_STATUS, dateTime, dayMonth, duration, money, ROLE_LABEL } from '../../lib/format';
import { useMe } from '../../lib/hooks';
import type { Dashboard, Invitations, Schedule, ScheduleItem } from '../../lib/types';

function ScheduleList({ items, empty }: { items: ScheduleItem[]; empty: string }) {
  if (items.length === 0) return <p className="hint">{empty}</p>;
  return (
    <ul className="dates">
      {items.map((i) => {
        const d = dayMonth(i.performanceAt);
        return (
          <li key={i.id}>
            <span className="dt">
              <b>{d.day}</b>
              <small>{d.month}</small>
            </span>
            <span>
              <Link className="link" to={`/painel/negociacoes/${i.id}`}>
                {i.artist.name} @ {i.organization.name}
              </Link>
              <small className="hint" style={{ display: 'block' }}>
                {dateTime(i.performanceAt)} · {duration(i.durationMinutes)} · {money(i.feeCents)} · contratação confirmada
              </small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardPage() {
  const { data: me } = useMe();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/me/dashboard') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const d = q.data!;
  return (
    <>
      <PageHead title={`Olá, ${me?.user.name.split(' ')[0] ?? ''}`} subtitle="Seu ponto de partida: pendências e próximos compromissos." />
      {!d.hasMusicianProfile && !d.managesBands && !d.managesVenues && (
        <div className="hero">
          <div>
            <h2>Monte seu perfil profissional</h2>
            <p>Músico? Crie seu perfil individual. Tem banda ou casa de show? Cadastre também.</p>
          </div>
          <div className="promo-acts">
            <Link className="btn cue" to="/painel/perfil">
              Criar perfil
            </Link>
            <Link className="btn" to="/painel/bandas">
              Criar banda
            </Link>
            <Link className="btn" to="/painel/casas">
              Cadastrar casa
            </Link>
          </div>
        </div>
      )}
      <div className="kpis">
        <Link className={`kpi ${d.awaitingMe.length ? 'hot' : ''}`} to="/painel/negociacoes">
          <b>{d.awaitingMe.length}</b>
          <span>propostas aguardando você</span>
        </Link>
        <Link className={`kpi ${d.invitations ? 'hot' : ''}`} to="/painel/convites">
          <b>{d.invitations}</b>
          <span>convites pendentes</span>
        </Link>
        <Link className="kpi" to="/painel/candidaturas">
          <b>{d.myPendingApplications}</b>
          <span>candidaturas em análise</span>
        </Link>
        {d.managesVenues && (
          <Link className={`kpi ${d.applicationsToReview.length ? 'hot' : ''}`} to="/painel/casas">
            <b>{d.applicationsToReview.length}</b>
            <span>candidaturas para avaliar</span>
          </Link>
        )}
        <Link className="kpi" to="/painel/negociacoes">
          <b>{d.activeNegotiations}</b>
          <span>negociações ativas</span>
        </Link>
      </div>

      {d.awaitingMe.length > 0 && (
        <section className="box">
          <h2 className="lbl">Aguardando sua ação</h2>
          <ul className="list-plain">
            {d.awaitingMe.map((b) => (
              <li key={b.id} className="row between">
                <Link className="link" to={`/painel/negociacoes/${b.id}`}>
                  {b.title}
                </Link>
                <Status value={b.status} map={BOOKING_STATUS} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {d.applicationsToReview.length > 0 && (
        <section className="box">
          <h2 className="lbl">Candidaturas recebidas para avaliar</h2>
          <ul className="list-plain">
            {d.applicationsToReview.map((a) => (
              <li key={a.id}>
                <Link className="link" to={`/painel/eventos/${a.event.id}`}>
                  {a.artist.name} → {a.event.title}
                </Link>{' '}
                <span className="hint">{dateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="row2">
        <section className="box">
          <div className="row between">
            <h2 className="lbl">Próximas apresentações confirmadas</h2>
            <Link className="link" to="/painel/agenda">
              Ver todas
            </Link>
          </div>
          <ScheduleList items={d.upcoming} empty="Nenhuma contratação confirmada por enquanto." />
        </section>
        {d.profileCompleteness && (
          <section className="box">
            <div className="row between">
              <h2 className="lbl">Seu perfil</h2>
              <span className="row" style={{ gap: 8 }}>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${d.profileCompleteness.percent}%` }} />
                </span>
                <b>{d.profileCompleteness.percent}%</b>
              </span>
            </div>
            <ul className="list-plain">
              {d.profileCompleteness.checks.map((c) => (
                <li key={c.label} className="row" style={{ gap: 8 }}>
                  <span className={`st ${c.done ? 'ok' : 'draft'}`}>{c.done ? 'Feito' : 'Pendente'}</span>
                  {c.label}
                </li>
              ))}
            </ul>
            <Link className="btn sm" to="/painel/perfil">
              Editar perfil
            </Link>
          </section>
        )}
      </div>
    </>
  );
}

export function InvitationsPage() {
  const q = useQuery({ queryKey: ['invitations'], queryFn: () => api.get<Invitations>('/me/invitations') });
  const qc = useQueryClient();
  const toast = useToast();
  const respond = async (kind: 'band' | 'organization', id: string, accept: boolean) => {
    try {
      await api.post(`/me/invitations/${kind}/${id}/${accept ? 'accept' : 'decline'}`);
      await Promise.all(['invitations', 'me', 'bands', 'orgs', 'dashboard'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast(accept ? 'Convite aceito.' : 'Convite recusado.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <>
      <PageHead title="Convites" subtitle="Convites de bandas e casas de show. O vínculo só é ativado quando você aceita." />
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data && q.data.bands.length + q.data.organizations.length === 0 && <Empty title="Nenhum convite pendente" />}
      <div className="stack-sm">
        {q.data?.bands.map((i) => (
          <article className="card" key={i.id}>
            <h3>Banda: {i.bandName}</h3>
            <div className="meta">
              <span>Papel: {ROLE_LABEL[i.role]}</span>
              {i.instrument && <span>Função: {i.instrument}</span>}
              {i.invitedBy && <span>Convidado por {i.invitedBy}</span>}
              <span>{dateTime(i.invitedAt)}</span>
            </div>
            <div className="row">
              <button className="btn sm cue" type="button" onClick={() => respond('band', i.id, true)}>
                Aceitar
              </button>
              <button className="btn sm" type="button" onClick={() => respond('band', i.id, false)}>
                Recusar
              </button>
            </div>
          </article>
        ))}
        {q.data?.organizations.map((i) => (
          <article className="card" key={i.id}>
            <h3>Casa de show: {i.organizationName}</h3>
            <div className="meta">
              <span>Papel: {ROLE_LABEL[i.role]}</span>
              {i.invitedBy && <span>Convidado por {i.invitedBy}</span>}
              <span>{i.city}</span>
            </div>
            <div className="row">
              <button className="btn sm cue" type="button" onClick={() => respond('organization', i.id, true)}>
                Aceitar
              </button>
              <button className="btn sm" type="button" onClick={() => respond('organization', i.id, false)}>
                Recusar
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function SchedulePage() {
  const q = useQuery({ queryKey: ['schedule'], queryFn: () => api.get<Schedule>('/me/schedule') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const s = q.data!;
  return (
    <>
      <PageHead title="Apresentações" subtitle="Contratações confirmadas e histórico de apresentações realizadas. Pagamentos não são controlados pela plataforma." />
      <section className="box">
        <h2 className="lbl">Próximas (contratação confirmada)</h2>
        <ScheduleList items={s.upcoming} empty="Nenhuma apresentação futura confirmada." />
      </section>
      {s.awaitingRegistration.length > 0 && (
        <section className="box">
          <h2 className="lbl">Data passada — registrar como realizada</h2>
          <ScheduleList items={s.awaitingRegistration} empty="" />
        </section>
      )}
      <section className="box">
        <h2 className="lbl">Histórico de apresentações realizadas</h2>
        {s.history.length === 0 ? (
          <p className="hint">Nenhuma apresentação registrada como realizada.</p>
        ) : (
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Artista</th>
                  <th>Casa</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {s.history.map((h) => (
                  <tr key={h.id}>
                    <td>{dateTime(h.performedAt)}</td>
                    <td>
                      <Link className="link" to={`/artistas/${h.artist.slug}`}>
                        {h.artist.name}
                      </Link>
                    </td>
                    <td>{h.organization.name}</td>
                    <td>{h.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** Menu completo do painel para celular (a barra inferior mostra só atalhos). */
export function PanelMenuPage() {
  return (
    <>
      <PageHead title="Menu" />
      <nav className="pnav" style={{ display: 'grid', position: 'static' }} aria-label="Painel">
        <PanelLinks />
      </nav>
    </>
  );
}
