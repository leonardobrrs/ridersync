import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAction } from '../../lib/hooks';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import type { BookingDetail, ContractReadiness, ContractSummary } from '../../lib/types';

/** Show realizado: apresentação registrada ou data combinada já passou. A partir daí o contrato não muda mais. */
export function showHappenedAt(b: BookingDetail, now = Date.now()): string | null {
  if (b.performance) return b.performance.performedAt;
  if (b.agreedOffer && new Date(b.agreedOffer.performanceAt).getTime() <= now) return b.agreedOffer.performanceAt;
  return null;
}

/** O contrato pode ser refeito com os dados atuais enquanto a contratação estiver confirmada e o show não aconteceu. */
export function canRefreshContract(b: BookingDetail, now = Date.now()) {
  return b.status === 'CONFIRMED' && !showHappenedAt(b, now);
}

/** Dados cadastrais que faltam em cada lado (e onde completá-los). Mesma consulta para o aviso e para o botão. */
function useReadiness(b: BookingDetail) {
  const enabled = !!b.mySide && (b.status === 'AGREED' || canRefreshContract(b));
  return useQuery({
    queryKey: ['contract-readiness', b.id],
    queryFn: () => api.get<ContractReadiness>(`/contracts/booking/${b.id}/readiness`),
    enabled,
  });
}

const mineOf = (b: BookingDetail, r: ContractReadiness) => (b.mySide === 'ARTIST' ? r.artist : r.contractor);
const otherOf = (b: BookingDetail, r: ContractReadiness) => (b.mySide === 'ARTIST' ? r.contractor : r.artist);

/**
 * Aviso de dados que faltam para o contrato sair completo (CPF, CNPJ, nome civil...). Aparece antes de confirmar e
 * depois, enquanto o contrato pode ser atualizado. O link de correção é só do meu lado.
 */
export function ContractReadinessNotice({ b }: { b: BookingDetail }) {
  const q = useReadiness(b);
  if (!q.data) return null;
  const mine = mineOf(b, q.data);
  const other = otherOf(b, q.data);
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
          O que faltar sai como “[A PREENCHER]”. Depois que os dados forem completados, qualquer das partes atualiza o contrato.
        </p>
      </div>
    </div>
  );
}

type PendingItem = ContractSummary['pendingItems'][number];

/** Itens com o mesmo responsável e a mesma instrução numa linha só. */
function groupByHow(items: PendingItem[]) {
  const groups = new Map<string, { labels: string[]; how: string }>();
  for (const i of items) {
    const g = groups.get(i.how) ?? { labels: [], how: i.how };
    g.labels.push(i.label);
    groups.set(i.how, g);
  }
  return [...groups.values()];
}

/**
 * O que falta preencher no contrato — só na tela (o PDF traz linhas em branco, sem instruções). Agrupado por quem
 * preenche: primeiro o que é com você, depois com a outra parte e por fim o que as duas partes combinam à mão.
 */
