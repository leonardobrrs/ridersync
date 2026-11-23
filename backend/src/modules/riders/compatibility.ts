/**
 * RiderCompatibility — comparação determinística e explicável entre o rider do artista e o inventário da casa.
 *
 * O rider diz o que o artista PRECISA para tocar (`quantity`). Para cada item o artista pode informar quanto
 * disso ele já possui e leva (`owned`, 0 ≤ owned ≤ quantity). A casa só precisa cobrir a diferença.
 *
 * Regras (por item, com V = quantidade da casa, R = necessário, O = que o artista leva):
 *  - a casa fornece min(V, R); o que sobra (falta = R − min(V, R)) precisa vir do artista
 *  - falta = 0                         → COMPATIBLE (a casa cobre tudo; artista não precisa levar)
 *  - 0 < falta ≤ O                     → COMPATIBLE, e o artista fornece `falta` unidade(s) (artistProvides)
 *  - falta > O e (V + O) > 0           → PARTIALLY_AVAILABLE (restam falta − O sem cobertura)
 *  - falta > O e V = 0 e O = 0         → UNAVAILABLE (ausente do inventário ou quantidade 0)
 *  - item personalizado / sem catálogo → NEEDS_CHECK (sem correspondência automática com a casa);
 *    se o artista leva tudo (O ≥ R) não há o que conferir com a casa → COMPATIBLE
 * Correspondência SOMENTE por catalogItemId idêntico. Nunca inferir substitutos.
 */
export type CompatibilityStatus = 'COMPATIBLE' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'NEEDS_CHECK';

export interface RiderRequirement {
  riderItemId: string;
  catalogItemId: string | null;
  name: string;
  category: string | null;
  unit: string;
  /** Necessário para tocar. */
  quantity: number;
  /** Quanto o artista já possui e leva (padrão 0). Limitado a `quantity`. */
  owned?: number;
  notes: string;
}

export interface InventoryEntry {
  catalogItemId: string;
  quantity: number;
  notes: string;
}

export interface CompatibilityItem {
  riderItemId: string;
  catalogItemId: string | null;
  name: string;
  category: string | null;
  unit: string;
  required: number;
  /** Quanto o artista declarou possuir. */
  owned: number;
  /** Quantidade registrada pela casa (null = item personalizado, sem correspondência). */
  available: number | null;
  /** Quanto a casa fornece neste show (null = desconhecido, item personalizado). */
  venueProvides: number | null;
  /** Quanto o artista precisa levar para o item ficar coberto (0 quando a casa cobre tudo). */
  artistProvides: number;
  /** Quanto continua sem cobertura, nem da casa nem do artista (null = desconhecido). */
  missing: number | null;
  status: CompatibilityStatus;
  reason: string;
  riderNotes: string;
  venueNotes: string | null;
}

export interface CompatibilityResult {
  items: CompatibilityItem[];
  summary: Record<CompatibilityStatus, number> & { total: number };
  /** true somente se TODOS os itens são COMPATIBLE e o rider não está vazio */
  fullyCompatible: boolean;
  /** Quantos itens dependem de equipamento levado pelo artista para serem atendidos. */
  artistSuppliedItems: number;
}

const fmt = (n: number, unit: string) => `${n} ${unit}`;

export function compareRider(requirements: RiderRequirement[], inventory: InventoryEntry[]): CompatibilityResult {
  const byId = new Map<string, InventoryEntry>();
  for (const entry of inventory) byId.set(entry.catalogItemId, entry);

  const items = requirements.map<CompatibilityItem>((req) => {
    const owned = Math.min(Math.max(req.owned ?? 0, 0), req.quantity);
    const base = {
      riderItemId: req.riderItemId,
      catalogItemId: req.catalogItemId,
      name: req.name,
      category: req.category,
      unit: req.unit,
      required: req.quantity,
      owned,
      riderNotes: req.notes,
    };

    if (!req.catalogItemId) {
      if (owned >= req.quantity) {
        return {
          ...base,
          available: null,
          venueProvides: 0,
          artistProvides: req.quantity,
          missing: 0,
          status: 'COMPATIBLE',
          reason: `O artista leva todas as unidades (${fmt(req.quantity, req.unit)}); não depende da casa.`,
          venueNotes: null,
        };
      }
      return {
        ...base,
        available: null,
        venueProvides: null,
        artistProvides: owned,
        missing: null,
        status: 'NEEDS_CHECK',
        reason:
          'Item personalizado, fora do catálogo: não há correspondência automática.' +
          (owned > 0 ? ` O artista leva ${fmt(owned, req.unit)}; confirme diretamente com a casa as ${fmt(req.quantity - owned, req.unit)} restantes.` : ' Confirme diretamente com a casa.'),
        venueNotes: null,
      };
    }

    const inv = byId.get(req.catalogItemId);
    const venueQty = inv ? Math.max(inv.quantity, 0) : 0;
    const venueProvides = Math.min(venueQty, req.quantity);
    const shortfall = req.quantity - venueProvides; // o que a casa não cobre
    const venueNotes = inv?.notes || null;
    const venueText = !inv ? 'Item não consta no inventário da casa' : venueQty <= 0 ? 'A casa registra quantidade 0' : `A casa tem ${fmt(venueQty, req.unit)}`;

    if (shortfall === 0) {
      return {
        ...base,
        available: venueQty,
        venueProvides,
        artistProvides: 0,
        missing: 0,
        status: 'COMPATIBLE',
        reason: `Disponível ${fmt(venueQty, req.unit)} — atende o necessário (${fmt(req.quantity, req.unit)}).`,
        venueNotes,
      };
    }

    if (shortfall <= owned) {
      return {
        ...base,
        available: venueQty,
        venueProvides,
        artistProvides: shortfall,
        missing: 0,
        status: 'COMPATIBLE',
        reason: `${venueText} (necessário: ${fmt(req.quantity, req.unit)}). A casa fornece ${fmt(venueProvides, req.unit)} e o artista precisa levar ${fmt(shortfall, req.unit)} (possui ${fmt(owned, req.unit)}).`,
        venueNotes,
      };
    }

    const missing = shortfall - owned;
    if (venueQty <= 0 && owned === 0) {
      return {
        ...base,
        available: 0,
        venueProvides: 0,
        artistProvides: 0,
        missing: req.quantity,
        status: 'UNAVAILABLE',
        reason: `${venueText}. Necessário: ${fmt(req.quantity, req.unit)}.`,
        venueNotes,
      };
    }
    return {
      ...base,
      available: venueQty,
      venueProvides,
      artistProvides: owned,
      missing,
      status: 'PARTIALLY_AVAILABLE',
      reason:
        owned === 0
          ? `Disponível ${fmt(venueQty, req.unit)} de ${fmt(req.quantity, req.unit)} necessários — faltam ${fmt(missing, req.unit)}.`
          : `${venueText} e o artista possui ${fmt(owned, req.unit)}: cobre ${fmt(venueProvides + owned, req.unit)} de ${fmt(req.quantity, req.unit)} necessários — faltam ${fmt(missing, req.unit)}.`,
      venueNotes,
    };
  });

  const summary = { COMPATIBLE: 0, PARTIALLY_AVAILABLE: 0, UNAVAILABLE: 0, NEEDS_CHECK: 0, total: items.length };
  for (const i of items) summary[i.status]++;
  return {
    items,
    summary,
    fullyCompatible: items.length > 0 && summary.COMPATIBLE === items.length,
    artistSuppliedItems: items.filter((i) => i.artistProvides > 0).length,
  };
}
