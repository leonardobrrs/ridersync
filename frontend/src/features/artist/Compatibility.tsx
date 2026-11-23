import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { PageHead } from '../../components/Layout';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { api } from '../../lib/api';
import { COMPAT_STATUS, RIDER_VS_VENUE } from '../../lib/format';
import { useMe } from '../../lib/hooks';
import type { CompatibilityResult, VenueCard } from '../../lib/types';

/**
 * Comparação determinística feita no backend, item a item.
 * Com applicationId: o que o artista PEDIU à casa na candidatura × inventário (atende / falta).
 * Sem: o RIDER (o que o artista tem e leva) × inventário — informativo: mostra o que a casa também tem (o artista
 * pode combinar de usar o da casa) e o que só ele tem (leva o próprio). Não há "necessário" nesse modo.
 */
export function CompatibilityView({ artistId, organizationId, applicationId }: { artistId?: string; organizationId?: string; applicationId?: string | null }) {
  const byApplication = !!applicationId;
  const q = useQuery({
    queryKey: ['compat', applicationId ?? artistId, organizationId],
    queryFn: () =>
      api.get<CompatibilityResult>(byApplication ? `/applications/${applicationId}/compatibility` : `/artists/${artistId}/compatibility/${organizationId}`),
  });
  if (q.isLoading) return <Loading label={byApplication ? 'Comparando o pedido com o inventário…' : 'Comparando rider e inventário…'} />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const r = q.data!;
  const labels = byApplication ? COMPAT_STATUS : RIDER_VS_VENUE;
  /** No modo rider, o motivo é informativo (quem leva o quê), não falta de algo exigido. */
  const riderReason = (i: (typeof r.items)[number]) =>
    i.status === 'COMPATIBLE'
      ? `A casa também tem (${i.available} ${i.unit}): dá para combinar de usar o da casa.`
      : i.status === 'PARTIALLY_AVAILABLE'
        ? `A casa tem ${i.available} ${i.unit}; você tem ${i.required}.`
        : i.status === 'UNAVAILABLE'
          ? 'A casa não tem: leve o seu.'
          : i.reason;
  return (
    <section className="box" aria-label="Resultado da comparação">
      <div className="row between">
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>{byApplication ? 'Pedido à casa' : 'Rider (o que o artista leva)'} × {r.organization.name}</h2>
        <div className="sum">
          {(['COMPATIBLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'NEEDS_CHECK'] as const).map((s) => (
            <span key={s} className={`st ${labels[s][1]}`}>
              {r.summary[s]} {labels[s][0].toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      {!r.inventoryRegistered && <div className="inline-msg info">Esta casa ainda não cadastrou inventário: os itens aparecem como indisponíveis até confirmação.</div>}
      {r.items.length === 0 ? (
        <Empty title={byApplication ? 'Nada pedido à casa' : 'Rider vazio'}>{byApplication ? 'O artista não pediu equipamentos à casa nesta candidatura.' : 'Cadastre no rider os equipamentos que você tem para comparar.'}</Empty>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>{byApplication ? 'Pedido à casa' : 'No rider'}</th>
                <th>{byApplication ? 'Disponível na casa' : 'Na casa'}</th>
                <th>{byApplication ? 'Resultado' : 'Situação'}</th>
                <th>{byApplication ? 'Motivo' : 'Observação'}</th>
              </tr>
            </thead>
            <tbody>
              {r.items.map((i) => (
                <tr key={i.riderItemId} className={`cmp-row ${i.status}`}>
                  <td>
                    <strong>{i.name}</strong>
                    {i.category && <small className="hint" style={{ display: 'block' }}>{i.category}</small>}
                    {i.riderNotes && <small className="hint" style={{ display: 'block' }}>Rider: {i.riderNotes}</small>}
                  </td>
                  <td className="n">
                    {i.required} {i.unit}
                  </td>
                  <td className="n">{i.available == null ? '—' : `${i.available} ${i.unit}`}</td>
                  <td>
                    <Status value={i.status} map={labels} />
                  </td>
                  <td>
                    {byApplication ? i.reason : riderReason(i)}
                    {i.venueNotes && <small className="hint" style={{ display: 'block' }}>Casa: {i.venueNotes}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.venueCustomItems.length > 0 && (
        <div className="stack-sm">
          <h3 className="lbl">Outros recursos informados pela casa (não comparados automaticamente)</h3>
          <ul className="chips">
            {r.venueCustomItems.map((c, k) => (
              <li key={k} className="chip">
                {c.name} · {c.quantity} {c.unit}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="note">
        {byApplication
          ? 'Comparação apenas por itens do catálogo com correspondência exata. Nenhum equipamento é considerado substituto de outro.'
          : 'O rider é o que o artista já tem e leva. O que ele precisa que a casa forneça é informado em cada candidatura. Comparação por itens do catálogo com correspondência exata.'}
      </p>
    </section>
  );
}

export function ComparePage() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const venues = useQuery({ queryKey: ['venues', {}], queryFn: () => api.get<VenueCard[]>('/public/venues') });
  const identities = [
    ...(me?.musician ? [{ id: me.musician.id, label: `${me.musician.name} (perfil individual)` }] : []),
    ...(me?.bands.map((b) => ({ id: b.artist.id, label: `${b.artist.name} (banda)` })) ?? []),
  ];
  const artistId = params.get('artist') ?? identities[0]?.id ?? '';
  const orgId = params.get('venue') ?? '';
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  return (
    <>
      <PageHead
        title="Comparar rider"
        subtitle="Veja, item a item, o que você já leva e o que a casa também tem — ajuda a decidir o que pedir à casa na candidatura."
      />
      {identities.length === 0 ? (
        <Empty title="Você ainda não tem um perfil artístico">Crie seu perfil individual ou uma banda para cadastrar um rider.</Empty>
      ) : (
        <div className="box cmp-f">
          <label className="field">
            <span>Identidade artística</span>
            <select className="input" value={artistId} onChange={(e) => set('artist', e.target.value)}>
              {identities.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Casa de show</span>
            <select className="input" value={orgId} onChange={(e) => set('venue', e.target.value)}>
              <option value="">Selecione…</option>
              {venues.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.city} ({v.equipmentItems} itens)
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {artistId && orgId && <CompatibilityView artistId={artistId} organizationId={orgId} />}
    </>
  );
}
