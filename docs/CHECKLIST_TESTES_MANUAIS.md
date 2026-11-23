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
- [ ] Conta e privacidade: trocar nome e senha (a foto exibida é a do perfil/casa — não há mais foto de conta); "Baixar cópia" gera JSON sem senha; "Encerrar outras sessões".
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
- [ ] Com 1 vaga, "Selecionar e negociar" abre a proposta direto e o evento continua "Inscrições abertas"; dá para negociar com mais de um artista.
- [ ] Confirmar a contratação com 1 vaga → evento vira "Vagas preenchidas", fecha inscrições e recusa outra confirmação; cancelar essa contratação reabre o evento. Recusar uma proposta não mexe nas vagas (candidatura fica "Vaga cancelada").
- [ ] Convidar artista pelo perfil vinculando o evento NÃO ocupa vaga; com o evento esgotado, novo convite é recusado.
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

## Lote de UX e agenda (2026-11-18)

- [ ] `/cadastro`: só "Sou artista"/"Sou contratante" + "Continuar com Google"; o modal abre, troca de tipo sem perder dados, Esc/Voltar fecham.
- [ ] `/entrar`: "Entrar com Google" visível sem escolher nada.
- [ ] Perfil com descrição/URL enorme sem espaços: cards, perfil público, painel e propostas sem rolagem horizontal (320 px).
- [ ] Barra inferior no celular: item ativo marcado, nada coberto no fim da página, some ao digitar.
- [ ] Confirmar duas contratações do mesmo artista em horários sobrepostos → a segunda mostra "Conflito de agenda".
- [ ] Horários consecutivos (19h–22h e 22h–23h) → ambas confirmam.
- [ ] Evento com todas as vagas confirmadas: candidatura e nova proposta são recusadas; o evento continua na agenda.

## Reunião 18/11
- [ ] Celular e tablet: sem barra de categorias no topo; "Explorar" na barra inferior abre Para você/Todos, Músicos, Bandas, Casas de show e Oportunidades (artistas e visitantes). Instrumento fica em "Filtros".
- [ ] Celular: a logo do RiderSync mantém o fundo amarelo do tamanho do texto em qualquer largura (320, 360, 390, 412 px e tablet).
- [ ] Negociação no celular: barra "Mensagens" fixa no rodapé; ao tocar abre a conversa por cima da página; fecha no X, no fundo escuro e com Esc.
- [ ] Chat: Enter envia; Shift+Enter quebra a linha; se o envio falhar, o texto continua no campo.
- [ ] Conta de artista, "Para você": só oportunidades e casas de show em cards; abas Músicos/Bandas listam todos os perfis; busca por nome encontra artistas.
- [ ] Conta de contratante, "Para você": artistas e shows confirmados; sem "Oportunidades" no feed, no menu do topo e na barra inferior.
- [ ] "Próximos shows" (casa e perfil do artista) e cards de show: nome, título, local e horário em linhas separadas, sem textos colados.
- [ ] Telefone/WhatsApp (perfil e casa): ao digitar 82999998888 vira (82) 99999-8888; 8233334444 vira (82) 3333-4444; número incompleto é recusado.
- [ ] Menu do perfil e sino fecham ao clicar/tocar fora e com Esc.
- [ ] Criar evento (casa e evento particular) com imagem; a imagem aparece no card da oportunidade e na página do evento; "Remover imagem" funciona na edição.
- [ ] Evento privado com imagem: visitante e contratante não abrem a imagem; contas de artista sim.
- [ ] Contratante: o menu do perfil lista a(s) casa(s) de show e leva direto à gestão; no celular, "Minha casa" na barra inferior.
- [ ] Chat: a barra "Mensagens" mostra número só quando há mensagens NÃO lidas da outra parte; abrir o pop-up (ou ver a conversa no desktop) zera o número e marca o aviso "Nova mensagem" do sino como lido.
- [ ] Evento antigo que aparecia "Inscrições abertas" com todas as vagas confirmadas passa a "Vagas preenchidas" sozinho (e o contrário: "preenchido" sem contratação confirmada reabre).
- [ ] Filtros laterais (desktop) e painel "Filtros" (celular) com marcadores: marcar 2 estilos mostra artistas de qualquer um deles; 2 cidades idem; estilo + cidade combinam (os dois). "Outra cidade…" encontra municípios sem acento (ex.: "pao" → Pão de Açúcar); "limpar" zera o grupo; recarregar a página mantém as marcações.

## Reunião com o professor (19/11)
- [ ] Rider do perfil descrito como "equipamentos que você já possui".
- [ ] Candidatura: "O que você precisa que a casa disponibilize" — vem marcado o inventário da casa, menos o que já está no rider ("você já tem"); adicionar do catálogo, item livre, quantidade, "Desmarcar o que já tenho no rider".
- [ ] Casa: candidatura mostra as necessidades e "Comparar necessidades" com o inventário.
- [ ] Topo sem "Casas de show"; digitar na busca da página inicial filtra sem apertar Enter.
- [ ] Eventos clicáveis: card de show na home, "Próximos shows" da casa, "Próximos eventos" do artista, agenda e negociação.
- [ ] Oportunidades → aba "Encerrados"; evento fechado mostra aviso, todas as informações e as atrações confirmadas.
- [ ] "Novo evento" (pela casa ou por "Meus eventos") é a mesma tela: escolher casa ou outro local; Público/Privado/Oculto; "Observações" no lugar de "Requisitos".
- [ ] Evento oculto: some das oportunidades e da home; convidados (na criação ou em "Convidar artistas") recebem a proposta e veem o evento.
- [ ] "Contratar nas condições": confirma na hora com data/duração/cachê do evento; sem cachê definido fica indisponível.
- [ ] Registrar apresentação como realizada abre a avaliação (0 a 5 estrelas + comentário); o outro lado recebe o pedido; notas aparecem no perfil do artista e na página da casa.
- [ ] Celular: textos da tela de negociação não quebram palavras no meio.

- [ ] Rider: o editor pede "Quantidade que você tem"; "Comparar rider" mostra "os dois têm / a casa tem menos / só no rider" (informativo).
