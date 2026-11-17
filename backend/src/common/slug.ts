import { randomBytes } from 'node:crypto';

export function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'perfil';
}

/** Gera slug único verificando existência por callback (sem expor IDs internos). */
export async function uniqueSlug(name: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(name);
  if (!(await exists(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomBytes(3).toString('hex')}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${randomBytes(6).toString('hex')}`;
}
