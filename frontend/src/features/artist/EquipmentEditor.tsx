import { useMemo, useState } from 'react';
import { FormError } from '../../components/Fields';
import { Icon } from '../../components/Icon';
import { Loading } from '../../components/States';
import { useCatalog } from '../../lib/hooks';
import type { RiderItem } from '../../lib/types';

export interface EquipmentInput {
  catalogItemId?: string | null;
  customName?: string | null;
  customUnit?: string | null;
  quantity: number;
  /** Somente rider: quanto do necessário o artista já possui (0 a quantity). */
  ownedQuantity?: number;
  notes: string;
}

interface CustomRow {
  key: number;
  customName: string;
  customUnit: string;
  quantity: number;
  owned: number;
  notes: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

/**
 * Editor de itens técnicos baseado no catálogo (IDs estáveis) + itens personalizados ("outros").
 * mode="rider": o que o artista PRECISA para tocar (≥1) e, para cada item, quanto ele já possui e leva (0 a necessário).
 * mode="inventory": quantidades que a casa tem disponíveis (≥0).
 */
export function EquipmentEditor({
  mode,
  items,
  notes,
  readOnly,
  saving,
  onSave,
}: {
  mode: 'rider' | 'inventory';
  items: RiderItem[];
  notes?: string;
  readOnly?: boolean;
  saving?: boolean;
  onSave: (payload: { items: EquipmentInput[]; notes: string }) => void;
}) {
  const { data: catalog, isLoading } = useCatalog();
  const minQty = mode === 'rider' ? 1 : 0;
  const isRider = mode === 'rider';
  const [selected, setSelected] = useState<Record<string, { quantity: number; owned: number; notes: string }>>(() =>
    Object.fromEntries(items.filter((i) => i.catalogItemId).map((i) => [i.catalogItemId!, { quantity: i.quantity, owned: i.ownedQuantity ?? 0, notes: i.notes }])),
  );
  const [custom, setCustom] = useState<CustomRow[]>(() =>
    items.filter((i) => i.isCustom).map((i, k) => ({ key: k, customName: i.customName ?? i.name, customUnit: i.unit, quantity: i.quantity, owned: i.ownedQuantity ?? 0, notes: i.notes })),
  );
  const [generalNotes, setGeneralNotes] = useState(notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof catalog>>();
    for (const c of catalog ?? []) {
      if (isRider && !c.artistRequirement) continue;
      map.set(c.category, [...(map.get(c.category) ?? []), c]);
    }
    return [...map.entries()];
  }, [catalog, isRider]);

