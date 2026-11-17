import { centsFromReais, duration, fromLocalInput, money, reaisFromCents, toLocalInput } from './format';

describe('formatação', () => {
  it('converte reais ↔ centavos', () => {
    expect(centsFromReais('800')).toBe(80000);
    expect(centsFromReais('1.200,50')).toBe(120050);
    expect(centsFromReais('')).toBeNull();
    expect(reaisFromCents(90000)).toBe('900');
    expect(reaisFromCents(null)).toBe('');
  });

  it('formata moeda e duração', () => {
    expect(money(250000).replace(/\s/g, ' ')).toBe('R$ 2.500');
    expect(money(null)).toBe('—');
    expect(duration(90)).toBe('1h30');
    expect(duration(45)).toBe('45 min');
  });

  it('datetime-local usa o fuso de Maceió (UTC-3) nos dois sentidos', () => {
    const iso = '2026-12-12T00:00:00.000Z'; // 21:00 do dia 11 em Maceió
    expect(toLocalInput(iso)).toBe('2026-12-11T21:00');
    expect(new Date(fromLocalInput('2026-12-11T21:00')).toISOString()).toBe(iso);
  });
});
