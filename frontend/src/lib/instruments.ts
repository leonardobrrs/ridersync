/**
 * Ícone representativo de instrumento/função musical.
 *
 * Mapeamento único usado em toda a interface (categorias da busca, cards, perfil público, integrantes de
 * banda). Os valores gravados no banco NÃO mudam: a chave é normalizada (minúsculas, sem acento) só para
 * escolher o desenho, e o texto exibido continua sendo o valor original. Valores desconhecidos usam o ícone
 * genérico de música.
 */
const ICON_BY_KEY: Record<string, string> = {
  voz: 'mic',
  vocal: 'mic',
  'vocal de apoio': 'mic',
  cantor: 'mic',
  cantora: 'mic',
  violao: 'acousticGuitar',
  guitarra: 'electricGuitar',
  baixo: 'bass',
  contrabaixo: 'bass',
  bateria: 'drums',
  teclado: 'keys',
  piano: 'keys',
  sanfona: 'accordion',
  acordeon: 'accordion',
  percussao: 'percussion',
  sopros: 'winds',
  sopro: 'winds',
  saxofone: 'winds',
  trompete: 'winds',
  cordas: 'strings',
  violino: 'strings',
  dj: 'dj',
  'producao musical': 'sliders',
  'direcao musical': 'baton',
  'tecnico de som': 'headphones',
  'empresario(a)': 'briefcase',
  empresario: 'briefcase',
};

export const normalizeInstrument = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export function instrumentIcon(value: string | null | undefined): string {
  if (!value) return 'music';
  return ICON_BY_KEY[normalizeInstrument(value)] ?? 'music';
}
