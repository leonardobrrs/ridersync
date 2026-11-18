/**
 * Telefone brasileiro com máscara automática enquanto se digita:
 *   fixo    (82) 3333-4444     → 10 dígitos
 *   celular (82) 99999-8888    → 11 dígitos (o formato muda sozinho ao digitar o 11º dígito)
 * Aceita colar com +55/55 na frente. O valor salvo é o texto formatado (o backend aceita dígitos, espaço,
 * parênteses, hífen e +).
 */
export function phoneDigits(value: string): string {
  let d = value.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

export function maskPhoneBR(value: string): string {
  const d = phoneDigits(value);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (d.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** Vazio ou telefone completo: 10 dígitos (fixo) ou 11 começando com 9 após o DDD (celular). DDD não começa com 0. */
export function isValidPhoneBR(value: string): boolean {
  const d = phoneDigits(value);
  if (d.length === 0) return value.trim() === '';
  if (d[0] === '0') return false;
  return d.length === 10 || (d.length === 11 && d[2] === '9');
}

/** Exibição: formata telefones completos; valores antigos em outro formato aparecem como foram salvos. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  const d = phoneDigits(value);
  return d.length === 10 || d.length === 11 ? maskPhoneBR(d) : value;
}
