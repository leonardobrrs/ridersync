import { describe, expect, it } from 'vitest';
import { formatPhone, isValidPhoneBR, maskPhoneBR } from './phone';

describe('maskPhoneBR', () => {
  it('formata progressivamente enquanto se digita', () => {
    const typed = '82999998888'.split('').reduce<string[]>((acc, ch) => [...acc, maskPhoneBR((acc.at(-1) ?? '') + ch)], []);
    expect(typed).toEqual([
      '(8',
      '(82',
      '(82) 9',
      '(82) 99',
      '(82) 999',
      '(82) 9999',
      '(82) 9999-9',
      '(82) 9999-98',
      '(82) 9999-988',
      '(82) 9999-9888',
      '(82) 99999-8888',
    ]);
  });
  it('fixo com 10 dígitos, ignora letras, limita a 11 dígitos e remove +55 colado', () => {
    expect(maskPhoneBR('8233334444')).toBe('(82) 3333-4444');
    expect(maskPhoneBR('82a9b9999-88880000')).toBe('(82) 99999-8888');
    expect(maskPhoneBR('+55 82 99999-8888')).toBe('(82) 99999-8888');
    expect(maskPhoneBR('')).toBe('');
  });
  it('apagar funciona (sem caracteres presos na máscara)', () => {
    expect(maskPhoneBR('(82) ')).toBe('(82');
    expect(maskPhoneBR('(82) 9999-')).toBe('(82) 9999');
  });
});

describe('isValidPhoneBR / formatPhone', () => {
  it('aceita vazio, fixo e celular completos', () => {
    expect(isValidPhoneBR('')).toBe(true);
    expect(isValidPhoneBR('(82) 3333-4444')).toBe(true);
    expect(isValidPhoneBR('(82) 99999-8888')).toBe(true);
  });
  it('recusa incompletos, celular sem 9 e DDD iniciado em 0', () => {
    expect(isValidPhoneBR('(82) 9999')).toBe(false);
    expect(isValidPhoneBR('(82) 39999-8888')).toBe(false);
    expect(isValidPhoneBR('(08) 99999-8888')).toBe(false);
  });
  it('exibe números antigos formatados quando possível', () => {
    expect(formatPhone('82999998888')).toBe('(82) 99999-8888');
    expect(formatPhone('+55 (82) 3333-4444')).toBe('(82) 3333-4444');
    expect(formatPhone('ramal 22')).toBe('ramal 22');
    expect(formatPhone(null)).toBe('');
  });
});
