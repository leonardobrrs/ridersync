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
