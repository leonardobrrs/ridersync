import { z } from 'zod';
import { isValidCnpj, isValidCpf, onlyDigits } from './documents';
import { PASSWORD_RULES } from './password-policy';
import { AL_CITIES, FORMATS, GENRES, INSTRUMENTS, UF } from './domain-lists';

/** Texto obrigatório com trim. */
export const text = (min: number, max: number, label = 'Campo') =>
  z
    .string({ error: `${label} é obrigatório.` })
    .trim()
    .min(min, min <= 1 ? `${label} é obrigatório.` : `${label} deve ter ao menos ${min} caracteres.`)
    .max(max, `${label} deve ter no máximo ${max} caracteres.`);

/** Texto opcional: string vazia vira null. */
export const optionalText = (max: number, label = 'Campo') =>
  z
    .string()
    .trim()
    .max(max, `${label} deve ter no máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?$)/i;

/** URL externa validada: somente https, host público, sem credenciais embutidas. */
export const externalUrl = z
  .string()
  .trim()
  .max(2048, 'Link muito longo.')
  .refine((value) => {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && !PRIVATE_HOST.test(u.hostname);
    } catch {
      return false;
    }
  }, 'Informe um link válido começando com https:// (ex.: https://youtube.com/...).');

export const optionalExternalUrl = z
  .union([z.literal(''), externalUrl])
  .nullish()
  .transform((v) => (v ? v : null));

export const email = z
  .string({ error: 'E-mail é obrigatório.' })
  .trim()
  .toLowerCase()
  .max(254, 'E-mail muito longo.')
  .pipe(z.email('E-mail inválido.'));

export const optionalEmail = z
  .union([z.literal(''), email])
  .nullish()
  .transform((v) => (v ? v : null));

export const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === '' || /^[0-9()+\-\s]{8,20}$/.test(v), 'Telefone inválido.')
  .nullish()
  .transform((v) => (v ? v : null));

/** CPF opcional: aceita máscara, valida os dígitos verificadores e guarda só os 11 dígitos. Vazio vira null. */
export const optionalCpf = z
  .union([z.literal(''), z.string().trim().max(14).refine(isValidCpf, 'CPF inválido.').transform(onlyDigits)])
  .nullish()
  .transform((v) => (v ? v : null));

/** CPF obrigatório (cadastro): aceita máscara, valida os dígitos verificadores e guarda só os 11 dígitos. */
export const requiredCpf = z
  .string({ error: 'Informe o CPF.' })
  .trim()
  .min(1, 'Informe o CPF.')
  .max(14)
  .refine(isValidCpf, 'CPF inválido.')
  .transform(onlyDigits);

/** CNPJ obrigatório (casa de show): aceita máscara, valida os dígitos verificadores e guarda só os 14 dígitos. */
export const requiredCnpj = z
  .string({ error: 'Informe o CNPJ.' })
  .trim()
  .min(1, 'Informe o CNPJ.')
  .max(18)
  .refine(isValidCnpj, 'CNPJ inválido.')
  .transform(onlyDigits);

/** CNPJ opcional: aceita máscara, valida os dígitos verificadores e guarda só os 14 dígitos. Vazio vira null. */
export const optionalCnpj = z
  .union([z.literal(''), z.string().trim().max(18).refine(isValidCnpj, 'CNPJ inválido.').transform(onlyDigits)])
  .nullish()
  .transform((v) => (v ? v : null));

export const optionalInstagram = z
  .string()
  .trim()
  .max(31)
  .transform((v) => v.replace(/^@/, ''))
  .refine((v) => v === '' || /^[A-Za-z0-9._]{1,30}$/.test(v), 'Usuário do Instagram inválido.')
  .nullish()
  .transform((v) => (v ? v : null));

export const genres = z
  .array(z.enum(GENRES, { error: 'Estilo musical inválido.' }))
  .max(6, 'Escolha no máximo 6 estilos.')
  .transform((a) => [...new Set(a)]);
export const formats = z.array(z.enum(FORMATS, { error: 'Formação inválida.' })).transform((a) => [...new Set(a)]);
export const instruments = z
  .array(z.enum(INSTRUMENTS, { error: 'Instrumento inválido.' }))
  .max(8)
  .transform((a) => [...new Set(a)]);
export const uf = z.enum(UF, { error: 'No momento, o RiderSync atende apenas Alagoas (AL).' });

export const uuid = z.uuid('Identificador inválido.');

export const moneyCents = z.number().int('Valor inválido.').min(0, 'Valor não pode ser negativo.').max(100_000_000);

export const password = PASSWORD_RULES.reduce(
  (schema, rule) => schema.refine(rule.test, rule.message),
  z.string({ error: 'Senha é obrigatória.' }).max(128, 'A senha deve ter no máximo 128 caracteres.'),
);

/** Senha + confirmação: o objeto que usa este par deve aplicar `passwordsMatch`. */
export const passwordsMatch = <T extends { password: string; passwordConfirmation: string }>(v: T) => v.password === v.passwordConfirmation;
export const passwordsMatchError = { path: ['passwordConfirmation'], message: 'As senhas não conferem.' };

const normalizeCity = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .toLowerCase()
    .trim();
const CITY_BY_KEY = new Map(AL_CITIES.map((c) => [normalizeCity(c), c]));

/** Município de Alagoas, normalizado para o nome oficial (aceita variações de acento/caixa). */
export const alCity = z
  .string({ error: 'Cidade é obrigatória.' })
  .trim()
  .max(80)
  .transform((v, ctx) => {
    const canonical = CITY_BY_KEY.get(normalizeCity(v));
    if (!canonical) {
      ctx.addIssue({ code: 'custom', message: 'Escolha um município de Alagoas da lista.' });
      return z.NEVER;
    }
    return canonical;
  });
export const optionalAlCity = z
  .union([z.literal(''), alCity])
  .nullish()
  .transform((v) => (v ? v : null));

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
};

/**
 * Filtros com vários valores na query string: aceita "a,b" (formato usado pelo frontend) ou o parâmetro repetido
 * (?a=1&a=2). Vazio = sem filtro. Dentro de um filtro os valores se combinam por OU.
 */
const splitList = (v: unknown) => {
  if (v === undefined || v === null || v === '') return undefined;
  const items = (Array.isArray(v) ? v : String(v).split(',')).map((s) => String(s).trim()).filter(Boolean);
  return items.length ? [...new Set(items)] : undefined;
};
export const multiEnum = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess(splitList, z.array(z.enum(values)).max(values.length).optional());
export const multiText = (maxItems = 30) => z.preprocess(splitList, z.array(z.string().max(80)).max(maxItems).optional());
