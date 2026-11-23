import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'rs-theme';

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Tema efetivo: a escolha salva no navegador ou, sem escolha, a preferência do sistema. */
export function currentTheme(): Theme {
  return stored() ?? system();
}

/** Aplica o tema no <html data-theme> — os tokens de cor do CSS (global.css) seguem o atributo. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#060708' : '#151719');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  // Sem escolha salva, acompanha a troca de tema do sistema.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => {
      if (!stored()) setTheme(system());
    };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* navegação privada: vale só nesta visita */
      }
      return next;
    });
  }, []);
  return { theme, toggle };
}
