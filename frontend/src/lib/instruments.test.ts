import { describe, expect, it } from 'vitest';
import { instrumentIcon } from './instruments';

describe('instrumentIcon', () => {
  it('mapeia os instrumentos e funções do domínio para ícones específicos', () => {
    expect(instrumentIcon('Voz')).toBe('mic');
    expect(instrumentIcon('Vocal de apoio')).toBe('mic');
    expect(instrumentIcon('Violão')).toBe('acousticGuitar');
    expect(instrumentIcon('Guitarra')).toBe('electricGuitar');
    expect(instrumentIcon('Baixo')).toBe('bass');
    expect(instrumentIcon('Bateria')).toBe('drums');
    expect(instrumentIcon('Teclado')).toBe('keys');
    expect(instrumentIcon('Percussão')).toBe('percussion');
    expect(instrumentIcon('Técnico de som')).toBe('headphones');
  });
  it('ignora acento/caixa e usa o ícone genérico para valores desconhecidos ou vazios', () => {
    expect(instrumentIcon('  PERCUSSAO ')).toBe('percussion');
    expect(instrumentIcon('Theremin')).toBe('music');
    expect(instrumentIcon(null)).toBe('music');
  });
});
