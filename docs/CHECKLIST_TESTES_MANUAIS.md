# RiderSync — Checklist de testes manuais (Preview)

Use contas do seed (`docs/SEEDERS.md`, senha `Demo@RiderSync2026`) e contas novas. Teste em celular, tablet e desktop.
Marque ✔/✘ e anote o problema.

## Cadastro, acesso e conta
- [ ] Cadastro sem escolher "Sou artista"/"Sou proprietário ou contratante" é bloqueado com mensagem.
- [ ] Senha sem maiúscula, número ou caractere especial é recusada; a lista de requisitos marca cada item atendido.
- [ ] Ícone de olho: fechado oculta a senha, aberto mostra; funciona no login, no cadastro e na troca de senha.
- [ ] "Confirme a senha" diferente mostra "As senhas não conferem."
- [ ] Sem marcar o aceite dos Termos/Política não é possível cadastrar.
- [ ] Após o cadastro aparece o aviso "Confirme seu e-mail" no painel; **com Resend configurado**, o e-mail chega e o link confirma a conta (link reutilizado é recusado).
- [ ] "Reenviar link" envia novo e-mail e invalida o anterior.
- [ ] "Esqueci minha senha": e-mail chega; nova senha funciona; sessões abertas em outro navegador são encerradas.
- [ ] Cinco senhas erradas seguidas bloqueiam a conta por 15 minutos (mensagem clara).
- [ ] **Com Google configurado**: "Cadastrar com Google" (após escolher tipo e aceitar termos) e "Entrar com Google" funcionam; conta sem cadastro é levada ao cadastro.
- [ ] Conta e privacidade: trocar nome, foto da conta, senha; "Baixar cópia" gera JSON sem senha; "Encerrar outras sessões".
- [ ] Excluir conta: exige senha + "EXCLUIR"; botão só habilita após 3 s; dono único de banda com integrantes é bloqueado.

## Tipos de conta
- [ ] Conta de artista não vê "Casas de show"/"Eventos particulares" no painel e recebe aviso se acessar a URL.
- [ ] Conta de contratante não vê "Meu perfil"/"Minhas bandas"/"Candidaturas".
- [ ] Convidar e-mail de contratante para banda (ou de artista para casa) mostra erro.

## Perfis, bandas e portfólio
- [ ] Criar perfil individual, banda e casa com imagem já no formulário de criação.
- [ ] Foto grande abre nítida ao clicar no perfil público (sem "estourar"); miniaturas carregam rápido.
- [ ] Perfil público com abas "Sobre", "Portfólio", "Rider técnico" (sem rolagem única); link do YouTube mostra miniatura.
- [ ] Perfil público **não** tem "Comparar rider"; tem a seção "Próximos eventos".
- [ ] "@perfil" de artistas, integrantes e bandas leva ao perfil correspondente; Instagram abre o Instagram.
- [ ] Rider técnico do artista não oferece "Área de palco", "Ponto de energia", "Refletor" ou "Camarim"; o inventário da casa oferece.
- [ ] Cidade aceita somente municípios de Alagoas, com preenchimento automático.
- [ ] Banda: função do integrante por lista suspensa; papel só "Administrador/Integrante".
- [ ] "Transferir propriedade" (botão próprio): explicação, escolha, "Tenho certeza", senha; botão final só libera após 3 s; senha errada é recusada.
- [ ] O mesmo fluxo de transferência na casa de show.

## Eventos e contratação
- [ ] Criar evento público e privado (casa) e evento particular sem casa (contratante independente, com local).
- [ ] Evento privado: aparece para conta de artista em "Oportunidades" com selo; não aparece para visitante, contratante, nem na página inicial.
- [ ] Com 1 vaga, selecionar uma candidatura muda o evento para "Vagas preenchidas" e bloqueia novas candidaturas.
- [ ] Recusar a proposta/encerrar a negociação dessa candidatura → candidatura "Vaga cancelada" e evento volta a "Inscrições abertas".
- [ ] Convidar artista pelo perfil vinculando o evento ocupa vaga.
- [ ] Adiar (com mensagem) → artistas notificados; "Definir nova data" restaura o estado.
- [ ] Cancelar evento (com motivo) → candidaturas e negociações encerradas e artistas notificados.
- [ ] "Aceitar proposta" e "Confirmar contratação" abrem modal do sistema (nunca alerta do navegador); "Encerrar negociação" pede motivo em modal.
- [ ] Comparar rider disponível na negociação e na análise de candidaturas.
- [ ] Show confirmado de evento público aparece na página inicial ("Próximos shows confirmados") com local, horário e artista, e no perfil/página da casa; de evento privado aparece no perfil só como "Evento privado".

## Notificações
- [ ] Sino mostra contador de não lidas; lista as recentes; "Marcar todas como lidas"; abrir uma leva ao destino.
- [ ] Notificações chegam para convites, candidaturas (nova/aceita/recusada), propostas, contrapropostas, mensagens, confirmação, cancelamento, vagas preenchidas, adiamento, transferência de propriedade, troca de senha.
- [ ] Preferências: desligar e-mails por categoria ou todos; link "desative com um clique" do e-mail funciona; avisos de segurança continuam chegando.

## Interface
- [ ] Página inicial no modelo de classificados: categorias (Todos, Músicos, Bandas, Casas de show, instrumentos), filtros, anúncios.
- [ ] Visitante encontra e busca casas de show (página inicial e "Casas de show").
- [ ] Rodapé sem botão "API"; "Documentação" abre a página de ajuda; Privacidade e Termos abrem.
- [ ] Nenhum texto em inglês; nenhuma rota exibida como texto (botões "Ver perfil público"/"Ver página pública").
- [ ] Celular (≈ 390 px), tablet (≈ 820 px) e desktop: sem rolagem horizontal, textos sem cortes, modais e menus utilizáveis, barra inferior no celular.
