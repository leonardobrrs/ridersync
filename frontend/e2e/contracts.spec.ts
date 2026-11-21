import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createPublicMusicianProfile, newUser, stamp, toast } from './helpers';

/** Escrita pela API com a sessão do próprio navegador (o cabeçalho é exigido em toda escrita). */
async function apiWrite(page: Page, method: 'post' | 'put' | 'patch', url: string, data: object) {
  const res = await page.request[method](url, { data, headers: { 'X-Requested-With': 'RiderSync' } });
  expect(res.ok(), `${method.toUpperCase()} ${url}: ${res.status()} ${await res.text()}`).toBe(true);
  return res.json();
}

test('contrato: aviso de dados antes de confirmar, PDF para as duas partes e atualização depois de completar os dados', async ({ browser }) => {
  const id = stamp();
  const artist = await newUser(browser, 'Cida Contrato');
  const artistName = `Cida Contrato ${id}`;
  await createPublicMusicianProfile(artist.page, artistName);
  const me = await (await artist.page.request.get('/api/auth/me')).json();
  const artistId: string = me.musician.id;

  const contractor = await newUser(browser, 'Vera Contrato', 'CONTRACTOR');
  const venue = await apiWrite(contractor.page, 'post', '/api/organizations', { name: `Casa Contrato ${id}`, city: 'Maceió', venueKind: 'Casa de show', capacity: 200 });
  await apiWrite(contractor.page, 'patch', `/api/organizations/${venue.id}`, { legalName: `Casa Contrato ${id} Ltda`, cnpj: '11.222.333/0001-81', addressLine: 'Rua do Sol, 100' });

  // Proposta direta (com condições do contrato) → aceite da artista
  const performanceAt = new Date(Date.now() + 30 * 86400_000).toISOString();
  const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
  const booking = await apiWrite(contractor.page, 'post', '/api/bookings', {
    organizationId: venue.id,
    artistId,
    offer: {
      performanceAt,
      durationMinutes: 90,
      feeCents: 120000,
      presentationDesc: 'Show acústico',
      signalCents: 40000,
      signalDueDate: day(10),
      balanceDueDate: day(29),
      paymentMethod: 'Pix',
      advanceMinutes: 60,
    },
  });
  await apiWrite(artist.page, 'post', `/api/bookings/${booking.id}/offers/${booking.pendingOffer.id}/accept`, {});

  // Antes de confirmar: o contratante vê o que falta do outro lado; a artista vê o que falta dela, com o link
  const page = contractor.page;
  await page.goto(`/painel/negociacoes/${booking.id}`);
  await expect(page.getByText('A outra parte ainda não informou: Nome completo do artista, CPF do artista.')).toBeVisible();
  await artist.page.goto(`/painel/negociacoes/${booking.id}`);
  await expect(artist.page.getByText(/Faltam seus dados para o contrato: Nome completo do artista, CPF do artista/)).toBeVisible();
  await expect(artist.page.getByRole('link', { name: 'Completar dados' })).toHaveAttribute('href', '/painel/conta');

  await page.getByRole('button', { name: 'Confirmar contratação' }).click();
  await page.getByRole('dialog', { name: 'Confirmar contratação' }).getByRole('button', { name: 'Confirmar contratação' }).click();

  // Contrato gerado na confirmação, com campos em aberto
  const card = page.getByRole('region', { name: 'Contrato' });
  await expect(card.getByText(/com casa de show/)).toBeVisible();
  await expect(card.getByText(/campos ainda estão como “\[A PREENCHER\]”/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('link', { name: 'Baixar contrato (PDF)' }).click()]);
  expect(download.suggestedFilename()).toBe(`contrato-${booking.id}.pdf`);
  expect(readFileSync((await download.path())!).subarray(0, 5).toString()).toBe('%PDF-');

  // A artista completa os dados e atualiza: o aviso de campos em aberto some
  await apiWrite(artist.page, 'put', '/api/account/legal-profile', { legalName: 'Cida Ferraz da Silva', cpf: '529.982.247-25' });
  await artist.page.reload();
  const artistCard = artist.page.getByRole('region', { name: 'Contrato' });
  await artistCard.getByRole('button', { name: 'Atualizar contrato' }).click();
  await toast(artist.page, 'Contrato atualizado');
  await expect(artistCard.getByText(/ainda estão como/)).toHaveCount(0);
  const [again] = await Promise.all([artist.page.waitForEvent('download'), artistCard.getByRole('link', { name: 'Baixar contrato (PDF)' }).click()]);
  expect(readFileSync((await again.path())!).subarray(0, 5).toString()).toBe('%PDF-');

  await artist.context.close();
  await contractor.context.close();
});

