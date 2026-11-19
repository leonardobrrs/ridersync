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

/**
 * Regressão (Preview de 2026-11-18): com vários shows confirmados, o texto para leitor de tela dos cards
 * (`.sr-only`, posicionado) escapava do carrossel e criava rolagem horizontal no celular/tablet.
 * A resposta da API é complementada no navegador para não depender do volume de dados do banco de teste.
 */
test('página inicial com muitos shows confirmados sem rolagem horizontal', async ({ page }) => {
  await page.route('**/api/public/home', async (route) => {
    const res = await route.fetch();
    const data = await res.json();
    const shows = Array.from({ length: 10 }, (_, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`,
      title: `Show de teste ${i + 1}`,
      startsAt: new Date(Date.now() + (i + 3) * 86400_000).toISOString(),
      durationMinutes: 90,
      place: { name: 'Casa de teste com nome bem comprido', venueSlug: null, city: 'Maceió', state: 'AL', address: null },
      artist: { name: `Artista de teste ${i + 1}`, slug: `artista-teste-${i + 1}`, kind: 'SOLO', photoUrl: null },
      eventId: null,
    }));
    await route.fulfill({ response: res, json: { ...data, shows } });
  });
  await page.goto('/');
  await expect(page.getByText('Artista de teste 1', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

/**
 * Reunião 18/11: logo sem fundo esticado. Celular/tablet: sem a barra de categorias no topo — as categorias ficam
 * em "Explorar" (barra inferior) e o instrumento em "Filtros". Desktop: barra de categorias no topo.
 */
test('logo do tamanho do texto; categorias no topo só no desktop e em "Explorar" no celular/tablet', async ({ page }) => {
  await page.goto('/');
  const logo = await page.locator('.hdr .logo').boundingBox();
  expect(logo!.width, 'fundo amarelo da logo não pode esticar').toBeLessThan(200);
  const width = page.viewportSize()!.width;
  const cats = page.getByRole('navigation', { name: 'Categorias' });
  if (width <= 900) {
    await expect(cats).toBeHidden();
    const explore = page.getByRole('navigation', { name: 'Atalhos' }).getByRole('button', { name: 'Explorar' });
    await explore.click();
    const sheet = page.getByRole('dialog', { name: 'Explorar' });
    await expect(sheet.getByRole('link', { name: /Todos/ })).toHaveAttribute('aria-current', 'page');
    await sheet.getByRole('link', { name: /Bandas/ }).click();
    await expect(page).toHaveURL(/\?kind=BAND$/);
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bandas');
    await explore.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Explorar' })).toHaveCount(0);
    await page.getByRole('button', { name: /Filtros/ }).click();
    await expect(page.getByRole('dialog', { name: 'Filtros' }).getByRole('group', { name: /Instrumento/ })).toBeVisible();
  } else {
    await expect(cats).toBeVisible();
    await expect(page.locator('.cats .cat.sm').first()).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
});
