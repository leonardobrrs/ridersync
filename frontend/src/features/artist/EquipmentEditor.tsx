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
  notes: string;
}

interface CustomRow {
  key: number;
  customName: string;
  customUnit: string;
  quantity: number;
  notes: string;
}

/**
 * Editor de itens técnicos baseado no catálogo (IDs estáveis) + itens personalizados ("outros").
 * mode="rider": quantidades necessárias (≥1) · mode="inventory": quantidades disponíveis (≥0).
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
  const [selected, setSelected] = useState<Record<string, { quantity: number; notes: string }>>(() =>
    Object.fromEntries(items.filter((i) => i.catalogItemId).map((i) => [i.catalogItemId!, { quantity: i.quantity, notes: i.notes }])),
  );
  const [custom, setCustom] = useState<CustomRow[]>(() =>
    items.filter((i) => i.isCustom).map((i, k) => ({ key: k, customName: i.customName ?? i.name, customUnit: i.unit, quantity: i.quantity, notes: i.notes })),
  );
  const [generalNotes, setGeneralNotes] = useState(notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, NonNullable<typeof catalog>>();
    for (const c of catalog ?? []) {
      if (mode === 'rider' && !c.artistRequirement) continue;
      map.set(c.category, [...(map.get(c.category) ?? []), c]);
    }
    return [...map.entries()];
  }, [catalog, mode]);

  if (isLoading) return <Loading label="Carregando catálogo técnico…" />;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = { quantity: 1, notes: '' };
      return next;
    });
  const setQty = (id: string, q: number) => setSelected((s) => ({ ...s, [id]: { ...s[id], quantity: Math.max(minQty, Math.min(9999, q || 0)) } }));

  const save = () => {
    setError(null);
    const bad = custom.find((c) => c.customName.trim().length < 2);
    if (bad) return setError('Dê um nome a cada item personalizado (mínimo 2 caracteres).');
    onSave({
      notes: generalNotes,
      items: [
        ...Object.entries(selected).map(([catalogItemId, v]) => ({ catalogItemId, quantity: v.quantity, notes: v.notes })),
        ...custom.map((c) => ({ customName: c.customName.trim(), customUnit: c.customUnit.trim() || 'un', quantity: Math.max(minQty, c.quantity), notes: c.notes })),
      ],
    });
  };

  const qtyLabel = mode === 'rider' ? 'Quantidade necessária' : 'Quantidade disponível';

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
          Itens personalizados não são comparados automaticamente: aparecem como “conferir com a casa”.
        </p>
        {custom.map((c, idx) => (
          <div className="orow" key={c.key}>
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
              aria-label="Quantidade do item personalizado"
              onChange={(e) => setCustom(custom.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))}
            />
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
            onClick={() => setCustom([...custom, { key: Date.now(), customName: '', customUnit: 'un', quantity: Math.max(1, minQty), notes: '' }])}
          >
            <Icon name="plus" size={16} /> Adicionar item personalizado
          </button>
        )}
      </section>

      {mode === 'rider' && (
        <label className="field box">
          <span>Observações gerais do rider</span>
          <textarea className="input" value={generalNotes} maxLength={2000} disabled={readOnly} onChange={(e) => setGeneralNotes(e.target.value)} />
        </label>
      )}

      <FormError message={error} />
      {!readOnly && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn cue" type="button" onClick={save} disabled={saving}>
            {saving ? 'Salvando…' : mode === 'rider' ? 'Salvar rider' : 'Salvar inventário'}
          </button>
        </div>
      )}
    </div>
  );
}
