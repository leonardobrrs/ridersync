import { expect, test } from '@playwright/test';
import { createPublicMusicianProfile, localInput, newUser, stamp } from './helpers';

/** Reunião com o professor (19/11). Desktop. */

test('home: sem botão "Casas de show" no topo e busca que filtra enquanto se digita', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Casas de show' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: /Buscar músicos/ }).fill('forró');
  // sem Enter: a URL e o título mudam sozinhos
  await expect(page).toHaveURL(/\?q=forr%C3%B3/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Resultados para “forró”');
});

test('evento oculto na tela única de criação, com convite já na criação', async ({ browser }) => {
  const artist = await newUser(browser, 'Oto Oculto');
  const artistName = `Oto Oculto ${stamp()}`;
  await createPublicMusicianProfile(artist.page, artistName);
  const contractor = await newUser(browser, 'Cora Contrata', 'CONTRACTOR');
  const page = contractor.page;
  const title = `Festa oculta ${stamp()}`;

  // Contratante: "Meus eventos" no topo (no lugar de "Eventos encerrados")
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Meus eventos' }).click();
  await expect(page.getByRole('heading', { name: 'Meus eventos' })).toBeVisible();
  await page.getByRole('link', { name: 'Novo evento' }).click();
  await expect(page.getByLabel('Onde será o evento?')).toHaveValue('INDIVIDUAL');
  await page.getByLabel('Título').fill(title);
  await page.locator('.seg label', { hasText: 'Oculto' }).click();
  await expect(page.getByText('Só você e os artistas que você convidar veem o evento')).toBeVisible();
  await page.getByLabel('Cidade (Alagoas)').fill('Maceió');
  await page.getByLabel('Data e horário da apresentação').fill(localInput(60));
  await page.getByLabel('Prazo de candidatura').fill(localInput(50, 23));
  await page.getByLabel('Duração (min)').fill('90');
  await page.getByLabel('Cachê oferecido (R$)').fill('700');
  await page.getByLabel('Observações').fill('Entrada pelos fundos.');
  await page.getByLabel('Convidar artistas').fill(artistName.split(' ').slice(0, 3).join(' '));
  await page.getByRole('checkbox', { name: new RegExp(artistName) }).click();
  // escolhido: a busca se limpa para procurar outro artista
  await expect(page.getByLabel('Convidar artistas')).toHaveValue('');
  await expect(page.getByRole('list', { name: 'Artistas convidados' })).toContainText(artistName);
  await page.getByRole('button', { name: 'Publicar e enviar convites' }).click();

  await expect(page).toHaveURL(/\/painel\/eventos\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.locator('.st', { hasText: 'Oculto' }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Convites diretos' }).getByRole('link', { name: artistName })).toBeVisible();
  await expect(page.getByText('Entrada pelos fundos.')).toBeVisible();

  // O convidado recebe a proposta e enxerga o evento; não aparece nas oportunidades
  await artist.page.goto('/painel/negociacoes');
  await artist.page.getByRole('link', { name: new RegExp(title) }).click();
  await artist.page.getByRole('link', { name: title }).click();
  await expect(artist.page.getByText('Evento oculto (só convidados)')).toBeVisible();
  await artist.page.goto('/oportunidades');
  await expect(artist.page.getByRole('link', { name: title })).toHaveCount(0);

  await artist.context.close();
  await contractor.context.close();
});
