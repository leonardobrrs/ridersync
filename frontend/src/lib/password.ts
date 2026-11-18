import { z } from 'zod';

/** Espelho da política do servidor (backend/src/common/password-policy.ts). O servidor sempre revalida. */
export const PASSWORD_RULES = [
  { label: 'Ao menos 8 caracteres', message: 'A senha deve ter ao menos 8 caracteres.', test: (v: string) => v.length >= 8 },
  { label: 'Uma letra maiúscula', message: 'A senha deve conter ao menos uma letra maiúscula.', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Um número', message: 'A senha deve conter ao menos um número.', test: (v: string) => /[0-9]/.test(v) },
  { label: 'Um caractere especial (ex.: @ # ! %)', message: 'A senha deve conter ao menos um caractere especial.', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const strongPassword = PASSWORD_RULES.reduce(
  (s, r) => s.refine(r.test, r.message),
  z.string().max(128, 'A senha deve ter no máximo 128 caracteres.'),
);

/**
 * Verificação "as senhas conferem" que roda mesmo com outros campos ainda inválidos
 * (por padrão o Zod só executa refinamentos de objeto quando todos os campos passam).
 */
export const matchesWhenBothFilled = <K extends string>(a: K, b: K) => ({
  path: [b],
  message: 'As senhas não conferem.',
  when: (payload: { value: unknown }) => {
    const v = payload.value as Record<string, unknown> | undefined;
    return typeof v?.[a] === 'string' && typeof v?.[b] === 'string' && (v[b] as string).length > 0;
  },
});
