export const PLACEHOLDER = '[A PREENCHER]';

/**
 * Substitui cada marcador `{{CAMPO}}` pelo valor correspondente (passada única: o valor inserido nunca é
 * reinterpretado como marcador). Campo ausente (undefined/null) vira "[A PREENCHER]"; string vazia é mantida
 * de propósito (ex.: representante legal de artista solo).
 */
export function fillTemplate(template: string, data: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? PLACEHOLDER);
}
