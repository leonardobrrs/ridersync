import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAction } from '../../lib/hooks';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import type { BookingDetail, ContractReadiness, ContractSummary } from '../../lib/types';

/** O contrato ainda pode ser refeito com os dados atuais: confirmada e antes da apresentação. */
export function canRefreshContract(b: BookingDetail, now = Date.now()) {
  return b.status === 'CONFIRMED' && !b.performance && !!b.agreedOffer && new Date(b.agreedOffer.performanceAt).getTime() > now;
}

/**
 * Dados cadastrais que faltam para o contrato sair completo (CPF, CNPJ, nome civil...). Aparece antes de confirmar e
 * depois, enquanto o contrato ainda pode ser atualizado. Só mostra o link de correção para o meu lado.
 */
export function ContractReadinessNotice({ b }: { b: BookingDetail }) {
  const enabled = !!b.mySide && (b.status === 'AGREED' || canRefreshContract(b));
  const q = useQuery({
    queryKey: ['contract-readiness', b.id],
    queryFn: () => api.get<ContractReadiness>(`/contracts/booking/${b.id}/readiness`),
    enabled,
  });
  if (!enabled || !q.data) return null;
  const mine = b.mySide === 'ARTIST' ? q.data.artist : q.data.contractor;
  const other = b.mySide === 'ARTIST' ? q.data.contractor : q.data.artist;
  if (mine.missing.length === 0 && other.missing.length === 0) return null;
  return (
    <div className="notice contract-ready" role="status">
      <div>
        {mine.missing.length > 0 && (
          <p style={{ margin: 0 }}>
            Faltam seus dados para o contrato: {mine.missing.join(', ')}.{' '}
            <Link className="link" to={mine.link}>
              Completar dados
            </Link>
          </p>
        )}
        {other.missing.length > 0 && (
          <p style={{ margin: mine.missing.length ? '6px 0 0' : 0 }}>A outra parte ainda não informou: {other.missing.join(', ')}.</p>
        )}
        <p className="hint" style={{ margin: '6px 0 0' }}>
          O que faltar sai como “[A PREENCHER]”. Depois de completar, atualize o contrato — possível até a data do show.
        </p>
      </div>
    </div>
  );
}

/**
 * Contrato da contratação confirmada. Gerado automaticamente na confirmação; se a geração falhou (ou a
 * contratação é anterior ao módulo), qualquer das partes pode gerá-lo aqui. O download exige a sessão e só
 * funciona para as duas partes da negociação.
 */
export function ContractCard({ b }: { b: BookingDetail }) {
  const invalidate = [['booking', b.id], ['contract-readiness', b.id]];
  const generate = useAction(() => api.post<ContractSummary>(`/contracts/booking/${b.id}`), { success: 'Contrato gerado.', invalidate });
  const refresh = useAction(() => api.post<ContractSummary>(`/contracts/booking/${b.id}/refresh`), {
    success: 'Contrato atualizado com os dados atuais.',
    invalidate,
  });
  if (b.status !== 'CONFIRMED' || !b.mySide) return null;
  const c = b.contract;
  const refreshable = canRefreshContract(b);
  return (
    <section className="box" aria-label="Contrato">
      <h2 className="lbl">Contrato</h2>
      {c ? (
        <div className="stack-sm">
          <p>
            Contrato de prestação de serviços artísticos {c.templateType === 'VENUE' ? 'com casa de show' : 'para evento particular'}, gerado em {dateTime(c.generatedAt)}. Ambas as partes
            têm acesso ao mesmo documento.
          </p>
          {c.pendingFields > 0 && (
            <p className="inline-msg info" style={{ margin: 0 }}>
              {c.pendingFields === 1 ? '1 campo ainda está' : `${c.pendingFields} campos ainda estão`} como “[A PREENCHER]”. Dados cadastrais entram ao
              atualizar o contrato; condições que não constaram na proposta (sinal, prazos, forma de pagamento) são completadas à mão antes de assinar.
            </p>
          )}
          <ContractReadinessNotice b={b} />
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <a className="btn cue" href={c.downloadUrl} download={`contrato-${b.id}.pdf`}>
              Baixar contrato (PDF)
            </a>
            {refreshable && (
              <button type="button" className="btn" disabled={refresh.isPending} onClick={() => refresh.mutate(undefined)}>
                {refresh.isPending ? 'Atualizando…' : 'Atualizar contrato'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="stack-sm">
          <p>O contrato ainda não foi gerado para esta contratação.</p>
          <ContractReadinessNotice b={b} />
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn cue" disabled={generate.isPending} onClick={() => generate.mutate(undefined)}>
              {generate.isPending ? 'Gerando…' : 'Gerar contrato'}
            </button>
          </div>
        </div>
      )}
      <p className="hint">
        Modelo gerado automaticamente a partir dos termos aceitos e dos dados cadastrados — confira os dados e os campos “[A PREENCHER]” antes de assinar.
        {refreshable && ' Se alguém completar os dados, use “Atualizar contrato” (até a data do show).'} Não há assinatura eletrônica nem validade jurídica garantida, e o
        pagamento é combinado fora da plataforma. Seus dados para contrato ficam em{' '}
        <Link className="link" to="/painel/conta">
          Conta e privacidade
        </Link>
        .
      </p>
    </section>
  );
}
