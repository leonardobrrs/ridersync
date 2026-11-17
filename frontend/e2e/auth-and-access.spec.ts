import { expect, test } from '@playwright/test';
import { newUser, PASSWORD } from './helpers';

test('visitante navega no marketplace e é levado ao login ao acessar o painel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Músicos e bandas' })).toBeVisible();
  await page.getByRole('link', { name: 'Oportunidades' }).first().click();
  await expect(page.getByRole('heading', { name: 'Oportunidades de apresentação' })).toBeVisible();
  await page.goto('/painel/negociacoes');
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel%2Fnegociacoes/);
});

test('cadastro, logout, erro de credenciais e login com retorno à página original', async ({ browser }) => {
  const { page, email } = await newUser(browser, 'Lara Login');
  await page.getByRole('button', { name: /Lara/ }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible();

  await page.goto('/painel/conta');
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-errada-000');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos');

  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel\/conta$/);
  await expect(page.getByText(email)).toBeVisible();
});

test('validação do formulário de cadastro no cliente', async ({ page }) => {
  await page.goto('/cadastro');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByText('Informe seu nome')).toBeVisible();
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
});
