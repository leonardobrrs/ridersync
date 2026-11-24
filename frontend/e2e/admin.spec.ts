import { expect, test } from '@playwright/test';
import { newUser, toast } from './helpers';

/** Painel /adm: sem link no sistema, login próprio e exclusão definitiva de dados de teste. */
test('administração: login próprio, busca e exclusão de conta', async ({ browser, page }) => {
  const victim = await newUser(browser, 'Conta Descartavel');
  await victim.context.close();

  // O site não tem nenhum link para o painel.
  await page.goto('/');
  await expect(page.locator('a[href="/adm"]')).toHaveCount(0);

  await page.goto('/adm');
  const form = page.getByRole('form', { name: 'Entrar no painel de administração' });
  await form.getByLabel('Usuário').fill('adm-teste');
  await form.getByLabel('Senha', { exact: true }).fill('errada');
  await form.getByRole('button', { name: 'Entrar' }).click();
  await expect(form.getByRole('alert')).toContainText('Usuário ou senha inválidos');
  await form.getByLabel('Senha', { exact: true }).fill('Painel@Teste2026');
  await form.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('tab', { name: 'Contas' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar em Contas' }).fill(victim.email);
  const row = page.getByRole('row', { name: new RegExp(victim.email.replace(/[.+]/g, '\\$&')) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Excluir' }).click();
  const dlg = page.getByRole('dialog', { name: 'Excluir conta?' });
  await expect(dlg).toContainText('Esta ação não pode ser desfeita');
  await dlg.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await toast(page, 'Excluído');
  await expect(page.getByText('Nada encontrado.')).toBeVisible();

  // A conta não existe mais.
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(victim.email);
  await page.getByLabel('Senha', { exact: true }).fill('Senha@E2e2026');
  await page.getByLabel('Senha', { exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toContainText(/inválid|incorret/i);
  await expect(page).toHaveURL(/\/entrar/);

  // Sair encerra a sessão do painel.
  await page.goto('/adm');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('form', { name: 'Entrar no painel de administração' })).toBeVisible();
});
