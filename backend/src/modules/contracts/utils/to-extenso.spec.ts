import { toExtenso } from './to-extenso';

describe('toExtenso (centavos → reais por extenso)', () => {
  it.each([
    [150000, 'mil e quinhentos reais'],
    [100000, 'mil reais'],
    [200000, 'dois mil reais'],
    [10000, 'cem reais'],
    [10000000, 'cem mil reais'],
    [100, 'um real'],
    [1, 'um centavo'],
    [101, 'um real e um centavo'],
    [0, 'zero real'],
    [100_000_000, 'um milhão de reais'],
    [200_000_000, 'dois milhões de reais'],
  ])('%i centavos → %s', (cents, expected) => {
    expect(toExtenso(cents)).toBe(expected);
  });

  it('mantém reais e centavos juntos', () => {
    expect(toExtenso(123456)).toBe('mil duzentos e trinta e quatro reais e cinquenta e seis centavos');
  });

  it('rejeita valores inválidos', () => {
    expect(() => toExtenso(-1)).toThrow(RangeError);
    expect(() => toExtenso(1.5)).toThrow(RangeError);
  });
});
