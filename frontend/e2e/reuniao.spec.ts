import { expect, test } from '@playwright/test';
import { createPublicMusicianProfile, newUser, stamp } from './helpers';

/** Ajustes da reunião de 18/11 (desktop). Responsividade no celular: responsive.spec.ts. */

test('menu do perfil fecha ao clicar fora e com Esc', async ({ browser }) => {
  const u = await newUser(browser, 'Mel Menu');
  const page = u.page;
  await page.goto('/');
  const trigger = page.locator('button[aria-haspopup="menu"]');
  const menu = page.getByRole('menu');
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await expect(menu).toHaveCount(0);
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await u.context.close();
});

test('feed por tipo de conta: artista vê oportunidades e casas; contratante vê artistas e não vê oportunidades', async ({ browser }) => {
  const artist = await newUser(browser, 'Ari Feed');
  const artistName = `Ari Feed ${stamp()}`;
  await createPublicMusicianProfile(artist.page, artistName);
  const contractor = await newUser(browser, 'Cid Feed', 'CONTRACTOR');

  // Artista: "Para você" com oportunidades e casas; nenhum card de artista.
  await artist.page.goto('/');
  await expect(artist.page.getByRole('button', { name: 'Para você' })).toHaveAttribute('aria-pressed', 'true');
  await expect(artist.page.getByRole('heading', { level: 1 })).toContainText('Oportunidades e casas de show');
  await expect(artist.page.getByRole('region', { name: 'Oportunidades abertas' })).toBeVisible();
  await expect(artist.page.locator('article.ad a[href^="/artistas/"]')).toHaveCount(0);
  // A aba Músicos continua listando os perfis normalmente.
  await artist.page.getByRole('button', { name: 'Músicos' }).click();
  await expect(artist.page.getByRole('heading', { level: 1 })).toContainText('Músicos');
  await expect(artist.page.locator('article.ad a[href^="/artistas/"]').first()).toBeVisible();
  // A busca por texto mostra artistas também para contas de artista.
  await artist.page.goto(`/?q=${encodeURIComponent(artistName)}`);
  await expect(artist.page.getByRole('link', { name: new RegExp(`${artistName} — ver perfil`) })).toBeVisible();

  // Contratante: artistas para contratar, sem oportunidades (nem no menu principal).
  await contractor.page.goto('/');
  await expect(contractor.page.getByRole('heading', { level: 1 })).toContainText('Músicos e bandas para contratar');
  await expect(contractor.page.locator('article.ad a[href^="/artistas/"]').first()).toBeVisible();
  await expect(contractor.page.getByText('Oportunidades abertas')).toHaveCount(0);
  await expect(contractor.page.locator('.opp-card')).toHaveCount(0);
  await expect(contractor.page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Oportunidades' })).toHaveCount(0);
  await expect(contractor.page.getByRole('link', { name: 'Publicar evento' })).toBeVisible();

  await artist.context.close();
  await contractor.context.close();
});

test('telefone com máscara automática e casa de show acessível pelo menu do perfil', async ({ browser }) => {
  const u = await newUser(browser, 'Tel Casa', 'CONTRACTOR');
  const page = u.page;
  const venue = `Casa Máscara ${stamp()}`;
  await page.goto('/painel/casas');
  await page.getByRole('button', { name: 'Cadastrar casa' }).click();
  await page.getByLabel('Nome do estabelecimento').fill(venue);
  const phone = page.getByLabel('Telefone/WhatsApp');
  await phone.pressSequentially('8233334444');
  await expect(phone).toHaveValue('(82) 3333-4444');
  await phone.fill('');
  await phone.pressSequentially('82999998888');
  await expect(phone).toHaveValue('(82) 99999-8888');
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(venue);
  const venueUrl = page.url();

  await page.goto('/');
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: new RegExp(venue) }).click();
  await expect(page).toHaveURL(venueUrl);
  await u.context.close();
});
