import { useSyncExternalStore } from 'react';

/** Acompanha uma media query CSS (ex.: '(max-width: 900px)'). Fora do navegador assume `false`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Mesmo ponto de quebra da barra inferior e do layout de celular/tablet no CSS. */
export const MOBILE_QUERY = '(max-width: 900px)';