test('contratante pessoa física: vê o contrato, vai aos próprios dados, atualiza e o artista é avisado', async ({ browser }) => {
  const id = stamp();
  const artist = await newUser(browser, 'Davi Solo');
  await createPublicMusicianProfile(artist.page, `Davi Solo ${id}`);
  const artistId: string = (await (await artist.page.request.get('/api/auth/me')).json()).musician.id;

  // Contratante sem casa: o primeiro evento particular cria o perfil de contratação individual
  const contractor = await newUser(browser, 'Paula Festa', 'CONTRACTOR');
  const page = contractor.page;
  const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();
  const ev = await apiWrite(page, 'post', '/api/me/independent-events', {
    title: `Aniversário ${id}`,
    startsAt: inDays(20),
    applicationDeadline: inDays(15),
    locationCity: 'Maceió',
    visibility: 'PRIVATE',
    slots: 1,
  });
  const me = await (await page.request.get('/api/auth/me')).json();
  const orgId: string = me.organizations.find((o: { type: string }) => o.type === 'INDIVIDUAL').id;
  const booking = await apiWrite(page, 'post', '/api/bookings', {
    organizationId: orgId,
    artistId,
    eventId: ev.id,
    offer: { performanceAt: inDays(20), durationMinutes: 120, feeCents: 90000 },
  });
  await apiWrite(artist.page, 'post', `/api/bookings/${booking.id}/offers/${booking.pendingOffer.id}/accept`, {});
  await apiWrite(page, 'post', `/api/bookings/${booking.id}/confirm`, {});

  // Lado do contratante: cartão, aviso do que falta, "Atualizar contrato" e o botão para os próprios dados
  await page.goto(`/painel/negociacoes/${booking.id}`);
  const card = page.getByRole('region', { name: 'Contrato' });
  await expect(card.getByText(/para evento particular/)).toBeVisible();
  // Pendências: o que é, de quem é a vez e onde preencher
  const mine = card.locator('li', { hasText: 'Nome completo do contratante, CPF do contratante, RG do contratante' });
  await expect(mine).toContainText('quem preenche: você');
  await expect(mine).toContainText('"Conta e privacidade" › "Dados para contrato"');
  await expect(card.locator('li', { hasText: 'Nome completo do artista, CPF do artista' })).toContainText('a outra parte (artista)');
  await expect(card.getByRole('button', { name: 'Atualizar contrato' })).toBeVisible();
  await card.getByRole('link', { name: 'Meus dados para contrato' }).click();
  await expect(page).toHaveURL(/\/painel\/conta$/);
  await page.getByLabel('Nome completo (como no documento)').fill('Paula Festa da Silva');
  await page.getByLabel('CPF').fill('111.444.777-35');
  await page.getByLabel('RG').fill('7654321 SSP/AL');
  await page.getByRole('button', { name: 'Salvar dados' }).click();
  await toast(page, /salv/i);

  // Volta e atualiza: o aviso do próprio lado some
  await page.goto(`/painel/negociacoes/${booking.id}`);
  await card.getByRole('button', { name: 'Atualizar contrato' }).click();
  await toast(page, 'Contrato atualizado');
  await expect(card.locator('li', { hasText: 'Nome completo do contratante' })).toHaveCount(0);

  // O artista é avisado (sino) da geração e da atualização
  await artist.page.goto('/painel/notificacoes');
  await expect(artist.page.getByText(`Contrato atualizado: Aniversário ${id}`)).toBeVisible();
  await expect(artist.page.getByText(`Contrato disponível: Aniversário ${id}`)).toBeVisible();

  await artist.context.close();
  await contractor.context.close();
});
