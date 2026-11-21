export const PLACEHOLDER = '[A PREENCHER]';

/** Marcador de campo ausente com o nome do que falta: "[A PREENCHER: CPF do contratante]". */
export const placeholderFor = (label?: string) => (label ? `[A PREENCHER: ${label}]` : PLACEHOLDER);

/**
 * Substitui cada marcador `{{CAMPO}}` pelo valor correspondente (passada única: o valor inserido nunca é
 * reinterpretado como marcador). Campo ausente (undefined/null) vira "[A PREENCHER: <o que é>]" quando há rótulo
 * para o campo (ou "[A PREENCHER]"); string vazia é mantida de propósito (ex.: representante legal de artista solo).
 */
export function fillTemplate(template: string, data: Record<string, string | null | undefined>, labels: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? placeholderFor(labels[key]));
}

/** Quantos campos ficaram "[A PREENCHER…]" no texto. */
export const countPending = (content: string) => (content.match(/\[A PREENCHER/g) ?? []).length;
