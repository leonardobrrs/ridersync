import { expect, test } from '@playwright/test';
import { PASSWORD, stamp } from './helpers';

test('celular: navegação inferior, filtros em diálogo e painel responsivo', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  const tabbar = page.getByRole('navigation', { name: 'Atalhos' });
  await expect(tabbar).toBeVisible();
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver resultados' }).click();

  await tabbar.getByRole('link', { name: 'Vagas' }).click();
  await expect(page.getByRole('heading', { name: 'Oportunidades de apresentação' })).toBeVisible();

  await tabbar.getByRole('link', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: 'Criar conta' }).last().click();
  await page.getByLabel('Nome', { exact: true }).fill('Mobi Le');
  await page.getByLabel('E-mail', { exact: true }).fill(`mobile-${stamp()}@e2e.ridersync.dev`);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await tabbar.getByRole('link', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Painel' }).getByRole('link', { name: 'Meu perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Criar perfil individual' })).toBeVisible();

  // sem rolagem horizontal da página
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
