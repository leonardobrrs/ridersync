import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ConfirmButton } from '../../components/Dialog';
import { PageHead } from '../../components/Layout';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { APPLICATION_STATUS, BOOKING_STATUS, dateTime } from '../../lib/format';
import type { MyApplication } from '../../lib/types';

export function MyApplicationsPage() {
  const q = useQuery({ queryKey: ['my-applications'], queryFn: () => api.get<MyApplication[]>('/me/applications') });
  const qc = useQueryClient();
  const toast = useToast();
  const withdraw = async (id: string) => {
    try {
      await api.post(`/applications/${id}/withdraw`);
      await qc.invalidateQueries({ queryKey: ['my-applications'] });
      toast('Candidatura retirada.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <>
      <PageHead
        title="Candidaturas"
        subtitle="Acompanhe as candidaturas do seu perfil e das bandas que você administra. Seleção não é contratação."
        actions={
          <Link className="btn cue" to="/oportunidades">
            Ver oportunidades
          </Link>
        }
      />
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data?.length === 0 && <Empty title="Nenhuma candidatura enviada">Encontre oportunidades de apresentação abertas e candidate-se.</Empty>}
      <div className="stack-sm">
        {q.data?.map((a) => (
          <article className="card" key={a.id}>
            <div className="row between">
              <h3>
                <Link className="link" to={`/oportunidades/${a.event.id}`}>
                  {a.event.title}
                </Link>
              </h3>
              <Status value={a.status} map={APPLICATION_STATUS} />
            </div>
            <div className="meta">
              <span>Como: {a.artist.name}</span>
              <span>Casa: {a.event.organizer.name}</span>
              <span>Apresentação: {dateTime(a.event.startsAt)}</span>
              <span>Enviada {dateTime(a.createdAt)}</span>
              {a.decidedAt && <span>Decisão {dateTime(a.decidedAt)}</span>}
            </div>
            {a.decisionNote && <p className="hint">Nota da casa: {a.decisionNote}</p>}
            <div className="row">
              {a.status === 'ACCEPTED' && !a.booking && <span className="hint">Selecionada! Aguarde a casa iniciar a negociação.</span>}
              {a.booking && (
                <Link className="btn sm" to={`/painel/negociacoes/${a.booking.id}`}>
                  Negociação · <Status value={a.booking.status} map={BOOKING_STATUS} />
                </Link>
              )}
              {(a.status === 'PENDING' || a.status === 'ACCEPTED') && !a.booking && (
                <ConfirmButton className="btn sm ghost danger" confirm="Retirar esta candidatura?" onConfirm={() => withdraw(a.id)}>
                  Retirar candidatura
                </ConfirmButton>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
