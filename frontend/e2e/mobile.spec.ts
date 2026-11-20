import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, fillRegistration, stamp } from './helpers';

test('celular: navegação inferior, filtros em diálogo, cadastro e menu do painel', async ({ page }) => {
  await page.goto('/');
  const tabbar = page.getByRole('navigation', { name: 'Atalhos' });
  await expect(tabbar).toBeVisible();
  await page.getByRole('button', { name: /Filtros/ }).click();
  await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver resultados' }).click();

  await tabbar.getByRole('button', { name: 'Explorar' }).click();
  await page.getByRole('dialog', { name: 'Explorar' }).getByRole('link', { name: /Casas de show/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Casas de show');
  await tabbar.getByRole('link', { name: 'Vagas' }).click();
  await expect(page.getByRole('heading', { name: 'Oportunidades de apresentação' })).toBeVisible();

  await fillRegistration(page, { name: 'Mobi Le', email: `mobile-${stamp()}@e2e.ridersync.dev`, kind: 'ARTIST' });
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel\/perfil$/);
  await expect(page.getByRole('heading', { name: 'Criar perfil individual' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await tabbar.getByRole('link', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Painel' }).getByRole('link', { name: 'Notificações' }).click();
  await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible();
  await page.getByRole('button', { name: /Notificações/ }).click();
  await expect(page.getByRole('dialog', { name: 'Notificações recentes' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
