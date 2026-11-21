/** CPF/CNPJ no formulário: máscara progressiva e validação dos dígitos verificadores (espelha o backend). */

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

const allSame = (d: string) => /^(\d)\1+$/.test(d);

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSame(d)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[len])) return false;
  }
  return true;
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || allSame(d)) return false;
  for (const len of [12, 13]) {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i];
    const rest = sum % 11;
    if ((rest < 2 ? 0 : 11 - rest) !== Number(d[len])) return false;
  }
  return true;
}

/** Máscara progressiva: "5299" → "529.9"; completo → "529.982.247-25". Aceita valor já formatado. */
export function maskCpf(value: string | null | undefined): string {
  const d = onlyDigits(value ?? '').slice(0, 11);
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join('.');
  return d.length > 9 ? `${p}-${d.slice(9)}` : p;
}

/** Máscara progressiva do CNPJ: completo → "11.222.333/0001-81". */
export function maskCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value ?? '').slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `.${d.slice(2, 5)}`;
  if (d.length > 5) out += `.${d.slice(5, 8)}`;
  if (d.length > 8) out += `/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12)}`;
  return out;
}
