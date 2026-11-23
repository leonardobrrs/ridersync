import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { PageHead } from '../../components/Layout';
import { Empty, ErrorState, Loading, Status } from '../../components/States';
import { api } from '../../lib/api';
import { COMPAT_STATUS } from '../../lib/format';
import { useMe } from '../../lib/hooks';
import type { CompatibilityResult, VenueCard } from '../../lib/types';

export type CompatPerspective = 'ARTIST' | 'VENUE';

/** O backend explica em terceira pessoa ("o artista"); para quem é o artista a frase vira "você". */
export function reasonFor(reason: string, perspective: CompatPerspective) {
  if (perspective === 'VENUE') return reason;
  return reason.replace(/\bO artista\b/g, 'Você').replace(/\bo artista\b/g, 'você');
}

/**
 * Resultado da comparação determinística feita no backend, item a item, com justificativa.
 * Compara o RIDER do artista (o que ele precisa para tocar) com o inventário da casa. O que o artista declarou já
 * possuir entra na conta: a casa só cobre a diferença e o que o artista deve levar fica destacado.
 * Com applicationId a casa é a do evento da candidatura; sem, é a organização informada.
 */
export function CompatibilityView({
  artistId,
  organizationId,
  applicationId,
  perspective = 'ARTIST',
  embedded = false,
}: {
  artistId?: string;
  organizationId?: string;
  applicationId?: string | null;
  perspective?: CompatPerspective;
  /** Dentro de outra seção (ex.: aba do perfil da casa): sem moldura própria. */
  embedded?: boolean;
}) {
  const byApplication = !!applicationId;
  const q = useQuery({
    queryKey: ['compat', applicationId ?? artistId, organizationId],
    queryFn: () =>
      api.get<CompatibilityResult>(byApplication ? `/applications/${applicationId}/compatibility` : `/artists/${artistId}/compatibility/${organizationId}`),
  });
  if (q.isLoading) return <Loading label="Comparando rider e inventário…" />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const r = q.data!;
  const mine = perspective === 'ARTIST';
  const toBring = r.items.filter((i) => i.artistProvides > 0);
  const Wrapper = embedded ? 'div' : 'section';
  const Heading = embedded ? 'h3' : 'h2';
  return (
    <Wrapper className={embedded ? 'stack' : 'box'} aria-label="Resultado da comparação">
      <div className="row between">
        <Heading style={{ fontSize: embedded ? 16 : 18, fontWeight: 800 }}>
          {mine ? 'Seu rider' : 'Rider do artista'} × {r.organization.name}
        </Heading>
        <div className="sum">
          {(['COMPATIBLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'NEEDS_CHECK'] as const).map((s) => (
            <span key={s} className={`st ${COMPAT_STATUS[s][1]}`}>
              {r.summary[s]} {COMPAT_STATUS[s][0].toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      {!r.inventoryRegistered && <div className="inline-msg info">Esta casa ainda não cadastrou inventário: os itens aparecem como indisponíveis até confirmação.</div>}
      {r.items.length > 0 && toBring.length > 0 && (
        <div className="inline-msg info cmp-bring" role="note">
          <strong>{mine ? 'Você precisa levar' : 'O artista vai levar'}</strong>{' '}
          {toBring.map((i, k) => (
            <span key={i.riderItemId}>
              {k > 0 && '; '}
              {i.artistProvides} {i.unit} · {i.name}
              {i.venueProvides ? ` (a casa fornece ${i.venueProvides})` : ''}
            </span>
          ))}
          .{' '}
          {r.fullyCompatible
            ? mine
              ? 'Com isso, a casa atende o seu rider.'
              : 'Com isso, o rider fica totalmente atendido.'
            : mine
              ? 'Mesmo levando isso, ainda há itens sem cobertura.'
              : 'Mesmo com isso, ainda há itens sem cobertura.'}
        </div>
      )}
      {r.items.length === 0 ? (
        <Empty title="Rider vazio">
          {mine ? 'Cadastre itens no seu rider (aba “Rider técnico” do perfil) para comparar.' : 'O artista ainda não cadastrou itens no rider.'}
        </Empty>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Necessário</th>
                <th>{mine ? 'Você possui' : 'Artista possui'}</th>
                <th>A casa tem</th>
                <th>{mine ? 'Você leva' : 'Artista leva'}</th>
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
                  <td className="n">{i.owned > 0 ? `${i.owned} ${i.unit}` : '—'}</td>
                  <td className="n">{i.available == null ? '—' : `${i.available} ${i.unit}`}</td>
                  <td className="n">
                    {i.artistProvides > 0 ? (
                      <span className="st info cmp-bring-tag">
                        {i.artistProvides} {i.unit}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Status value={i.status} map={COMPAT_STATUS} />
                  </td>
                  <td>
                    {reasonFor(i.reason, perspective)}
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
        A casa cobre o que tem; o restante só conta como atendido se {mine ? 'você' : 'o artista'} já possuir esses itens (informado no rider). Comparação apenas por
        itens do catálogo com correspondência exata. Nenhum equipamento é considerado substituto de outro.
      </p>
    </Wrapper>
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
      <PageHead title="Comparar rider" subtitle="Veja, item a item, o que uma casa de show cobre do seu rider e o que você precisa levar." />
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
