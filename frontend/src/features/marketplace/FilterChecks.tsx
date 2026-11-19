import { useId, useState } from 'react';
import { normalizeInstrument } from '../../lib/instruments';

/** Valores de um filtro com vários itens na URL: "MPB,Forró" ↔ ['MPB', 'Forró']. */
export const readList = (params: URLSearchParams, key: string) =>
  (params.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
export const writeList = (values: string[]) => values.join(',');

/** "Maceió", "Maceió e Penedo", "3 cidades". */
export function listLabel(values: string[], plural: string) {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} e ${values[1]}`;
  return `${values.length} ${plural}`;
}

/**
 * Grupo de marcadores (vários valores por filtro). Os selecionados aparecem sempre; listas longas mostram os
 * primeiros itens e "Ver mais". Cada marcação muda a busca na hora (sem botão de aplicar).
 */
export function CheckGroup({
  legend,
  options,
  selected,
  onChange,
  initial = 6,
}: {
  legend: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  initial?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? options : [...new Set([...selected.filter((s) => options.includes(s)), ...options.slice(0, initial)])];
  const hidden = options.length - shown.length;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  return (
    <fieldset className="fgroup fchecks">
      <legend className="lbl">
        {legend}
        {selected.length > 0 && (
          <button type="button" className="link fclear" onClick={() => onChange([])} aria-label={`Limpar ${legend.toLowerCase()}`}>
            limpar ({selected.length})
          </button>
        )}
      </legend>
      {shown.map((o) => (
        <Check key={o} label={o} checked={selected.includes(o)} onChange={() => toggle(o)} />
      ))}
      {options.length > initial && (
        <button type="button" className="link fmore" aria-expanded={expanded} onClick={() => setExpanded((x) => !x)}>
          {expanded ? 'Ver menos' : `Ver mais (${hidden})`}
        </button>
      )}
    </fieldset>
  );
}

/** Cidades: sugestões em destaque + busca entre os 102 municípios de Alagoas. */
export function CityChecks({
  suggestions,
  all,
  selected,
  onChange,
}: {
  suggestions: string[];
  all: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [term, setTerm] = useState('');
  const base = [...new Set([...selected, ...suggestions])];
  const t = normalizeInstrument(term);
  const matches = t.length >= 2 ? all.filter((c) => !base.includes(c) && normalizeInstrument(c).includes(t)).slice(0, 6) : [];
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  return (
    <fieldset className="fgroup fchecks">
      <legend className="lbl">
        Cidade
        {selected.length > 0 && (
          <button type="button" className="link fclear" onClick={() => onChange([])} aria-label="Limpar cidades">
            limpar ({selected.length})
          </button>
        )}
      </legend>
      {base.map((c) => (
        <Check key={c} label={c} checked={selected.includes(c)} onChange={() => toggle(c)} />
      ))}
      <label className="sr-only" htmlFor={id}>
        Buscar outra cidade de Alagoas
      </label>
      <input id={id} className="input fsearch" type="search" placeholder="Outra cidade…" value={term} onChange={(e) => setTerm(e.target.value)} />
      {matches.map((c) => (
        <Check
          key={c}
          label={c}
          checked={false}
          onChange={() => {
            toggle(c);
            setTerm('');
          }}
        />
      ))}
      {t.length >= 2 && matches.length === 0 && <small className="hint">Nenhuma cidade de Alagoas com esse nome.</small>}
    </fieldset>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`fchk${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
