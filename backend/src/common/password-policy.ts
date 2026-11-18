/** Política de senha: 8+ caracteres, ao menos uma maiúscula, um número e um caractere especial. */
export const PASSWORD_RULES = [
  { test: (v: string) => v.length >= 8, message: 'A senha deve ter ao menos 8 caracteres.' },
  { test: (v: string) => /[A-Z]/.test(v), message: 'A senha deve conter ao menos uma letra maiúscula.' },
  { test: (v: string) => /[0-9]/.test(v), message: 'A senha deve conter ao menos um número.' },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), message: 'A senha deve conter ao menos um caractere especial.' },
] as const;
