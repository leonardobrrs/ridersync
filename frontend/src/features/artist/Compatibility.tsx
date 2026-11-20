import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { PageHead } from '../../components/Layout';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { api } from '../../lib/api';
import { COMPAT_STATUS } from '../../lib/format';
import { useMe } from '../../lib/hooks';
import type { CompatibilityResult, VenueCard } from '../../lib/types';

/**
 * Resultado da comparação determinística feita no backend, item a item, com justificativa.
 * Com applicationId: compara o que o artista disse precisar da casa na candidatura (reunião 19/11 — o rider do
 * perfil representa o que ele já possui). Sem: compara o rider do perfil com a casa.
 */
export function CompatibilityView({ artistId, organizationId, applicationId }: { artistId?: string; organizationId?: string; applicationId?: string | null }) {
  const byApplication = !!applicationId;
  const q = useQuery({
    queryKey: ['compat', applicationId ?? artistId, organizationId],
    queryFn: () =>
      api.get<CompatibilityResult>(byApplication ? `/applications/${applicationId}/compatibility` : `/artists/${artistId}/compatibility/${organizationId}`),
  });
  if (q.isLoading) return <Loading label="Comparando rider e inventário…" />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const r = q.data!;
  return (
    <section className="box" aria-label="Resultado da comparação">
      <div className="row between">
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>{byApplication ? 'Necessidades do artista' : 'Rider'} × {r.organization.name}</h2>
        <div className="sum">
          {(['COMPATIBLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'NEEDS_CHECK'] as const).map((s) => (
            <span key={s} className={`st ${COMPAT_STATUS[s][1]}`}>
              {r.summary[s]} {COMPAT_STATUS[s][0].toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      {!r.inventoryRegistered && <div className="inline-msg info">Esta casa ainda não cadastrou inventário: os itens aparecem como indisponíveis até confirmação.</div>}
      {r.items.length === 0 ? (
        <Empty title={byApplication ? 'Nada pedido à casa' : 'Rider vazio'}>{byApplication ? 'O artista não pediu equipamentos à casa nesta candidatura.' : 'Cadastre itens no rider para comparar.'}</Empty>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Necessário</th>
                <th>Disponível</th>
                <th>Resultado</th>
                <th>Motivo</th>
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
                    <Status value={i.status} map={COMPAT_STATUS} />
                  </td>
                  <td>
                    {i.reason}
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
      <p className="note">Comparação apenas por itens do catálogo com correspondência exata. Nenhum equipamento é considerado substituto de outro.</p>
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
      <PageHead title="Comparar rider" subtitle="Veja, item a item, o que uma casa de show tem disponível para o seu rider." />
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
