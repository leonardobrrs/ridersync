import { compareRider, RiderRequirement } from './compatibility';

const req = (id: string, catalogItemId: string | null, quantity: number, unit = 'un'): RiderRequirement => ({
  riderItemId: id,
  catalogItemId,
  name: catalogItemId ?? 'Item personalizado',
  category: catalogItemId ? 'Áudio' : null,
  unit,
  quantity,
  notes: '',
});

describe('compareRider (comparação determinística)', () => {
  it('COMPATIBLE quando disponível é igual ao necessário', () => {
    const r = compareRider([req('1', 'mic-din', 2)], [{ catalogItemId: 'mic-din', quantity: 2, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'COMPATIBLE', required: 2, available: 2, missing: 0 });
  });

  it('COMPATIBLE quando disponível é maior que o necessário', () => {
    const r = compareRider([req('1', 'retorno', 1)], [{ catalogItemId: 'retorno', quantity: 4, notes: 'Wedge 12"' }]);
    expect(r.items[0]).toMatchObject({ status: 'COMPATIBLE', available: 4, venueNotes: 'Wedge 12"' });
    expect(r.fullyCompatible).toBe(true);
  });

  it('PARTIALLY_AVAILABLE quando 0 < disponível < necessário, explicando a falta', () => {
    const r = compareRider([req('1', 'di', 3)], [{ catalogItemId: 'di', quantity: 1, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'PARTIALLY_AVAILABLE', available: 1, missing: 2 });
    expect(r.items[0].reason).toContain('faltam 2 un');
  });

  it('UNAVAILABLE quando o item está ausente do inventário', () => {
    const r = compareRider([req('1', 'bateria', 1, 'kit')], []);
    expect(r.items[0]).toMatchObject({ status: 'UNAVAILABLE', available: 0, missing: 1 });
    expect(r.items[0].reason).toContain('não consta');
  });

  it('UNAVAILABLE quando o inventário registra quantidade zero', () => {
    const r = compareRider([req('1', 'bateria', 1, 'kit')], [{ catalogItemId: 'bateria', quantity: 0, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'UNAVAILABLE', available: 0 });
    expect(r.items[0].reason).toContain('quantidade 0');
  });

  it('NEEDS_CHECK para item personalizado, sem correspondência automática', () => {
    const r = compareRider([req('1', null, 1)], [{ catalogItemId: 'mic-din', quantity: 10, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'NEEDS_CHECK', available: null, missing: null });
    expect(r.fullyCompatible).toBe(false);
  });

  it('não infere substitutos: microfone condensador não é atendido por dinâmico', () => {
    const r = compareRider([req('1', 'mic-cond', 1)], [{ catalogItemId: 'mic-din', quantity: 5, notes: '' }]);
    expect(r.items[0].status).toBe('UNAVAILABLE');
  });

  it('resume contagens por estado e não declara compatibilidade total com rider vazio', () => {
    const r = compareRider(
      [req('1', 'mic-din', 1), req('2', 'di', 2), req('3', 'pa', 1, 'par'), req('4', null, 1)],
      [
        { catalogItemId: 'mic-din', quantity: 1, notes: '' },
        { catalogItemId: 'di', quantity: 1, notes: '' },
      ],
    );
    expect(r.summary).toEqual({ COMPATIBLE: 1, PARTIALLY_AVAILABLE: 1, UNAVAILABLE: 1, NEEDS_CHECK: 1, total: 4 });
    expect(compareRider([], []).fullyCompatible).toBe(false);
  });
});

describe('compareRider — itens que o artista já possui', () => {
  const owned = (id: string, catalogItemId: string | null, quantity: number, ownedQty: number): RiderRequirement => ({ ...req(id, catalogItemId, quantity), owned: ownedQty });

  it('exemplo do produto: precisa de 2, possui 1, casa tem 1 → COMPATIBLE com 1 da casa e 1 do artista', () => {
    const r = compareRider([owned('1', 'amp-guitarra', 2, 1)], [{ catalogItemId: 'amp-guitarra', quantity: 1, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'COMPATIBLE', required: 2, owned: 1, available: 1, venueProvides: 1, artistProvides: 1, missing: 0 });
    expect(r.items[0].reason).toContain('artista precisa levar 1 un');
    expect(r.fullyCompatible).toBe(true);
    expect(r.artistSuppliedItems).toBe(1);
  });

  it('a casa cobre tudo: o artista não precisa levar o que possui', () => {
    const r = compareRider([owned('1', 'amp-guitarra', 2, 1)], [{ catalogItemId: 'amp-guitarra', quantity: 3, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'COMPATIBLE', venueProvides: 2, artistProvides: 0, missing: 0 });
    expect(r.artistSuppliedItems).toBe(0);
  });

  it('item ausente da casa, mas o artista leva tudo → COMPATIBLE com artistProvides = necessário', () => {
    const r = compareRider([owned('1', 'bateria', 1, 1)], []);
    expect(r.items[0]).toMatchObject({ status: 'COMPATIBLE', available: 0, venueProvides: 0, artistProvides: 1, missing: 0 });
  });

  it('PARTIALLY_AVAILABLE quando casa + artista ainda não cobrem o necessário', () => {
    const r = compareRider([owned('1', 'di', 4, 1)], [{ catalogItemId: 'di', quantity: 1, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'PARTIALLY_AVAILABLE', venueProvides: 1, artistProvides: 1, missing: 2 });
    expect(r.items[0].reason).toContain('faltam 2 un');
  });

  it('PARTIALLY_AVAILABLE quando a casa não tem o item mas o artista possui parte dele', () => {
    const r = compareRider([owned('1', 'di', 3, 1)], []);
    expect(r.items[0]).toMatchObject({ status: 'PARTIALLY_AVAILABLE', available: 0, venueProvides: 0, artistProvides: 1, missing: 2 });
  });

  it('continua UNAVAILABLE quando nem a casa nem o artista têm o item', () => {
    const r = compareRider([owned('1', 'bateria', 1, 0)], [{ catalogItemId: 'bateria', quantity: 0, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'UNAVAILABLE', artistProvides: 0, missing: 1 });
  });

  it('item personalizado: NEEDS_CHECK se o artista não leva tudo; COMPATIBLE se leva tudo', () => {
    const parcial = compareRider([owned('1', null, 3, 1)], []);
    expect(parcial.items[0]).toMatchObject({ status: 'NEEDS_CHECK', artistProvides: 1, missing: null });
    expect(parcial.items[0].reason).toContain('2 un restantes');
    const total = compareRider([owned('1', null, 2, 2)], []);
    expect(total.items[0]).toMatchObject({ status: 'COMPATIBLE', artistProvides: 2, venueProvides: 0 });
  });

  it('quantidade possuída acima do necessário é limitada ao necessário (nunca "cria" equipamento)', () => {
    const r = compareRider([owned('1', 'di', 2, 9)], []);
    expect(r.items[0]).toMatchObject({ owned: 2, artistProvides: 2, status: 'COMPATIBLE' });
  });

  it('sem informar quantidade possuída, o comportamento anterior é mantido', () => {
    const r = compareRider([req('1', 'di', 2)], [{ catalogItemId: 'di', quantity: 1, notes: '' }]);
    expect(r.items[0]).toMatchObject({ status: 'PARTIALLY_AVAILABLE', owned: 0, artistProvides: 0, missing: 1 });
  });
});
