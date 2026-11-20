import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { useCatalog } from '../../lib/hooks';
import type { Need, PublicVenue, Rider, RiderItem } from '../../lib/types';

/** Nome exibido de uma necessidade (item do catálogo ou personalizado). */
export function needLabel(n: Need, catalog: { id: string; name: string; unit: string }[] | undefined) {
  if (n.catalogItemId) {
    const c = catalog?.find((x) => x.id === n.catalogItemId);
    return `${n.quantity} ${c?.unit ?? 'un'} · ${c?.name ?? n.catalogItemId}`;
  }
  return `${n.quantity} un · ${n.customName}`;
}

/**
 * Candidatura: o que o artista precisa que a casa disponibilize. O rider do perfil representa o que ele já possui;
 * aqui ele informa o que falta para este evento — escolhendo manualmente ou preenchendo a partir do perfil.
 * Em evento numa casa de show, o inventário da casa já vem marcado (o artista desmarca o que não vai usar).
 */
export function NeedsPicker({
  artistId,
  venueSlug,
  value,
  onChange,
}: {
  artistId: string;
  venueSlug?: string | null;
  value: Need[];
  onChange: (v: Need[]) => void;
}) {
  const id = useId();
  const { data: catalog } = useCatalog();
  const rider = useQuery({ queryKey: ['rider', artistId], queryFn: () => api.get<Rider>(`/artists/${artistId}/rider`), enabled: !!artistId });
  const venue = useQuery({ queryKey: ['venue', venueSlug], queryFn: () => api.get<PublicVenue>(`/public/venues/${venueSlug}`), enabled: !!venueSlug });
  const offered = venue.data?.equipment ?? [];
  const sameItem = (n: Need, i: RiderItem) => (i.catalogItemId ? n.catalogItemId === i.catalogItemId : !n.catalogItemId && n.customName === (i.customName ?? i.name));
  const isOffered = (n: Need) => offered.some((i) => sameItem(n, i));
  const toNeed = (i: RiderItem): Need => ({ catalogItemId: i.catalogItemId, customName: i.catalogItemId ? null : (i.customName ?? i.name), quantity: Math.min(999, Math.max(1, i.quantity)) });
  // Marca de saída o que a casa oferece (uma vez por casa), sem apagar o que o artista já escolheu.
  const prefilled = useRef<string | null>(null);
  useEffect(() => {
    if (!venueSlug || !venue.data || prefilled.current === venueSlug) return;
    prefilled.current = venueSlug;
    const missing = venue.data.equipment.filter((i) => !value.some((n) => sameItem(n, i)));
    if (missing.length) onChange([...value, ...missing.map(toNeed)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueSlug, venue.data]);
  const setQty = (n: Need, quantity: number) => onChange(value.map((x) => (x === n ? { ...x, quantity: Math.max(1, Math.min(999, quantity || 1)) } : x)));
  const others = value.filter((n) => !isOffered(n));
  const [pick, setPick] = useState('');
  const [custom, setCustom] = useState('');
  const has = (catalogItemId: string) => value.some((n) => n.catalogItemId === catalogItemId);
  const add = (n: Need) => onChange([...value, n]);
  const fromProfile = () => {
    const items = rider.data?.items ?? [];
    const next = [...value];
    for (const i of items) {
      if (i.catalogItemId && !next.some((n) => n.catalogItemId === i.catalogItemId)) next.push({ catalogItemId: i.catalogItemId, customName: null, quantity: i.quantity });
      if (!i.catalogItemId && i.customName && !next.some((n) => n.customName === i.customName)) next.push({ catalogItemId: null, customName: i.customName, quantity: i.quantity });
    }
    onChange(next);
  };
  const categories = [...new Set((catalog ?? []).map((c) => c.category))];
  return (
    <fieldset className="needs">
      <legend>O que você precisa que a casa disponibilize</legend>
      <small className="hint">Seu rider (no perfil) mostra o que você já tem. Marque aqui o que a casa precisa fornecer para este show.</small>
      {offered.length > 0 && (
        <div className="needs-offered">
          <strong className="needs-sub">Já oferecido pela casa</strong>
          <small className="hint">Vem marcado o que {venue.data!.name} tem. Desmarque o que você não vai usar.</small>
          <ul className="needs-list">
            {offered.map((i) => {
              const n = value.find((x) => sameItem(x, i));
              return (
                <li key={i.id}>
                  <label className="fchk needs-name">
                    <input type="checkbox" checked={!!n} onChange={() => onChange(n ? value.filter((x) => x !== n) : [...value, toNeed(i)])} />
                    <span>
                      {i.name} <small className="muted">(a casa tem {i.quantity})</small>
                    </span>
                  </label>
                  {n ? (
                    <>
                      <label className="sr-only" htmlFor={`${id}-o${i.id}`}>
                        Quantidade de {i.name}
                      </label>
                      <input id={`${id}-o${i.id}`} className="input qty" type="number" min={1} max={999} value={n.quantity} onChange={(e) => setQty(n, Number(e.target.value))} />
                    </>
                  ) : (
                    <span />
                  )}
                  <span />
                </li>
              );
            })}
          </ul>
          <strong className="needs-sub">Outros itens</strong>
        </div>
      )}
      {others.length > 0 ? (
        <ul className="needs-list">
          {others.map((n, i) => (
            <li key={`${n.catalogItemId ?? n.customName}-${i}`}>
              <span className="needs-name">{n.catalogItemId ? (catalog?.find((c) => c.id === n.catalogItemId)?.name ?? n.catalogItemId) : n.customName}</span>
              <label className="sr-only" htmlFor={`${id}-q${i}`}>
                Quantidade
              </label>
              <input
                id={`${id}-q${i}`}
                className="input qty"
                type="number"
                min={1}
                max={999}
                value={n.quantity}
                onChange={(e) => setQty(n, Number(e.target.value))}
              />
              <button type="button" className="btn sm ghost" aria-label="Remover item" onClick={() => onChange(value.filter((x) => x !== n))}>
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{offered.length ? 'Nenhum item além do que a casa oferece.' : 'Nenhum item marcado: você leva tudo o que precisa.'}</p>
      )}
      <div className="needs-add">
        <label className="sr-only" htmlFor={`${id}-pick`}>
          Adicionar equipamento
        </label>
        <select
          id={`${id}-pick`}
          className="input"
          value={pick}
          onChange={(e) => {
            const v = e.target.value;
            setPick('');
            if (v && !has(v)) add({ catalogItemId: v, customName: null, quantity: 1 });
          }}
        >
          <option value="">Adicionar equipamento…</option>
          {categories.map((cat) => (
            <optgroup key={cat} label={cat}>
              {(catalog ?? [])
                .filter((c) => c.category === cat)
                .map((c) => (
                  <option key={c.id} value={c.id} disabled={has(c.id)}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <div className="row">
          <label className="sr-only" htmlFor={`${id}-custom`}>
            Outro item
          </label>
          <input id={`${id}-custom`} className="input" placeholder="Outro item (ex.: pedal looper)" maxLength={80} value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button
            type="button"
            className="btn sm"
            disabled={custom.trim().length < 2}
            onClick={() => {
              add({ catalogItemId: null, customName: custom.trim(), quantity: 1 });
              setCustom('');
            }}
          >
            Adicionar
          </button>
        </div>
        <button type="button" className="btn sm ghost" onClick={fromProfile} disabled={!rider.data?.items.length}>
          Preencher a partir do meu perfil
        </button>
      </div>
    </fieldset>
  );
}
