import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, currentTheme } from './theme';

describe('tema claro/escuro', () => {
  afterEach(() => localStorage.clear());

  it('usa a escolha salva no navegador', () => {
    localStorage.setItem('rs-theme', 'dark');
    expect(currentTheme()).toBe('dark');
    localStorage.setItem('rs-theme', 'light');
    expect(currentTheme()).toBe('light');
  });

  it('sem escolha (ou valor inválido) segue o sistema', () => {
    localStorage.setItem('rs-theme', 'roxo');
    expect(['light', 'dark']).toContain(currentTheme());
  });

  it('aplica o tema no <html data-theme>', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
