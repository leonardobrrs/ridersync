import { expect, test } from '@playwright/test';
import { createPublicMusicianProfile, localInput, newUser, pickChip, stamp, toast } from './helpers';

/**
 * Fluxo ponta a ponta do MVP com quatro pessoas:
 *  - Vera (casa de show), Ana (artista solo e dona de banda), Lia (integrante convidada), Sara (terceira sem vínculo).
 */
test.describe.configure({ mode: 'serial' });

test('MVP: perfil, banda e convite, casa e inventário, oportunidade, candidatura, negociação, confirmação, proposta direta', async ({ browser }) => {
  const id = stamp();
  const artistName = `Ana E2E ${id}`;
  const bandName = `Banda E2E ${id}`;
  const venueName = `Casa E2E ${id}`;
  const eventTitle = `Sexta Autoral ${id}`;

  const ana = await newUser(browser, 'Ana Artista');
  const lia = await newUser(browser, 'Lia Integrante');
  const vera = await newUser(browser, 'Vera Casa');
  const sara = await newUser(browser, 'Sara Terceira');

  // ── Perfil individual público + rider ──
  await createPublicMusicianProfile(ana.page, artistName);
  await ana.page.getByRole('tab', { name: 'Rider técnico' }).click();
  await ana.page.getByRole('checkbox', { name: 'Incluir Microfone dinâmico' }).check();
  await ana.page.getByLabel('Quantidade necessária de Microfone dinâmico').fill('2');
  await ana.page.getByRole('checkbox', { name: 'Incluir Direct box (DI)' }).check();
  await ana.page.getByLabel('Quantidade necessária de Direct box (DI)').fill('3');
  await ana.page.getByRole('checkbox', { name: 'Incluir Bateria completa' }).check();
  await ana.page.getByRole('button', { name: 'Adicionar item personalizado' }).click();
  await ana.page.getByLabel('Nome do item personalizado').fill('Pedal looper');
  await ana.page.getByRole('button', { name: 'Salvar rider' }).click();
  await toast(ana.page, 'Rider salvo');

  // ── Portfólio: link inválido é rejeitado, válido é aceito ──
  await ana.page.getByRole('tab', { name: /Portfólio/ }).click();
  await ana.page.getByLabel('Título', { exact: true }).fill('Ao vivo');
  await ana.page.getByLabel('Link (https://)').fill('http://inseguro.com');
  await ana.page.getByRole('button', { name: 'Adicionar link' }).click();
  await expect(ana.page.getByText('Informe um link válido começando com https://')).toBeVisible();
  await ana.page.getByLabel('Link (https://)').fill('https://www.youtube.com/watch?v=e2e');
  await ana.page.getByRole('button', { name: 'Adicionar link' }).click();
  await toast(ana.page, 'Link adicionado');

  // ── Banda com identidade própria e convite ──
  await ana.page.goto('/painel/bandas');
  await ana.page.getByRole('button', { name: 'Criar banda' }).click();
  await ana.page.getByLabel('Nome da banda').fill(bandName);
  await ana.page.getByRole('button', { name: 'Criar banda' }).click();
  await expect(ana.page.getByRole('heading', { level: 1 })).toHaveText(bandName);
  await ana.page.getByRole('tab', { name: /Integrantes/ }).click();
  await ana.page.getByLabel('E-mail da conta da pessoa').fill(lia.email);
  await ana.page.getByLabel('Função/instrumento').fill('Baixo');
  await ana.page.getByRole('button', { name: 'Enviar convite' }).click();
  await toast(ana.page, 'Convite enviado');
  await expect(ana.page.getByText('Pendente', { exact: true })).toBeVisible();
  // a banda tem rider próprio (vazio), independente do rider individual
  await ana.page.getByRole('tab', { name: 'Rider técnico' }).click();
  await expect(ana.page.getByRole('checkbox', { name: 'Incluir Microfone dinâmico' })).not.toBeChecked();

  // convite pendente não dá acesso; após aceite, MEMBER só visualiza
  await lia.page.goto('/painel/bandas');
  await expect(lia.page.getByText('Você ainda não participa de nenhuma banda')).toBeVisible();
  await lia.page.goto('/painel/convites');
  await expect(lia.page.getByText(`Banda: ${bandName}`)).toBeVisible();
  await lia.page.getByRole('button', { name: 'Aceitar' }).click();
  await toast(lia.page, 'Convite aceito');
  await lia.page.goto('/painel/bandas');
  await lia.page.getByRole('link', { name: 'Ver banda' }).click();
  await expect(lia.page.getByText('Você é integrante (MEMBER)')).toBeVisible();
  await expect(lia.page.getByRole('button', { name: 'Salvar perfil' })).toHaveCount(0);
  await expect(lia.page.getByRole('button', { name: 'Publicar perfil' })).toHaveCount(0);

  // ── Casa de show, inventário e publicação ──
  await vera.page.goto('/painel/casas');
  await vera.page.getByRole('button', { name: 'Cadastrar casa' }).click();
  await vera.page.getByLabel('Nome do estabelecimento').fill(venueName);
  await vera.page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(vera.page.getByRole('heading', { level: 1 })).toHaveText(venueName);
  const venueUrl = vera.page.url();

  await vera.page.getByRole('tab', { name: 'Inventário técnico' }).click();
  await vera.page.getByRole('checkbox', { name: 'Incluir Microfone dinâmico' }).check();
  await vera.page.getByLabel('Quantidade disponível de Microfone dinâmico').fill('6');
  await vera.page.getByRole('checkbox', { name: 'Incluir Direct box (DI)' }).check();
  await vera.page.getByLabel('Quantidade disponível de Direct box (DI)').fill('1');
  await vera.page.getByRole('button', { name: 'Salvar inventário' }).click();
  await toast(vera.page, 'Inventário salvo');

  await vera.page.getByRole('tab', { name: 'Eventos' }).click();
  await vera.page.getByRole('link', { name: 'Nova publicação' }).click();
  await vera.page.getByLabel('Título').fill(eventTitle);
  await vera.page.getByLabel('Descrição').fill('Noite de música autoral.');
  await vera.page.getByLabel('Data e horário da apresentação').fill(localInput(30));
  await vera.page.getByLabel('Prazo de candidatura').fill(localInput(20, 23));
  await vera.page.getByLabel('Vagas').fill('1');
  await vera.page.getByLabel('Cachê oferecido (R$)').fill('800');
  await pickChip(vera.page, /Estilos procurados/, 'MPB');
  await vera.page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await toast(vera.page, 'Rascunho criado');
  const eventManageUrl = vera.page.url();
  const eventId = eventManageUrl.split('/').pop()!;

  // rascunho não aparece publicamente
  await sara.page.goto(`/oportunidades/${eventId}`);
  await expect(sara.page.getByText('Não encontrado', { exact: true })).toBeVisible();

  await vera.page.getByRole('button', { name: 'Publicar e abrir inscrições' }).click();
  await expect(vera.page.getByText('Inscrições abertas').first()).toBeVisible();

  // ── Candidatura (duplicidade bloqueada na interface e na API) ──
  await ana.page.goto('/oportunidades');
  await ana.page.getByRole('link', { name: eventTitle }).click();
  await ana.page.getByLabel('Candidatar-se como').selectOption({ label: `${artistName} (Perfil individual)` });
  await ana.page.getByLabel('Mensagem para a casa').fill('Tenho repertório autoral para a noite.');
  await ana.page.getByRole('button', { name: 'Enviar candidatura' }).click();
  await toast(ana.page, 'Candidatura enviada');
  await expect(ana.page.getByText('Em análise')).toBeVisible();
  await expect(ana.page.getByRole('option', { name: /já candidatado/ })).toHaveCount(1);

  // ── Casa analisa: compara rider, seleciona (sem contratar) e inicia negociação ──
  await vera.page.goto(eventManageUrl);
  await vera.page.getByRole('button', { name: 'Comparar rider' }).click();
  const cmp = vera.page.getByRole('dialog', { name: 'Compatibilidade técnica' });
  await expect(cmp.getByRole('row', { name: /Microfone dinâmico.*Compatível/ })).toBeVisible();
  await expect(cmp.getByRole('row', { name: /Direct box.*Parcialmente disponível/ })).toBeVisible();
  await expect(cmp.getByRole('row', { name: /Bateria completa.*Indisponível/ })).toBeVisible();
  await expect(cmp.getByRole('row', { name: /Pedal looper.*Conferir com a casa/ })).toBeVisible();
  await cmp.getByRole('button', { name: 'Fechar' }).click();

  await vera.page.getByRole('button', { name: 'Selecionar' }).click();
  await toast(vera.page, 'Isso não confirma a contratação');
  await expect(vera.page.getByText('Selecionada', { exact: true })).toBeVisible();
  await vera.page.getByRole('button', { name: 'Iniciar negociação' }).click();
  const offerDlg = vera.page.getByRole('dialog');
  await offerDlg.getByLabel('Mensagem (opcional)').fill('Parabéns! Seguem os termos.');
  await offerDlg.getByRole('button', { name: 'Enviar proposta' }).click();
  await expect(vera.page).toHaveURL(/\/painel\/negociacoes\//);
  const bookingUrl = vera.page.url();
  await expect(vera.page.getByText('Aguardando resposta da outra parte.')).toBeVisible();

  // terceiros não acessam a negociação
  await sara.page.goto(bookingUrl.replace(/^https?:\/\/[^/]+/, ''));
  await expect(sara.page.getByText('Não encontrado', { exact: true })).toBeVisible();
  // integrante MEMBER da banda também não (a negociação é do perfil solo da Ana)
  await lia.page.goto(bookingUrl.replace(/^https?:\/\/[^/]+/, ''));
  await expect(lia.page.getByText('Não encontrado', { exact: true })).toBeVisible();

  // ── Artista faz contraproposta e envia mensagem; histórico preservado ──
  await ana.page.goto('/painel/negociacoes');
  await ana.page.getByRole('link', { name: new RegExp(eventTitle) }).click();
  await expect(ana.page.getByText('Parabéns! Seguem os termos.')).toBeVisible();
  await ana.page.getByRole('button', { name: 'Contraproposta' }).click();
  const counter = ana.page.getByRole('dialog', { name: 'Contraproposta' });
  await counter.getByLabel('Cachê (R$)').fill('1200');
  await counter.getByRole('button', { name: 'Enviar contraproposta' }).click();
  await toast(ana.page, 'Contraproposta enviada');
  await expect(ana.page.getByText('Substituída por contraproposta')).toBeVisible();
  await expect(ana.page.locator('.offer')).toHaveCount(2);
  await ana.page.getByLabel('Nova mensagem').fill('Preciso de 3 DIs, ok?');
  await ana.page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await toast(ana.page, 'Mensagem enviada');

  // ── Casa aceita e confirma explicitamente ──
  await vera.page.reload();
  await expect(vera.page.getByText('Preciso de 3 DIs, ok?')).toBeVisible();
  await vera.page.getByRole('button', { name: 'Aceitar proposta' }).click();
  await toast(vera.page, 'Aguardando confirmação da casa');
  await vera.page.getByRole('button', { name: 'Confirmar contratação' }).click();
  await toast(vera.page, 'Contratação confirmada');
  await expect(vera.page.getByText('Contratação confirmada').first()).toBeVisible();
  await expect(vera.page.locator('.timeline')).toContainText('Termos aceitos');
  // confirmado ≠ realizado: não há registro de apresentação ainda
  await expect(vera.page.getByText('Após a data, qualquer uma das partes pode registrar')).toBeVisible();

  // ── Agenda: aparece como próxima apresentação confirmada ──
  await ana.page.goto('/painel/agenda');
  await expect(ana.page.getByRole('link', { name: new RegExp(`${artistName} @ ${venueName}`) })).toBeVisible();
  await expect(ana.page.getByText('Nenhuma apresentação registrada como realizada.')).toBeVisible();

  // ── Proposta direta pelo marketplace usa o mesmo fluxo; artista recusa ──
  await vera.page.goto(`/?q=${encodeURIComponent(artistName)}`);
  await vera.page.getByRole('link', { name: new RegExp(`${artistName} — ver perfil`) }).click();
  await expect(vera.page.getByRole('heading', { level: 1, name: artistName, exact: true })).toBeVisible();
  await vera.page.getByRole('button', { name: 'Enviar proposta' }).click();
  const direct = vera.page.getByRole('dialog');
  await direct.getByLabel('Data e horário (Maceió)').fill(localInput(45));
  await direct.getByLabel('Cachê (R$)').fill('900');
  await direct.getByRole('button', { name: 'Enviar proposta' }).click();
  await expect(vera.page).toHaveURL(/\/painel\/negociacoes\//);
  await expect(vera.page.getByText('Proposta direta pelo marketplace')).toBeVisible();

  await ana.page.goto('/painel');
  await expect(ana.page.locator('.kpi.hot').first()).toBeVisible();
  await ana.page.goto('/painel/negociacoes');
  await ana.page.getByRole('link', { name: /Aguardando você/ }).first().click();
  await ana.page.getByRole('button', { name: 'Recusar' }).click();
  await toast(ana.page, 'Proposta recusada');
  await expect(ana.page.getByText('Recusada').first()).toBeVisible();

  // ── Página pública: sem e-mail da conta; com rider e portfólio ──
  const visitor = await browser.newPage();
  await visitor.goto(`/?q=${encodeURIComponent(artistName)}`);
  await visitor.getByRole('link', { name: new RegExp(`${artistName} — ver perfil`) }).click();
  await expect(visitor.getByRole('heading', { name: 'Rider técnico' })).toBeVisible();
  await expect(visitor.getByText('Pedal looper')).toBeVisible();
  await expect(visitor.getByRole('link', { name: /Ao vivo/ })).toBeVisible();
  await expect(visitor.locator('body')).not.toContainText(ana.email);
  await expect(visitor.getByRole('link', { name: 'Entrar para enviar proposta' })).toBeVisible();

  // casa: página de gestão não acessível a terceiros
  await sara.page.goto(venueUrl.replace(/^https?:\/\/[^/]+/, ''));
  await expect(sara.page.getByRole('alert')).toContainText('Acesso negado');

  for (const u of [ana, lia, vera, sara]) await u.context.close();
});

