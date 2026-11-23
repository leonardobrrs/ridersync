/**
 * RiderCompatibility — comparação determinística e explicável entre uma lista de equipamentos e o inventário da casa.
 * Usada com o que o artista PEDIU à casa na candidatura ("necessário" = pedido) e, de forma informativa, com o rider
 * (o que o artista tem e leva) — nesse caso o frontend apresenta o resultado como "quem leva o quê".
 * Regras (por item):
 *  - item personalizado / sem ID de catálogo → NEEDS_CHECK (sem correspondência automática)
 *  - disponível >= necessário                → COMPATIBLE
 *  - 0 < disponível < necessário             → PARTIALLY_AVAILABLE
 *  - ausente do inventário ou disponível = 0 → UNAVAILABLE
 * Correspondência SOMENTE por catalogItemId idêntico. Nunca inferir substitutos.
 */
export type CompatibilityStatus = 'COMPATIBLE' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'NEEDS_CHECK';

export interface RiderRequirement {
  riderItemId: string;
  catalogItemId: string | null;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
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
  available: number | null;
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
}

const fmt = (n: number, unit: string) => `${n} ${unit}`;

export function compareRider(requirements: RiderRequirement[], inventory: InventoryEntry[]): CompatibilityResult {
  const byId = new Map<string, InventoryEntry>();
  for (const entry of inventory) byId.set(entry.catalogItemId, entry);

  const items = requirements.map<CompatibilityItem>((req) => {
    const base = {
      riderItemId: req.riderItemId,
      catalogItemId: req.catalogItemId,
      name: req.name,
      category: req.category,
      unit: req.unit,
      required: req.quantity,
      riderNotes: req.notes,
    };
    if (!req.catalogItemId) {
      return {
        ...base,
        available: null,
        missing: null,
        status: 'NEEDS_CHECK',
        reason: 'Item personalizado, fora do catálogo: não há correspondência automática. Confirme diretamente com a casa.',
        venueNotes: null,
      };
    }
    const inv = byId.get(req.catalogItemId);
    if (!inv) {
      return {
        ...base,
        available: 0,
        missing: req.quantity,
        status: 'UNAVAILABLE',
        reason: `Item não consta no inventário da casa. Pedido: ${fmt(req.quantity, req.unit)}.`,
        venueNotes: null,
      };
    }
    if (inv.quantity <= 0) {
      return {
        ...base,
        available: 0,
        missing: req.quantity,
        status: 'UNAVAILABLE',
        reason: `A casa registra quantidade 0. Pedido: ${fmt(req.quantity, req.unit)}.`,
        venueNotes: inv.notes || null,
      };
    }
    if (inv.quantity >= req.quantity) {
      return {
        ...base,
        available: inv.quantity,
        missing: 0,
        status: 'COMPATIBLE',
        reason: `Disponível ${fmt(inv.quantity, req.unit)} — atende o pedido (${fmt(req.quantity, req.unit)}).`,
        venueNotes: inv.notes || null,
      };
    }
    const missing = req.quantity - inv.quantity;
    return {
      ...base,
      available: inv.quantity,
      missing,
      status: 'PARTIALLY_AVAILABLE',
      reason: `Disponível ${fmt(inv.quantity, req.unit)} de ${fmt(req.quantity, req.unit)} pedidos — faltam ${fmt(missing, req.unit)}.`,
      venueNotes: inv.notes || null,
    };
  });

  const summary = { COMPATIBLE: 0, PARTIALLY_AVAILABLE: 0, UNAVAILABLE: 0, NEEDS_CHECK: 0, total: items.length };
  for (const i of items) summary[i.status]++;
  return { items, summary, fullyCompatible: items.length > 0 && summary.COMPATIBLE === items.length };
}
