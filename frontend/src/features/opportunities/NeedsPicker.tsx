import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';
import { useCatalog } from '../../lib/hooks';
import type { Need, Rider } from '../../lib/types';

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
 */
export function NeedsPicker({ artistId, value, onChange }: { artistId: string; value: Need[]; onChange: (v: Need[]) => void }) {
  const id = useId();
  const { data: catalog } = useCatalog();
  const rider = useQuery({ queryKey: ['rider', artistId], queryFn: () => api.get<Rider>(`/artists/${artistId}/rider`), enabled: !!artistId });
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
      {value.length > 0 ? (
        <ul className="needs-list">
          {value.map((n, i) => (
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
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Math.min(999, Number(e.target.value) || 1)) } : x)))}
              />
              <button type="button" className="btn sm ghost" aria-label="Remover item" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Nenhum item marcado: você leva tudo o que precisa.</p>
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
