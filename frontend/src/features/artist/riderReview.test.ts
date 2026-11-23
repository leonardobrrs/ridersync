import type { RiderItem } from '../../lib/types';
import { riderNeedsReview } from './ArtistWorkspace';

const item = { id: 'i1', catalogItemId: 'c1', name: 'Amplificador', quantity: 1 } as unknown as RiderItem;

describe('aviso de revisão do rider (mudança de conceito em 23/11)', () => {
  it('rider com itens salvo antes da mudança pede revisão', () => {
    expect(riderNeedsReview({ items: [item], updatedAt: '2026-11-22T10:00:00-03:00' })).toBe(true);
  });

  it.each([
    ['salvo depois da mudança', { items: [item], updatedAt: '2026-11-24T10:00:00-03:00' }],
    ['rider vazio', { items: [], updatedAt: '2026-11-22T10:00:00-03:00' }],
    ['rider nunca salvo', { items: [], updatedAt: undefined }],
  ])('não pede revisão: %s', (_, r) => {
    expect(riderNeedsReview(r)).toBe(false);
  });
});
