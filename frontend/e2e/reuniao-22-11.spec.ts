import { expect, test, type Page } from '@playwright/test';
import { createPublicMusicianProfile, localInput, newUser, stamp, toast, validCnpj } from './helpers';

/** Escrita pela API com a sessão do próprio navegador (o cabeçalho é exigido em toda escrita). */
async function apiWrite(page: Page, method: 'post' | 'put' | 'patch', url: string, data: object) {
  const res = await page.request[method](url, { data, headers: { 'X-Requested-With': 'RiderSync' } });
  expect(res.ok(), `${method.toUpperCase()} ${url}: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json();
}

test('tema claro/escuro: botão no topo alterna e a escolha fica salva', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const start = await html.getAttribute('data-theme');
  expect(['light', 'dark']).toContain(start);
  const other = start === 'dark' ? 'light' : 'dark';
  await page.getByRole('button', { name: other === 'dark' ? 'Usar tema escuro' : 'Usar tema claro' }).click();
  await expect(html).toHaveAttribute('data-theme', other);
  // cores vêm dos tokens: o fundo muda junto
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', other);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(bg);
  await page.getByRole('button', { name: other === 'dark' ? 'Usar tema claro' : 'Usar tema escuro' }).click();
  await expect(html).toHaveAttribute('data-theme', start!);
});

test('contraproposta direto da lista de oportunidades; contratante responde e a tela do artista atualiza sozinha', async ({ browser }) => {
  const id = stamp();
  const contractor = await newUser(browser, 'Cida Contrata', 'CONTRACTOR');
  const artist = await newUser(browser, 'Davi Contrapõe', 'ARTIST');
  await createPublicMusicianProfile(artist.page, `Davi Som ${id}`);
  const venue = await apiWrite(contractor.page, 'post', '/api/organizations', { name: `Casa 22-11 ${id}`, city: 'Maceió', cnpj: validCnpj() });
  const title = `Noite 22-11 ${id}`;
  const toIso = (local: string) => new Date(`${local}:00-03:00`).toISOString();
  const ev = await apiWrite(contractor.page, 'post', `/api/organizations/${venue.id}/events`, {
    title,
    startsAt: toIso(localInput(40)),
    applicationDeadline: toIso(localInput(30, 23)),
    slots: 1,
    feeCents: 80000,
    durationMinutes: 60,
  });
  await apiWrite(contractor.page, 'post', `/api/events/${ev.id}/transition`, { action: 'publish' });

  // Lista de oportunidades: o card já oferece a contraproposta.
  await artist.page.goto('/oportunidades');
  const card = artist.page.locator('article.opp-card', { hasText: title });
  await card.getByRole('link', { name: 'Contraproposta' }).click();
  const dlg = artist.page.getByRole('dialog', { name: `Candidatura — ${title}` });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('radio', { name: /Quero propor outro cachê/ })).toBeChecked();
  await dlg.getByLabel('Cachê que você propõe (R$)').fill('1.500,00');
  await dlg.getByRole('button', { name: 'Revisar e enviar' }).click();
  const review = artist.page.getByRole('dialog', { name: 'Confirme sua candidatura' });
  await expect(review).toContainText('Você está se candidatando a');
  await expect(review).toContainText('contraproposta de cachê de R$ 1.500');
  await review.getByRole('button', { name: 'Confirmar candidatura' }).click();
  await toast(artist.page, 'contraproposta');
  await expect(artist.page).toHaveURL(/\/painel\/candidaturas$/);
  const myCard = artist.page.locator('article.card', { hasText: title });
  await expect(myCard).toBeVisible();
  await expect(myCard.getByRole('link', { name: /Negociação/ })).toHaveCount(0);

  // Contratante vê a contraproposta; "contratar nas condições" fica bloqueado; seleciona sem redigitar valores.
  await contractor.page.goto(`/painel/eventos/${ev.id}`);
  await expect(contractor.page.getByText('Contraproposta de cachê: R$ 1.500')).toBeVisible();
  await expect(contractor.page.getByRole('button', { name: 'Contratar nas condições' })).toBeDisabled();
  await contractor.page.getByRole('button', { name: 'Selecionar e negociar' }).click();
  const sure = contractor.page.getByRole('dialog', { name: 'Confirmar ação' });
  await expect(sure).toContainText('contraproposta');
  await sure.getByRole('button', { name: 'Abrir negociação' }).click();
  await expect(contractor.page).toHaveURL(/\/painel\/negociacoes\//);
  await expect(contractor.page.getByRole('button', { name: 'Aceitar proposta' })).toBeVisible();

  // Tempo real: a página de candidaturas do artista (aberta, sem reload) passa a mostrar a negociação.
  await expect(myCard.getByRole('link', { name: /Negociação/ })).toBeVisible({ timeout: 15_000 });

  // Negociações: em andamento, histórico e todas.
  await artist.page.goto('/painel/negociacoes');
  await expect(artist.page.getByRole('tab', { name: /Em andamento/ })).toHaveAttribute('aria-selected', 'true');
  await expect(artist.page.locator('a.card', { hasText: title })).toBeVisible();
  await artist.page.getByRole('tab', { name: /Histórico/ }).click();
  await expect(artist.page.locator('a.card', { hasText: title })).toHaveCount(0);
  await artist.page.getByRole('tab', { name: /Todas/ }).click();
  await expect(artist.page.locator('a.card', { hasText: title })).toBeVisible();

  await contractor.context.close();
  await artist.context.close();
});
