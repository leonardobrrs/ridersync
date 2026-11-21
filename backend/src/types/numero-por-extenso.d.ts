declare module 'numero-por-extenso' {
  export const estilo: { readonly normal: 'normal'; readonly monetario: 'monetario'; readonly porcentagem: 'porcentagem' };
  export function porExtenso(valor: number | string, estilo?: 'normal' | 'monetario' | 'porcentagem'): string;
}
