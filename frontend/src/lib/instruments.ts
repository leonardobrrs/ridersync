/**
 * Ícone representativo de instrumento/função musical.
 *
 * Mapeamento único usado em toda a interface (categorias da busca, cards, perfil público, integrantes de
 * banda). Os valores gravados no banco NÃO mudam: a chave é normalizada (minúsculas, sem acento) só para
 * escolher o desenho, e o texto exibido continua sendo o valor original. Valores desconhecidos usam o ícone
 * genérico de música. Os desenhos ficam em `components/instrument-icons.ts`.
 */
const ICON_BY_KEY: Record<string, string> = {
  voz: 'inst-voice',
  vocal: 'inst-voice',
  cantor: 'inst-voice',
  cantora: 'inst-voice',
  'vocal de apoio': 'inst-backing-vocal',
  violao: 'inst-acoustic-guitar',
  guitarra: 'inst-electric-guitar',
  baixo: 'inst-bass',
  contrabaixo: 'inst-bass',
  bateria: 'inst-drums',
  percussao: 'inst-percussion',
  teclado: 'inst-keys',
  piano: 'inst-piano',
  sanfona: 'inst-accordion',
  acordeon: 'inst-accordion',
  sopros: 'inst-winds',
  sopro: 'inst-winds',
  saxofone: 'inst-winds',
  trompete: 'inst-winds',
  cordas: 'inst-strings',
  violino: 'inst-strings',
  dj: 'inst-dj',
  'producao musical': 'inst-production',
  'direcao musical': 'inst-direction',
  'tecnico de som': 'inst-sound-tech',
  'empresario(a)': 'inst-manager',
  empresario: 'inst-manager',
  empresaria: 'inst-manager',
};

export const GENERIC_INSTRUMENT_ICON = 'inst-other';

export const normalizeInstrument = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export function instrumentIcon(value: string | null | undefined): string {
  if (!value) return GENERIC_INSTRUMENT_ICON;
  return ICON_BY_KEY[normalizeInstrument(value)] ?? GENERIC_INSTRUMENT_ICON;
}
