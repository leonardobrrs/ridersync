import { expect, type Browser, type Page } from '@playwright/test';

export const PASSWORD = 'senha-e2e-segura';
export const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Valor para <input type="datetime-local"> em horário de Maceió (UTC-3), N dias à frente. */
export function localInput(daysAhead: number, hour = 21) {
  const d = new Date(Date.now() + daysAhead * 86400_000);
  d.setUTCHours(hour + 3, 0, 0, 0);
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}

export async function newUser(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  const email = `${name.split(' ')[0].toLowerCase()}-${stamp()}@e2e.ridersync.dev`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Olá');
  return { page, context, email, name };
}

export async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator('.toast')).toContainText(text);
}

export async function pickChip(page: Page, group: RegExp, option: string) {
  await page.getByRole('group', { name: group }).getByText(option, { exact: true }).click();
}

export async function createPublicMusicianProfile(page: Page, artisticName: string) {
  await page.goto('/painel/perfil');
  await page.getByLabel('Nome artístico').fill(artisticName);
  await page.getByLabel('Descrição').fill('Cantora e violonista alagoana com repertório autoral de MPB e forró pé-de-serra.');
  await page.getByLabel('Cidade').fill('Maceió');
  await pickChip(page, /Estilos musicais/, 'MPB');
  await pickChip(page, /Formações de show/, 'Solo');
  await page.getByLabel('Instagram').fill('@e2e.artista');
  await page.getByRole('button', { name: 'Criar meu perfil' }).click();
  await toast(page, 'Perfil criado');
  await page.getByRole('button', { name: 'Publicar perfil' }).click();
  await expect(page.getByText('Público no marketplace')).toBeVisible();
}
