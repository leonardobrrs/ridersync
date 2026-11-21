import { Link } from 'react-router';
import { useAction } from '../../lib/hooks';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import type { BookingDetail, ContractSummary } from '../../lib/types';

/**
 * Contrato da contratação confirmada. Gerado automaticamente na confirmação; se a geração falhou (ou a
 * contratação é anterior ao módulo), qualquer das partes pode gerá-lo aqui. O download exige a sessão e só
 * funciona para as duas partes da negociação.
 */
export function ContractCard({ b }: { b: BookingDetail }) {
  const generate = useAction(() => api.post<ContractSummary>(`/contracts/booking/${b.id}`), {
    success: 'Contrato gerado.',
    invalidate: [['booking', b.id]],
  });
  if (b.status !== 'CONFIRMED' || !b.mySide) return null;
  const c = b.contract;
  return (
    <section className="box" aria-label="Contrato">
      <h2 className="lbl">Contrato</h2>
      {c ? (
        <div className="stack-sm">
          <p>
            Contrato de prestação de serviços artísticos {c.templateType === 'VENUE' ? 'com casa de show' : 'para evento particular'}, gerado em {dateTime(c.generatedAt)}. Ambas as partes
            têm acesso ao mesmo documento.
          </p>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <a className="btn cue" href={c.downloadUrl} download={`contrato-${b.id}.pdf`}>
              Baixar contrato (PDF)
            </a>
          </div>
        </div>
      ) : (
        <div className="stack-sm">
          <p>O contrato ainda não foi gerado para esta contratação.</p>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn cue" disabled={generate.isPending} onClick={() => generate.mutate(undefined)}>
              {generate.isPending ? 'Gerando…' : 'Gerar contrato'}
            </button>
          </div>
        </div>
      )}
      <p className="hint">
        Modelo gerado automaticamente a partir dos termos aceitos e dos dados cadastrados — confira os dados e os campos “[A PREENCHER]” antes de assinar. Não há assinatura
        eletrônica nem validade jurídica garantida, e o pagamento é combinado fora da plataforma. Seus dados para contrato ficam em{' '}
        <Link className="link" to="/painel/conta">
          Conta e privacidade
        </Link>
        .
      </p>
    </section>
  );
}
