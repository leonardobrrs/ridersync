import { expect, test, type Page } from '@playwright/test';
import { createPublicMusicianProfile, localInput, newUser, PASSWORD, pickChip, stamp, toast, validCnpj } from './helpers';

/**
 * Fluxo ponta a ponta com contas separadas por tipo:
 *  - Ana (artista solo e dona de banda), Lia (integrante), Sara (artista sem vínculo),
 *  - Vera (casa de show) e Carla (contratante independente, evento particular privado).
 */
test.describe.configure({ mode: 'serial' });

/** O sistema nunca usa alert/confirm/prompt do navegador. */
/** PNG 32×18 válido gerado com sharp (o servidor reprocessa para WebP). */
const PNG_CARTAZ = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAASCAIAAAC1qksFAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAKElEQVQ4jWP4f8KKpohh1IITo0FkNZqK/o9mNKvRouL/aGl6grYVDgDVEIJ9Y1AmEwAAAABJRU5ErkJggg==';

const forbidNativeDialogs = (page: Page) =>
  page.on('dialog', (d) => {
    throw new Error(`Diálogo nativo do navegador inesperado: ${d.message()}`);
  });

test('MVP: perfil, banda, convite e transferência, casa, evento, vagas, negociação, confirmação, agenda e evento privado', async ({ browser }) => {
  const id = stamp();
  const artistName = `Ana E2E ${id}`;
  const bandName = `Banda E2E ${id}`;
  const venueName = `Casa E2E ${id}`;
  const eventTitle = `Sexta Autoral ${id}`;
  const privateTitle = `Aniversário privado ${id}`;

  const ana = await newUser(browser, 'Ana Artista');
  const lia = await newUser(browser, 'Lia Integrante');
  const sara = await newUser(browser, 'Sara Terceira');
  const vera = await newUser(browser, 'Vera Casa', 'CONTRACTOR');
  const carla = await newUser(browser, 'Carla Festa', 'CONTRACTOR');
  for (const u of [ana, lia, sara, vera, carla]) forbidNativeDialogs(u.page);

  // ── Tipos de conta separados ──
  await expect(vera.page.getByRole('navigation', { name: 'Painel' }).getByRole('link', { name: 'Meu perfil' })).toHaveCount(0);
  await vera.page.goto('/painel/perfil');
  await expect(vera.page.getByText('Área exclusiva de contas de artista/banda')).toBeVisible();

  // ── Perfil individual público + rider sem exigências do local ──
  await createPublicMusicianProfile(ana.page, artistName);
  await ana.page.getByRole('tab', { name: 'Rider (equipamentos)' }).click();
  await expect(ana.page.getByRole('checkbox', { name: 'Incluir Ponto de energia 220V' })).toHaveCount(0);
  await expect(ana.page.getByRole('checkbox', { name: 'Incluir Área de palco' })).toHaveCount(0);
  await ana.page.getByRole('checkbox', { name: 'Incluir Microfone dinâmico' }).check();
  await ana.page.getByLabel('Quantidade necessária de Microfone dinâmico').fill('2');
  await ana.page.getByRole('checkbox', { name: 'Incluir Caixa direta (DI)' }).check();
  await ana.page.getByLabel('Quantidade necessária de Caixa direta (DI)').fill('3');
  await ana.page.getByRole('checkbox', { name: 'Incluir Bateria completa' }).check();
  await ana.page.getByRole('button', { name: 'Adicionar item personalizado' }).click();
  await ana.page.getByLabel('Nome do item personalizado').fill('Pedal looper');
  await ana.page.getByRole('button', { name: 'Salvar rider' }).click();
  await toast(ana.page, 'Rider salvo');

  // ── Portfólio: link inválido é rejeitado; YouTube gera miniatura ──
  await ana.page.getByRole('tab', { name: /Portfólio/ }).click();
  await ana.page.getByLabel('Título', { exact: true }).fill('Ao vivo');
  await ana.page.getByLabel('Link (https://)').fill('http://inseguro.com');
  await ana.page.getByRole('button', { name: 'Adicionar link' }).click();
  await expect(ana.page.getByText('Informe um link válido começando com https://')).toBeVisible();
  await ana.page.getByLabel('Link (https://)').fill('https://www.youtube.com/watch?v=RiderSync01');
  await ana.page.getByRole('button', { name: 'Adicionar link' }).click();
  await toast(ana.page, 'Link adicionado');

  // ── Banda com identidade própria, convite com função e notificação ──
  await ana.page.goto('/painel/bandas');
  await ana.page.getByRole('button', { name: 'Criar banda' }).click();
  await ana.page.getByLabel('Nome da banda').fill(bandName);
  await ana.page.getByRole('button', { name: 'Criar banda' }).click();
  await expect(ana.page.getByRole('heading', { level: 1 })).toHaveText(bandName);
  await ana.page.getByRole('tab', { name: /Integrantes/ }).click();
  await ana.page.getByLabel('E-mail da conta da pessoa').fill(lia.email);
  await ana.page.getByLabel('Função', { exact: true }).selectOption('Baixo');
  await ana.page.getByRole('button', { name: 'Enviar convite' }).click();
  await toast(ana.page, 'Convite enviado');
  await expect(ana.page.getByText('Pendente', { exact: true })).toBeVisible();
  // convite para conta de contratante é recusado
  await ana.page.getByLabel('E-mail da conta da pessoa').fill(vera.email);
  await ana.page.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(ana.page.getByRole('alert')).toContainText('conta de contratante');

  await lia.page.goto('/painel');
  await expect(lia.page.getByRole('button', { name: /Notificações: \d+ não lida/ })).toBeVisible();
  await lia.page.getByRole('button', { name: /Notificações/ }).click();
  await lia.page.getByRole('dialog', { name: 'Notificações recentes' }).getByRole('button', { name: new RegExp(`Convite para a banda ${bandName}`) }).click();
  await expect(lia.page).toHaveURL(/\/painel\/convites$/);
  await lia.page.getByRole('button', { name: 'Aceitar' }).click();
  await toast(lia.page, 'Convite aceito');
  await lia.page.goto('/painel/bandas');
  await lia.page.getByRole('link', { name: 'Ver banda' }).click();
  await expect(lia.page.getByText('Você é integrante: pode visualizar')).toBeVisible();
  await expect(lia.page.getByRole('button', { name: 'Salvar perfil' })).toHaveCount(0);

  // ── Transferência de propriedade: botão exclusivo, senha e 3 s ──
  await ana.page.reload();
  await ana.page.getByRole('tab', { name: /Integrantes/ }).click();
  await expect(ana.page.getByRole('combobox', { name: /Papel de Lia/ }).locator('option')).toHaveText(['Administrador', 'Integrante']);
  await ana.page.getByRole('button', { name: 'Transferir propriedade' }).click();
  const tr = ana.page.getByRole('dialog', { name: 'Transferir propriedade' });
  await expect(tr).toContainText(`A propriedade de ${bandName} será alterada`);
  await tr.getByLabel('Novo(a) proprietário(a)').selectOption({ label: 'Lia Integrante' });
  await tr.getByRole('checkbox', { name: /Tenho certeza/ }).check();
  await expect(tr.getByRole('button', { name: /Transferir propriedade/ })).toHaveCount(0);
  await tr.getByLabel('Confirme com a sua senha').fill('Errada@123');
  const finalBtn = tr.getByRole('button', { name: /Transferir propriedade/ });
  await expect(finalBtn).toBeDisabled();
  await expect(finalBtn).toBeEnabled({ timeout: 5000 });
  await finalBtn.click();
  await expect(tr.getByRole('alert')).toContainText('Senha incorreta');
  await tr.getByLabel('Confirme com a sua senha').fill(PASSWORD);
  await expect(tr.getByRole('button', { name: /Transferir propriedade/ })).toBeEnabled({ timeout: 5000 });
  await tr.getByRole('button', { name: /Transferir propriedade/ }).click();
  await toast(ana.page, 'Propriedade transferida');
  await expect(ana.page.getByText('Seu papel:')).toContainText('Administrador');

  // ── Casa de show, inventário e evento público ──
  await vera.page.goto('/painel/casas');
  await vera.page.getByRole('button', { name: 'Cadastrar casa' }).click();
  await vera.page.getByLabel('Nome do estabelecimento').fill(venueName);
  await vera.page.getByLabel('CNPJ (obrigatório)').fill(validCnpj());
  await vera.page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(vera.page.getByRole('heading', { level: 1 })).toHaveText(venueName);
  const venueUrl = vera.page.url();

  await vera.page.getByRole('tab', { name: 'Inventário técnico' }).click();
  await vera.page.getByRole('checkbox', { name: 'Incluir Microfone dinâmico' }).check();
  await vera.page.getByLabel('Quantidade disponível de Microfone dinâmico').fill('6');
  await vera.page.getByRole('checkbox', { name: 'Incluir Caixa direta (DI)' }).check();
  await vera.page.getByLabel('Quantidade disponível de Caixa direta (DI)').fill('1');
  await vera.page.getByRole('checkbox', { name: 'Incluir Área de palco' }).check();
  await vera.page.getByRole('button', { name: 'Salvar inventário' }).click();
  await toast(vera.page, 'Inventário salvo');

  await vera.page.getByRole('tab', { name: 'Eventos' }).click();
  await vera.page.getByRole('link', { name: 'Novo evento' }).click();
  await vera.page.getByLabel('Título').fill(eventTitle);
  await vera.page.getByLabel('Descrição').fill('Noite de música autoral.');
  await expect(vera.page.getByRole('radio', { name: 'Público' })).toBeChecked();
  await vera.page.getByLabel('Data e horário da apresentação').fill(localInput(30));
  await vera.page.getByLabel('Prazo de candidatura').fill(localInput(20, 23));
  await vera.page.getByLabel('Vagas').fill('1');
  await vera.page.getByLabel('Cachê oferecido (R$)').fill('800');
  await pickChip(vera.page, /Estilos procurados/, 'MPB');
  // Imagem do evento (exibida no card)
  await vera.page.locator('input[type="file"]').setInputFiles({ name: 'cartaz.png', mimeType: 'image/png', buffer: Buffer.from(PNG_CARTAZ, 'base64') });
  await expect(vera.page.locator('.picker-prev.wide img')).toBeVisible();
  await vera.page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await toast(vera.page, 'Rascunho criado');
  await expect(vera.page.locator('img.ev-cover')).toHaveAttribute('src', /^\/api\/media\//);
  const eventManageUrl = vera.page.url();
  const eventId = eventManageUrl.split('/').pop()!;

  await sara.page.goto(`/oportunidades/${eventId}`);
  await expect(sara.page.getByText('Não encontrado', { exact: true })).toBeVisible();
  await vera.page.getByRole('button', { name: 'Publicar e abrir inscrições' }).click();
  await expect(vera.page.getByText('Inscrições abertas').first()).toBeVisible();

  // ── Candidatura (oportunidades em cards, com a imagem do evento) ──
  await ana.page.goto('/oportunidades');
  const card = ana.page.locator('article.opp-card', { hasText: eventTitle });
  await expect(card.locator('img')).toHaveAttribute('src', /^\/api\/media\/.+\?v=thumb$/);
  await ana.page.getByRole('link', { name: eventTitle }).click();
  // Candidatura em modal: identidade, necessidades técnicas e mensagem
  // Candidatura e contraproposta ficam disponíveis direto na oportunidade.
  await expect(ana.page.getByRole('button', { name: 'Enviar contraproposta' })).toBeVisible();
  await ana.page.getByRole('button', { name: /^Candidatar-se por R\$/ }).click();
  await expect(ana.page.getByRole('dialog', { name: `Candidatura — ${eventTitle}` })).toBeVisible();
  await ana.page.getByLabel('Candidatar-se como').selectOption({ label: `${artistName} (Perfil individual)` });
  // O que a artista precisa que a casa disponibilize: preenchido a partir do perfil (rider) e ajustável.
  const needs = ana.page.getByRole('group', { name: 'O que você precisa que a casa disponibilize' });
  // O inventário da casa já vem marcado; a artista ajusta a quantidade e completa com o perfil.
  await expect(needs.getByRole('checkbox', { name: /Microfone dinâmico/ })).toBeChecked();
  await expect(needs.getByRole('checkbox', { name: /Caixa direta/ })).toBeChecked();
  await needs.getByLabel('Quantidade de Caixa direta (DI)').fill('3');
  await needs.getByRole('button', { name: 'Preencher a partir do meu perfil' }).click();
  await expect(needs.getByText('Pedal looper')).toBeVisible();
  await ana.page.getByLabel('Mensagem para a casa').fill('Tenho repertório autoral para a noite.');
  await expect(ana.page.getByRole('radio', { name: /Aceito o cachê publicado/ })).toBeChecked();
  await ana.page.getByRole('button', { name: 'Revisar e enviar' }).click();
  // Confirmação antes de enviar (reunião 22/11)
  const reviewDlg = ana.page.getByRole('dialog', { name: 'Confirme sua candidatura' });
  await expect(reviewDlg).toContainText('Você está se candidatando a');
  await expect(reviewDlg).toContainText('aceitando o cachê publicado');
  await reviewDlg.getByRole('button', { name: 'Confirmar candidatura' }).click();
  await toast(ana.page, 'Candidatura enviada');
  // Redireciona para as candidaturas
  await expect(ana.page).toHaveURL(/\/painel\/candidaturas$/);
  await expect(ana.page.getByText('Em análise').first()).toBeVisible();

  // ── Casa compara rider (contexto autorizado), seleciona e a vaga única fecha o evento ──
  await vera.page.goto(eventManageUrl);
  await expect(vera.page.getByText('Precisa que a casa disponibilize')).toBeVisible();
  await vera.page.getByRole('button', { name: 'Comparar necessidades' }).click();
  const cmp = vera.page.getByRole('dialog', { name: 'Compatibilidade técnica' });
  await expect(cmp.getByRole('row', { name: /Microfone dinâmico.*Compatível/ })).toBeVisible();
  await expect(cmp.getByRole('row', { name: /Caixa direta.*Parcialmente disponível/ })).toBeVisible();
  await expect(cmp.getByRole('row', { name: /Bateria completa.*Indisponível/ })).toBeVisible();
  await expect(cmp.getByRole('row', { name: /Pedal looper.*Conferir com a casa/ })).toBeVisible();
  await cmp.getByRole('button', { name: 'Fechar' }).click();

  // Selecionar abre a negociação já com o cachê publicado (sem redigitar) e NÃO ocupa a vaga.
  await vera.page.getByRole('button', { name: 'Selecionar e negociar' }).click();
  const openDlg = vera.page.getByRole('dialog', { name: 'Confirmar ação' });
  await expect(openDlg).toContainText('condições publicadas');
  await openDlg.getByRole('button', { name: 'Abrir negociação' }).click();
  await toast(vera.page, 'Negociação aberta com o cachê do evento');
  await expect(vera.page).toHaveURL(/\/painel\/negociacoes\//);
  const bookingUrl = vera.page.url();
  await vera.page.goto(eventManageUrl);
  await expect(vera.page.getByText('Inscrições abertas').first()).toBeVisible();
  await vera.page.goto(new URL(bookingUrl).pathname);

  await sara.page.goto(bookingUrl.replace(/^https?:\/\/[^/]+/, ''));
  await expect(sara.page.getByText('Não encontrado', { exact: true })).toBeVisible();

  // ── Artista recebe notificação, contrapropõe; casa aceita (modal do sistema) e confirma ──
  await ana.page.goto('/painel/notificacoes');
  await expect(ana.page.getByText('Nova proposta de contratação').first()).toBeVisible();
  await ana.page.goto(bookingUrl.replace(/^https?:\/\/[^/]+/, ''));
  await expect(ana.page.locator('.offer').first()).toContainText('800');
  await ana.page.getByRole('button', { name: 'Comparar rider com o inventário da casa' }).click();
  await expect(ana.page.getByRole('dialog', { name: 'Compatibilidade técnica' })).toBeVisible();
  await ana.page.getByRole('dialog', { name: 'Compatibilidade técnica' }).getByRole('button', { name: 'Fechar' }).click();
  await ana.page.getByRole('button', { name: 'Contraproposta' }).click();
  const counter = ana.page.getByRole('dialog', { name: 'Contraproposta' });
  await counter.getByLabel('Cachê (R$)').fill('1200');
  await counter.getByRole('button', { name: 'Enviar contraproposta' }).click();
  const sure = ana.page.getByRole('dialog', { name: 'Enviar contraproposta?' });
  await expect(sure).toContainText('1.200');
  await sure.getByRole('button', { name: 'Enviar contraproposta' }).click();
  await toast(ana.page, 'Contraproposta enviada');
  await expect(ana.page.locator('.offer')).toHaveCount(2);

  await vera.page.reload();
  await vera.page.getByRole('button', { name: 'Aceitar proposta' }).click();
  const acceptDlg = vera.page.getByRole('dialog', { name: 'Aceitar proposta' });
  await expect(acceptDlg).toContainText('R$');
  await acceptDlg.getByRole('button', { name: 'Aceitar proposta' }).click();
  await toast(vera.page, 'Aguardando confirmação do contratante');
  await vera.page.getByRole('button', { name: 'Confirmar contratação' }).click();
  await vera.page.getByRole('dialog', { name: 'Confirmar contratação' }).getByRole('button', { name: 'Confirmar contratação' }).click();
  await toast(vera.page, 'Contratação confirmada');
  await vera.page.goto(eventManageUrl);
  await expect(vera.page.getByText('Vagas preenchidas').first()).toBeVisible();
  await expect(vera.page.getByText('Todas as vagas têm contratação confirmada')).toBeVisible();
  await vera.page.goto(new URL(bookingUrl).pathname);

  // ── Conversa: Enter envia, Shift+Enter quebra a linha ──
  const chatBox = ana.page.getByRole('region', { name: 'Mensagens' });
  const chatInput = chatBox.getByLabel('Nova mensagem');
  await chatInput.fill('Chego às 19h para a passagem de som.');
  await chatInput.press('Shift+Enter');
  await expect(chatInput).toHaveValue('Chego às 19h para a passagem de som.\n');
  await chatInput.press('Enter');
  await expect(chatBox.locator('.bubble.me', { hasText: 'Chego às 19h para a passagem de som.' })).toBeVisible();
  await expect(chatInput).toHaveValue('');
  await vera.page.reload();
  await expect(vera.page.getByRole('region', { name: 'Mensagens' }).getByText('Chego às 19h para a passagem de som.')).toBeVisible();

  // ── Agenda, perfil público (abas, próximos eventos, sem comparação) e página inicial ──
  await ana.page.goto('/painel/agenda');
  await expect(ana.page.getByRole('link', { name: new RegExp(`${artistName} — ${eventTitle}`) })).toBeVisible();

  const visitor = await browser.newPage();
  forbidNativeDialogs(visitor);
  // Show confirmado na agenda pública da casa (a home lista só os 8 mais próximos; o banco de teste acumula shows).
  await visitor.goto(`/?kind=VENUE&q=${encodeURIComponent(venueName)}`);
  await visitor.getByRole('link', { name: new RegExp(`${venueName} — ver casa de show`) }).click();
  await expect(visitor.getByRole('link', { name: artistName })).toBeVisible();
  await expect(visitor.getByRole('link', { name: eventTitle })).toBeVisible(); // o evento é clicável
  await visitor.goto('/');
  await expect(visitor.getByRole('region', { name: 'Próximos shows confirmados' })).toBeVisible();
  await visitor.goto(`/?q=${encodeURIComponent(artistName)}`);
  await visitor.getByRole('link', { name: new RegExp(`${artistName} — ver perfil`) }).click();
  await expect(visitor.getByRole('heading', { name: 'Próximos eventos' })).toBeVisible();
  await expect(visitor.getByText(eventTitle)).toBeVisible();
  await expect(visitor.getByRole('button', { name: /Comparar rider/ })).toHaveCount(0);
  await visitor.getByRole('tab', { name: /Rider técnico/ }).click();
  await expect(visitor.getByText('Pedal looper')).toBeVisible();
  await visitor.getByRole('tab', { name: /Portfólio/ }).click();
  await expect(visitor.locator('.pf-card img')).toHaveAttribute('src', /i\.ytimg\.com\/vi\/RiderSync01/);
  await expect(visitor.locator('body')).not.toContainText(ana.email);
  await expect(visitor.getByRole('link', { name: 'Entrar para enviar proposta' })).toBeVisible();

  // ── Contratante independente: evento particular PRIVADO ──
  await carla.page.goto('/painel/eventos');
  await carla.page.getByRole('link', { name: 'Novo evento' }).click();
  await carla.page.getByLabel('Título').fill(privateTitle);
  await carla.page.locator('.seg label', { hasText: 'Privado' }).click();
  await expect(carla.page.getByRole('radio', { name: 'Privado' })).toBeChecked();
  await expect(carla.page.getByText('Aparece só para contas de artista')).toBeVisible();
  await carla.page.getByLabel('Nome do local (opcional)').fill('Salão do prédio');
  await carla.page.getByLabel('Cidade (Alagoas)').fill('Maceió');
  await carla.page.getByLabel('Data e horário da apresentação').fill(localInput(40));
  await carla.page.getByLabel('Prazo de candidatura').fill(localInput(25, 23));
  await carla.page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await toast(carla.page, 'Rascunho criado');
  await carla.page.getByRole('button', { name: 'Publicar e abrir inscrições' }).click();
  await expect(carla.page.getByText('Inscrições abertas').first()).toBeVisible();

  await sara.page.goto('/oportunidades');
  await expect(sara.page.getByRole('link', { name: privateTitle })).toBeVisible();
  await visitor.goto('/oportunidades');
  await expect(visitor.getByRole('link', { name: eventTitle })).toHaveCount(0);
  await expect(visitor.getByRole('link', { name: privateTitle })).toHaveCount(0);
  await vera.page.goto('/oportunidades');
  await expect(vera.page.getByRole('link', { name: privateTitle })).toHaveCount(0);

  // casa: página de gestão não acessível a terceiros
  await sara.page.goto(venueUrl.replace(/^https?:\/\/[^/]+/, ''));
  await expect(sara.page.getByText('Área exclusiva de contas de contratante')).toBeVisible();

  await visitor.close();
  for (const u of [ana, lia, sara, vera, carla]) await u.context.close();
});
