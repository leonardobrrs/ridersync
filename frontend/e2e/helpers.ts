import { expect, type Browser, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const PASSWORD = 'Senha@E2e2026';
export const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Valor para <input type="datetime-local"> em horário de Maceió (UTC-3), N dias à frente. */
export function localInput(daysAhead: number, hour = 21) {
  const d = new Date(Date.now() + daysAhead * 86400_000);
  d.setUTCHours(hour + 3, 0, 0, 0);
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}

export type AccountKind = 'ARTIST' | 'CONTRACTOR';

/** Cadastro: a tela inicial só tem as duas opções; escolher uma abre o modal com o formulário. */
export async function openSignupModal(page: Page, kind: AccountKind) {
  await page.getByRole('button', { name: kind === 'ARTIST' ? /^Sou artista/ : /^Sou contratante/ }).click();
  const dialog = page.getByRole('dialog', { name: kind === 'ARTIST' ? 'Criar conta de artista' : 'Criar conta de contratante' });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function fillRegistration(page: Page, opts: { name: string; email: string; kind: AccountKind; password?: string }) {
  const password = opts.password ?? PASSWORD;
  await page.goto('/cadastro');
  const dialog = await openSignupModal(page, opts.kind);
  await dialog.getByLabel('Nome', { exact: true }).fill(opts.name);
  await dialog.getByLabel('E-mail', { exact: true }).fill(opts.email);
  await dialog.getByLabel('Senha', { exact: true }).fill(password);
  await dialog.getByLabel('Confirme a senha').fill(password);
  await page.getByRole('checkbox', { name: /Li e aceito os/ }).check();
}

export async function newUser(browser: Browser, name: string, kind: AccountKind = 'ARTIST') {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `${name.split(' ')[0].toLowerCase()}-${stamp()}@e2e.ridersync.dev`;
  await fillRegistration(page, { name, email, kind });
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(kind === 'ARTIST' ? /\/painel\/perfil$/ : /\/painel$/);
  return { page, context, email, name };
}

/** E-mail capturado pelo driver de desenvolvimento do backend (nenhuma mensagem real é enviada). */
export function lastMailTo(to: string): { subject: string; text: string } | null {
  const dir = path.resolve(process.cwd(), '../backend/test-storage/e2e-mail');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const msg = JSON.parse(readFileSync(path.join(dir, files[i]), 'utf8'));
    if (msg.to === to) return msg;
  }
  return null;
}

export async function linkFromMail(to: string, pathPart: string) {
  let found: string | null = null;
  await expect
    .poll(() => {
      const m = lastMailTo(to)?.text.match(/https?:\/\/\S+/g)?.find((u) => u.includes(pathPart)) ?? null;
      found = m;
      return m;
    })
    .not.toBeNull();
  return new URL(found!).pathname + new URL(found!).search;
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
  await page.getByLabel('Cidade (Alagoas)').fill('Maceió');
  await pickChip(page, /Estilos musicais/, 'MPB');
  await pickChip(page, /Formações de show/, 'Solo');
  await page.getByLabel('Instagram').fill('@e2e.artista');
  await page.getByRole('button', { name: 'Criar meu perfil' }).click();
  await toast(page, 'Perfil criado');
  await page.getByRole('button', { name: 'Publicar perfil' }).click();
  await expect(page.getByText('Público no marketplace')).toBeVisible();
}

/** Página sem rolagem horizontal (nada estoura a largura da tela). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `rolagem horizontal em ${page.url()}`).toBeLessThanOrEqual(1);
}
