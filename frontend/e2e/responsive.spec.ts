import { expect, test } from '@playwright/test';
import { createPublicMusicianProfile, expectNoHorizontalOverflow, newUser, stamp } from './helpers';

/**
 * Executado nos projetos desktop, tablet (820 px) e celular (Pixel 7): nenhuma página principal
 * pode ter rolagem horizontal, e os elementos de navegação essenciais precisam estar acessíveis.
 */
const PUBLIC_PAGES = ['/', '/?kind=VENUE', '/oportunidades', '/casas', '/entrar', '/cadastro', '/esqueci-senha', '/privacidade', '/termos', '/ajuda'];

test('páginas públicas sem rolagem horizontal e com título visível', async ({ page }) => {
  for (const url of PUBLIC_PAGES) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('perfil público do artista (abas) e painel autenticado sem rolagem horizontal', async ({ browser }) => {
  const artist = await newUser(browser, 'Rafa Responsivo');
  const name = `Responsivo ${stamp()} Nome Artístico Bem Comprido Para Testar Quebra`;
  await createPublicMusicianProfile(artist.page, name);
  const page = artist.page;
  for (const url of ['/painel', '/painel/perfil', '/painel/bandas', '/painel/notificacoes', '/painel/notificacoes/preferencias', '/painel/conta', '/painel/agenda', '/painel/negociacoes', '/painel/candidaturas']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.goto(`/?q=${encodeURIComponent(name.split(' ').slice(0, 2).join(' '))}`);
  await page.getByRole('link', { name: /ver perfil/ }).first().click();
  for (const tab of ['Portfólio', 'Rider técnico', 'Sobre']) {
    await page.getByRole('tab', { name: new RegExp(tab) }).click();
    await expectNoHorizontalOverflow(page);
  }
  await artist.context.close();

  const contractor = await newUser(browser, 'Cleo Contrata', 'CONTRACTOR');
  for (const url of ['/painel', '/painel/casas', '/painel/eventos', '/painel/eventos/novo']) {
    await contractor.page.goto(url);
    await expect(contractor.page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(contractor.page);
  }
  await contractor.context.close();
});