function PendingList({ b, items, count, locked, unlabeled = 0 }: { b: BookingDetail; items: PendingItem[]; count: number; locked: boolean; unlabeled?: number }) {
  const mine = b.mySide === 'ARTIST' ? 'CONTRATADO' : 'CONTRATANTE';
  const other = mine === 'CONTRATADO' ? 'CONTRATANTE' : 'CONTRATADO';
  const sections = [
    { who: mine, title: 'Com você' },
    { who: other, title: `Com a outra parte (${other === 'CONTRATADO' ? 'artista' : 'contratante'})` },
    { who: 'AMBAS', title: 'Com as duas partes' },
  ]
    .map((s) => ({ ...s, groups: groupByHow(items.filter((i) => i.who === s.who)) }))
    .filter((s) => s.groups.length > 0);
  return (
    <div className="pending-list" role="region" aria-label="O que falta preencher">
      <p className="pending-head">
        <strong>O que falta preencher</strong> — {count === 1 ? '1 campo sai' : `${count} campos saem`} em branco no PDF.
        {locked ? ' Com o show realizado, completem à mão antes de assinar.' : ''}
      </p>
      {unlabeled > 0 && (
        <p className="pending-legacy">
          {unlabeled === 1 ? '1 campo foi gerado' : `${unlabeled} campos foram gerados`} por uma versão anterior, que não identificava cada campo.{' '}
          {locked
            ? 'Como o show já foi realizado, confiram no PDF as linhas em branco e completem à mão antes de assinar.'
            : 'Clique em “Atualizar contrato” para gerar de novo: a lista abaixo passa a dizer o que é cada campo, quem preenche e como.'}
        </p>
      )}
      {sections.map((s) => (
        <div key={s.who} className="pending-sec">
          <h3>{s.title}</h3>
          <ul>
            {s.groups.map((g) => (
              <li key={g.how}>
                <strong>{g.labels.join(', ')}</strong>
                <span className="hint">{g.how}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Contrato da contratação confirmada, igual para as duas partes. Gerado automaticamente na confirmação; se a geração
 * falhou (ou a contratação é anterior ao módulo), qualquer das partes gera aqui. Ambas são notificadas (sino + e-mail)
 * quando o contrato é gerado ou atualizado. O download exige a sessão.
 */
export function ContractCard({ b }: { b: BookingDetail }) {
  const invalidate = [['booking', b.id], ['contract-readiness', b.id], ['notifications']];
  const generate = useAction(() => api.post<ContractSummary>(`/contracts/booking/${b.id}`), { success: 'Contrato gerado. As duas partes foram avisadas.', invalidate });
  const refresh = useAction(() => api.post<ContractSummary>(`/contracts/booking/${b.id}/refresh`), {
    success: 'Contrato atualizado com os dados atuais. As duas partes foram avisadas.',
    invalidate,
  });
  const readiness = useReadiness(b);
  if (b.status !== 'CONFIRMED' || !b.mySide) return null;
  const c = b.contract;
  const myDataLink = readiness.data ? mineOf(b, readiness.data).link : '/painel/conta';
  const happened = showHappenedAt(b);
  const myDataButton = happened ? null : (
    <Link className="btn" to={myDataLink}>
      Meus dados
    </Link>
  );
  return (
    <section className="box contract-card" aria-label="Contrato">
      <h2 className="lbl">Contrato</h2>
      {c ? (
        <>
          <p className="contract-status">
            {c.templateType === 'VENUE' ? 'Contrato com casa de show' : 'Contrato para evento particular'} · gerado em {dateTime(c.generatedAt)} · o mesmo documento para as duas
            partes.
          </p>
          {happened && (
            <p className="inline-msg ok" id={`locked-${b.id}`} style={{ margin: 0 }}>
              Show realizado em {dateTime(happened)}: o contrato não pode mais ser atualizado.
            </p>
          )}
          <div className="contract-actions">
            <a className="btn cue" href={c.downloadUrl} download={`contrato-${b.id}.pdf`}>
              Baixar PDF
            </a>
            {happened ? (
              <button type="button" className="btn" disabled aria-describedby={`locked-${b.id}`} title="Show realizado: o contrato não pode mais ser atualizado">
                Atualizar contrato
              </button>
            ) : (
              <button type="button" className="btn" disabled={refresh.isPending} onClick={() => refresh.mutate(undefined)}>
                {refresh.isPending ? 'Atualizando…' : 'Atualizar contrato'}
              </button>
            )}
            {myDataButton}
          </div>
          {c.pendingFields > 0 && (
            <PendingList b={b} items={c.pendingItems ?? []} count={c.pendingFields} locked={!!happened} unlabeled={c.unlabeledPending ?? 0} />
          )}
        </>
      ) : (
        <>
          <p className="contract-status">O contrato ainda não foi gerado para esta contratação.</p>
          <ContractReadinessNotice b={b} />
          <div className="contract-actions">
            <button type="button" className="btn cue" disabled={generate.isPending} onClick={() => generate.mutate(undefined)}>
              {generate.isPending ? 'Gerando…' : 'Gerar contrato'}
            </button>
            {myDataButton}
          </div>
        </>
      )}
      <p className="hint">
        Modelo gerado a partir dos termos aceitos e dos dados cadastrados: confira tudo antes de assinar. {happened ? '' : 'Se alguém completar os dados, use “Atualizar contrato”. '}
        Não há assinatura eletrônica nem validade jurídica garantida, e o pagamento é combinado fora da plataforma.
      </p>
    </section>
  );
}
