import { describe, expect, it } from 'vitest';
import { INSTRUMENT_ICONS } from '../components/instrument-icons';
import { instrumentIcon } from './instruments';

// Espelho das listas do backend (INSTRUMENTS e BAND_POSITIONS em backend/src/common/domain-lists.ts).
const DOMAIN_VALUES = [
  'Voz', 'Violão', 'Guitarra', 'Baixo', 'Bateria', 'Teclado', 'Sanfona', 'Percussão', 'Sopros', 'Cordas', 'DJ',
  'Vocal', 'Vocal de apoio', 'Produção musical', 'Direção musical', 'Técnico de som', 'Empresário(a)',
];

describe('instrumentIcon', () => {
  it('mapeia os instrumentos e funções do domínio para ícones específicos', () => {
    expect(instrumentIcon('Voz')).toBe('inst-voice');
    expect(instrumentIcon('Vocal de apoio')).toBe('inst-backing-vocal');
    expect(instrumentIcon('Violão')).toBe('inst-acoustic-guitar');
    expect(instrumentIcon('Guitarra')).toBe('inst-electric-guitar');
    expect(instrumentIcon('Baixo')).toBe('inst-bass');
    expect(instrumentIcon('Bateria')).toBe('inst-drums');
    expect(instrumentIcon('Teclado')).toBe('inst-keys');
    expect(instrumentIcon('Percussão')).toBe('inst-percussion');
    expect(instrumentIcon('Sopros')).toBe('inst-winds');
    expect(instrumentIcon('Cordas')).toBe('inst-strings');
    expect(instrumentIcon('Técnico de som')).toBe('inst-sound-tech');
  });
  it('todo valor do domínio tem um ícone próprio e desenhado (nenhum cai no genérico)', () => {
    for (const v of DOMAIN_VALUES) {
      const icon = instrumentIcon(v);
      expect(icon, v).not.toBe('inst-other');
      expect(INSTRUMENT_ICONS[icon], `${v} → ${icon}`).toBeDefined();
    }
  });
  it('ignora acento/caixa e usa o ícone genérico para valores desconhecidos ou vazios', () => {
    expect(instrumentIcon('  PERCUSSAO ')).toBe('inst-percussion');
    expect(instrumentIcon('Theremin')).toBe('inst-other');
    expect(instrumentIcon(null)).toBe('inst-other');
    expect(INSTRUMENT_ICONS['inst-other']).toBeDefined();
  });
});
