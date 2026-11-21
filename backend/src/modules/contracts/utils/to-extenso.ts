import { estilo, porExtenso } from 'numero-por-extenso';

/**
 * Valor em centavos → texto por extenso em reais (ex.: 150000 → "mil e quinhentos reais").
 * Encapsula `numero-por-extenso` corrigindo o que a biblioteca erra para texto de contrato:
 * "um mil" → "mil", "milhões reais" → "milhões de reais" e zero (a biblioteca devolve vazio).
 */
export function toExtenso(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError('Valor em centavos inválido.');
  if (cents === 0) return 'zero real';
  // centavos inteiros / 100 → no máximo 2 casas; arredonda para eliminar ruído binário (ex.: 0.1 + 0.2).
  const reais = Math.round(cents) / 100;
  let out: string = porExtenso(reais, estilo.monetario);
  out = out.replace(/^um mil\b/, 'mil');
  out = out.replace(/\b(milhão|milhões|bilhão|bilhões) reais\b/, '$1 de reais');
  out = out.replace(/\b(milhão|milhões|bilhão|bilhões) real\b/, '$1 de reais');
  return out;
}
