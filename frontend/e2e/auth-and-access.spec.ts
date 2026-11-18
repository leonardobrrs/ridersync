import { expect, test } from '@playwright/test';
import { fillRegistration, linkFromMail, newUser, PASSWORD, stamp, toast } from './helpers';

test('visitante: página inicial em português, rodapé sem botão de API e documentação funcionando; painel exige login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Categorias' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('em Alagoas');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'API' })).toHaveCount(0);
  await footer.getByRole('link', { name: 'Documentação' }).click();
  await expect(page.getByRole('heading', { name: 'Documentação e ajuda' })).toBeVisible();
  await page.goto('/privacidade');
  await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible();
  await page.goto('/painel/negociacoes');
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel%2Fnegociacoes/);
});

test('visitante encontra e pesquisa casas de show', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Categorias' }).getByRole('button', { name: 'Casas de show' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Casas de show');
  await page.goto('/casas');
  await expect(page.getByRole('searchbox', { name: 'Buscar casa de show' })).toBeVisible();
});

test('cadastro: tipo de conta obrigatório, senha forte com confirmação, olho alterna visibilidade', async ({ page }) => {
  await page.goto('/cadastro');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByText('Escolha se você é artista ou contratante.')).toBeVisible();
  await expect(page.getByText('Informe seu nome')).toBeVisible();
  await expect(page.getByText('É preciso aceitar os Termos de Uso')).toBeVisible();

  const senha = page.getByLabel('Senha', { exact: true });
  await senha.fill('fraca');
  const rules = page.getByRole('list', { name: 'Requisitos da senha' });
  await expect(rules.getByText('(pendente)')).toHaveCount(4);
  await senha.fill('Forte@123');
  await expect(rules.getByText('(atendido)')).toHaveCount(4);

  await expect(senha).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Mostrar senha' }).first().click();
  await expect(senha).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar senha' }).first().click();
  await expect(senha).toHaveAttribute('type', 'password');

  await page.getByLabel('Confirme a senha').fill('Outra@123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByText('As senhas não conferem.')).toBeVisible();
});

test('cadastro, confirmação de e-mail por link, logout, erro de credenciais e login com retorno', async ({ browser }) => {
  const { page, email } = await newUser(browser, 'Lara Login', 'CONTRACTOR');
  await expect(page.getByText('Confirme seu e-mail.')).toBeVisible();

  const verify = await linkFromMail(email, '/verificar-email');
  await page.goto(verify);
  await expect(page.getByRole('heading', { name: 'E-mail confirmado' })).toBeVisible();
  await page.goto('/painel');
  await expect(page.getByText('Confirme seu e-mail.')).toHaveCount(0);

  await page.getByRole('button', { name: /Lara/ }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible();

  await page.goto('/painel/conta');
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('Errada@000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos');

  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/painel\/conta$/);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText('confirmado', { exact: true })).toBeVisible();
});

test('recuperação de senha por e-mail encerra a sessão antiga e permite entrar com a nova', async ({ browser }) => {
  const { page, email, context } = await newUser(browser, 'Rui Recupera');
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto('/esqueci-senha');
  await p2.getByLabel('E-mail').fill(email);
  await p2.getByRole('button', { name: 'Enviar link' }).click();
  await expect(p2.getByText('Se houver uma conta com este e-mail')).toBeVisible();

  await p2.goto(await linkFromMail(email, '/redefinir-senha'));
  await p2.getByLabel('Nova senha', { exact: true }).fill('Nova@Senha2026');
  await p2.getByLabel('Confirme a nova senha').fill('Nova@Senha2026');
  await p2.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(p2).toHaveURL(/\/entrar$/);
  await p2.getByLabel('E-mail').fill(email);
  await p2.getByLabel('Senha', { exact: true }).fill('Nova@Senha2026');
  await p2.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(p2).toHaveURL(/\/painel/);

  await page.goto('/painel/conta');
  await expect(page).toHaveURL(/\/entrar/);
  await context.close();
  await other.close();
});

test('LGPD: exportação disponível e exclusão de conta com confirmação e contagem regressiva', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `apaga-${stamp()}@e2e.ridersync.dev`;
  await fillRegistration(page, { name: 'Ana Apaga', email, kind: 'ARTIST' });
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel\/perfil$/);
  await page.goto('/painel/conta');
  await expect(page.getByRole('button', { name: 'Baixar cópia' })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir conta' }).click();
  const dlg = page.getByRole('dialog', { name: 'Excluir conta' });
  await dlg.getByLabel('Sua senha').fill(PASSWORD);
  await dlg.getByLabel('Digite "EXCLUIR" para confirmar').fill('EXCLUIR');
  const final = dlg.getByRole('button', { name: /Excluir definitivamente/ });
  await expect(final).toBeDisabled();
  await expect(final).toBeEnabled({ timeout: 5000 });
  await final.click();
  await toast(page, 'Sua conta foi excluída');
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos');
  await context.close();
});