  if (isLoading) return <Loading label="Carregando catálogo técnico…" />;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = { quantity: 1, owned: 0, notes: '' };
      return next;
    });
  // Reduzir o necessário nunca deixa o "já possuo" acima dele.
  const setQty = (id: string, q: number) =>
    setSelected((s) => {
      const quantity = clamp(q || 0, minQty, 9999);
      return { ...s, [id]: { ...s[id], quantity, owned: Math.min(s[id].owned, quantity) } };
    });
  const setOwned = (id: string, o: number) => setSelected((s) => ({ ...s, [id]: { ...s[id], owned: clamp(o || 0, 0, s[id].quantity) } }));

  const save = () => {
    setError(null);
    const bad = custom.find((c) => c.customName.trim().length < 2);
    if (bad) return setError('Dê um nome a cada item personalizado (mínimo 2 caracteres).');
    onSave({
      notes: generalNotes,
      items: [
        ...Object.entries(selected).map(([catalogItemId, v]) => ({ catalogItemId, quantity: v.quantity, ...(isRider ? { ownedQuantity: v.owned } : {}), notes: v.notes })),
        ...custom.map((c) => {
          const quantity = Math.max(minQty, c.quantity);
          return { customName: c.customName.trim(), customUnit: c.customUnit.trim() || 'un', quantity, ...(isRider ? { ownedQuantity: Math.min(c.owned, quantity) } : {}), notes: c.notes };
        }),
      ],
    });
  };

  const qtyLabel = isRider ? 'Quantidade necessária' : 'Quantidade disponível';

  return (
    <div className="stack">
      {groups.map(([category, list]) => (
        <section className="box" key={category} aria-label={category}>
          <h2 className="lbl">{category}</h2>
          <div className="tscroll">
            <table className="rtable">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">{qtyLabel}</th>
                  {isRider && <th scope="col">Já possuo</th>}
                  <th scope="col">Observações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const sel = selected[c.id];
                  return (
                    <tr key={c.id}>
                      <td>
                        <label className="check">
                          <input type="checkbox" checked={!!sel} disabled={readOnly} onChange={() => toggle(c.id)} aria-label={`Incluir ${c.name}`} />
                          {c.name}
                        </label>
                      </td>
                      <td className="qtycell">
                        {sel ? (
                          <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                            <input
                              className="input"
                              type="number"
                              min={minQty}
                              max={9999}
                              value={sel.quantity}
                              disabled={readOnly}
                              aria-label={`${qtyLabel} de ${c.name}`}
                              onChange={(e) => setQty(c.id, Number(e.target.value))}
                            />
                            <span className="hint">{c.unit}</span>
                          </span>
                        ) : (
                          <span className="hint">—</span>
                        )}
                      </td>
                      {isRider && (
                        <td className="qtycell">
                          {sel ? (
                            <input
                              className="input"
                              type="number"
                              min={0}
                              max={sel.quantity}
                              value={sel.owned}
                              disabled={readOnly}
                              aria-label={`Quantidade que você já possui de ${c.name}`}
                              onChange={(e) => setOwned(c.id, Number(e.target.value))}
                            />
                          ) : (
                            <span className="hint">—</span>
                          )}
                        </td>
                      )}
                      <td>
                        {sel && (
                          <input
                            className="input"
                            value={sel.notes}
                            maxLength={200}
                            disabled={readOnly}
                            aria-label={`Observações de ${c.name}`}
                            placeholder="Opcional"
                            onChange={(e) => setSelected((s) => ({ ...s, [c.id]: { ...s[c.id], notes: e.target.value } }))}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="box" aria-label="Itens personalizados">
        <h2 className="lbl">Outros (fora do catálogo)</h2>
        <p className="hint">
          Itens personalizados não são comparados automaticamente: aparecem como “conferir com a casa”
          {isRider ? ', a menos que você já possua toda a quantidade necessária' : ''}.
        </p>
        {isRider && custom.length > 0 && (
          <div className="orow with-owned orow-head" aria-hidden="true">
            <span>Item</span>
            <span>Necessário</span>
            <span>Já possuo</span>
            <span>Observações</span>
            <span />
          </div>
        )}
        {custom.map((c, idx) => (
          <div className={`orow${isRider ? ' with-owned' : ''}`} key={c.key}>
            <input
              className="input"
              placeholder="Nome do item"
              value={c.customName}
              maxLength={80}
              disabled={readOnly}
              aria-label="Nome do item personalizado"
              onChange={(e) => setCustom(custom.map((x, i) => (i === idx ? { ...x, customName: e.target.value } : x)))}
            />
            <input
              className="input"
              type="number"
              min={minQty}
              value={c.quantity}
              disabled={readOnly}
              aria-label={isRider ? 'Quantidade necessária do item personalizado' : 'Quantidade do item personalizado'}
              onChange={(e) => {
                const quantity = Number(e.target.value);
                setCustom(custom.map((x, i) => (i === idx ? { ...x, quantity, owned: Math.min(x.owned, Math.max(quantity, 0)) } : x)));
              }}
            />
            {isRider && (
              <input
                className="input"
                type="number"
                min={0}
                max={c.quantity}
                value={c.owned}
                disabled={readOnly}
                aria-label="Quantidade que você já possui do item personalizado"
                onChange={(e) => setCustom(custom.map((x, i) => (i === idx ? { ...x, owned: clamp(Number(e.target.value) || 0, 0, x.quantity) } : x)))}
              />
            )}
            <input
              className="input"
              placeholder="Observações"
              value={c.notes}
              maxLength={200}
              disabled={readOnly}
              aria-label="Observações do item personalizado"
              onChange={(e) => setCustom(custom.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))}
            />
            {!readOnly && (
              <button type="button" className="iconbtn" aria-label="Remover item personalizado" onClick={() => setCustom(custom.filter((_, i) => i !== idx))}>
                <Icon name="trash" size={18} />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            className="btn sm"
            onClick={() => setCustom([...custom, { key: Date.now(), customName: '', customUnit: 'un', quantity: Math.max(1, minQty), owned: 0, notes: '' }])}
          >
            <Icon name="plus" size={16} /> Adicionar item personalizado
          </button>
        )}
      </section>

      {isRider && (
        <label className="field box">
          <span>Observações gerais do rider</span>
          <textarea className="input" value={generalNotes} maxLength={2000} disabled={readOnly} onChange={(e) => setGeneralNotes(e.target.value)} />
        </label>
      )}

      <FormError message={error} />
      {!readOnly && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn cue" type="button" onClick={save} disabled={saving}>
            {saving ? 'Salvando…' : isRider ? 'Salvar rider' : 'Salvar inventário'}
          </button>
        </div>
      )}
    </div>
  );
}
