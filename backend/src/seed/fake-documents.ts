import { createHash } from 'node:crypto';

/**
 * CPF/CNPJ FICTÍCIOS para dados de demonstração: válidos nos dígitos verificadores (passam na validação) e
 * determinísticos por chave (o mesmo e-mail/slug gera sempre o mesmo número — seeds idempotentes).
 * Nunca usar fora dos seeds.
 */
function digitsFrom(key: string, n: number) {
  const h = createHash('sha256').update(`ridersync-demo:${key}`).digest();
  return Array.from({ length: n }, (_, i) => h[i] % 10);
}

function withCheckDigits(base: number[], weights: (len: number) => number[]) {
  const d = [...base];
  for (const len of [base.length, base.length + 1]) {
    const w = weights(len);
    const rest = d.slice(0, len).reduce((acc, x, i) => acc + x * w[i], 0) % 11;
    d.push(rest < 2 ? 0 : 11 - rest);
  }
  return d.join('');
}

export function fakeCpf(key: string): string {
  const base = digitsFrom(key, 9);
  if (base.every((x) => x === base[0])) base[0] = (base[0] + 1) % 10;
  return withCheckDigits(base, (len) => Array.from({ length: len }, (_, i) => len + 1 - i));
}

export function fakeCnpj(key: string): string {
  const base = [...digitsFrom(key, 8), 0, 0, 0, 1];
  return withCheckDigits(base, (len) => (len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
}
