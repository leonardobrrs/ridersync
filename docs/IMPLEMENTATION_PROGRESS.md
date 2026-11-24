# RiderSync — Progresso da implementação

> Documento de retomada. Escopo: MVP v1.1 (editais/oportunidades culturais ADIADOS — não implementar).
> Última atualização: 2026-11-17.

## Status por fatia

| # | Fatia | Status |
|---|-------|--------|
| 0 | Inspeção do repositório e documentos | concluída |
| 1 | Fundação: monorepo (workspaces), Docker Compose, NestJS, Prisma, Zod, Swagger, erros, Vite/React | concluída |
| 2 | Auth: cadastro, login, logout, sessão cookie HttpOnly, CSRF, conta (nome, senha) | concluída |
| 3 | Perfil individual (`MusicianProfile` + `Artist`), visibilidade e requisitos de publicação | concluída |
| 4 | Bandas, memberships, convites, papéis OWNER/ADMIN/MEMBER, último OWNER, transferência | concluída |
| 5 | Casas de show (`Organization` VENUE), responsáveis, convites, papéis | concluída |
| 6 | Marketplace público + filtros, páginas públicas, portfólio (links https + upload validado) | concluída |
| 7 | Catálogo técnico, riders independentes, inventário, comparação determinística | concluída |
| 8 | Eventos (oportunidades), estados, candidaturas, análise, vagas | concluída |
| 9 | Booking: proposta direta / a partir de candidatura, ofertas imutáveis, mensagens, confirmação auditada | concluída |
| 10 | Painel (pendências), apresentações confirmadas e histórico (`Performance`) | concluída |
| 11 | Hardening, testes (Jest/Supertest/Vitest/Playwright), Docker, documentação | concluída |

## Ambiente

- Node v22.22.2 / npm 10.9.7. O repositório **não** é git (nada foi inicializado/commitado).
- Docker daemon indisponível (sem sudo). Usado **Podman rootless** com socket compatível:
  `systemctl --user start podman.socket` e `export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock`.
- Bancos no container `ridersync-db-1`: `ridersync` (dev, com seed demo), `ridersync_test` (integração), `ridersync_e2e` (Playwright).
- Arquivos pré-existentes na raiz (zips, HTMLs, `.sh`, `.txt`, `.md`) foram preservados sem alteração.

## Arquivos principais

- Backend: `backend/src/modules/*`, `backend/src/common/*`, `backend/prisma/schema.prisma`,
  `backend/prisma/migrations/20261117113114_init/migration.sql`, `backend/src/seed/demo-seed.ts`, `backend/test/*`.
- Frontend: `frontend/src/features/*`, `frontend/src/components/*`, `frontend/src/lib/*`, `frontend/e2e/*`.
- Infra: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `backend/docker/*`.

## Migrations

- `20261117113114_init` — todas as tabelas do MVP, CHECKs de domínio (subtipo único de `Artist`, url XOR arquivo,
  catálogo XOR personalizado, quantidades, prazo ≤ data, origem do booking, confirmação auditada, inventário só VENUE)
  e o catálogo técnico de referência (20 itens com IDs estáveis).
- Aplicada com `prisma migrate dev` no banco dev limpo e `prisma migrate deploy` em `ridersync_test`/`ridersync_e2e`.
  `prisma migrate status` → "up to date"; `prisma migrate diff` (banco × schema) → "No difference detected".

## Verificação executada (resultados reais, 2026-11-17)

| Comando | Resultado |
|---|---|
| `npm ci` (raiz) | ok (postinstall gera o Prisma Client) |
| `npm run lint` | backend e frontend sem erros |
| `npm run typecheck` | backend e frontend sem erros |
| `npm test` | backend: 9 suítes, **78 testes passando** (unitários + integração em PostgreSQL); frontend: 2 arquivos, **7 testes passando** |
| `npm run build` | API (nest build) e SPA (vite) ok |
| `npm run test:e2e` | **5/5 passando** (desktop + Pixel 7): visitante/login, cadastro/logout/erro, validação, fluxo MVP completo, celular |
| `docker compose build` + `up` | imagens `api` e `web` construídas; health ok via nginx, login por cookie, upload de arquivo no volume |

Cenários negativos cobertos: perfil/organização/booking de terceiros (403/404), último OWNER (banda e casa),
MEMBER tentando administrar, visitante em rotas privadas (401/redirect), CSRF sem cabeçalho, candidatura duplicada,
proposta para perfil privado, autonegociação, upload com tipo falso, link não-https.

## Limitações conhecidas / próximos passos sugeridos

- Recuperação de senha e e-mails de convite (exigem provedor de e-mail autorizado).
- Exclusão de conta (definir destino de bandas/casas e histórico).
- Adapter S3 implementado mas não exercitado contra bucket real.
- Notificações em tempo real (hoje: revalidação periódica de 20 s na tela de negociação).
- Limpeza agendada de sessões expiradas.
- `deepmerge-ts` (aviso do `npm audit`) vem só do CLI do Prisma 6.

## Vercel Preview / staging (2026-11-17)

Detalhes em `docs/VERCEL_SETUP.md`.

- API (`ridersync`): Node 22.x, `gru1`, Standard Protection mantida + segredo *Protection Bypass for Automation*.
  Variáveis Preview/Development: `COOKIE_SECURE=true`, `CORS_ORIGINS`, `STORAGE_DRIVER=vercel-blob`,
  `BLOB_READ_WRITE_TOKEN` (Blob store privado `ridersync-staging-blob`, `gru1`), `DATABASE_URL` (Neon staging, inalterada).
- Front (`ridersync-front`): Node 22.x; `/api/:path*` → `ridersync-api-staging.vercel.app` por regra de rota do projeto
  (injeta o bypass no servidor; segredo fora do repo e do navegador). `frontend/vercel.json` só tem o fallback do SPA.
- Código: `engines.node = 22.x` (backend/frontend), `.vercelignore` na raiz (a CLI não usa o `.gitignore`),
  `.env.example` documenta `vercel-blob`.
- Testes reais: driver Vercel Blob (put/get/delete, store privado → 403 sem token); fluxo pelo proxy do front com
  as variáveis de Development (registro, login, `/auth/me`, CSRF sem cabeçalho e com Origin estranha → 403,
  upload/leitura/exclusão de foto, logout → 401). Usuário sintético removido do staging; store vazio.

## Evolução completa (2026-11-18) — `requisitos_ridersync.md`

Detalhes: `docs/RELATORIO_EVOLUCAO.md` (situação de cada requisito), `docs/CHECKLIST_IMPLEMENTACAO.md`,
`docs/CHECKLIST_TESTES_MANUAIS.md`, `docs/ARQUITETURA.md`, `docs/LGPD.md`.

- Contas por tipo (artista × contratante), senha forte (Argon2id), confirmação de e-mail, recuperação de senha, bloqueio por
  tentativas, Google OAuth (aguarda credenciais), exportação/exclusão de conta (LGPD), política/termos versionados.
- Notificações (sino, central, preferências, e-mail via outbox; Resend aguarda credenciais).
- Eventos públicos/privados, eventos de contratante independente, vagas com lock e estados automáticos
  (FILLED, vaga cancelada, adiado, cancelado, realizado), agenda pública de shows confirmados.
- Perfis: abas, miniaturas de vídeo, foto sem perda de nitidez, @handles, imagem na criação, função do integrante,
  transferência de propriedade com senha e 3 s, rider sem exigências do local, comparação só em contexto autorizado.
- Página inicial no modelo de classificados; casas visíveis/pesquisáveis por visitantes; rodapé sem API; documentação.
- Migration `20261118120000_*` aplicada só em bancos locais. Seed v2 idempotente.

| Verificação | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | sem erros |
| Backend (Jest: 13 unitários + 8 integração) | **201 testes passando** |
| Frontend (Vitest) | **13 testes passando** |
| Playwright (desktop/tablet/celular) | **17 testes passando** (inclui regressão da home) |
| `npm run build` | API e SPA ok |

## Lote de UX, responsividade e agenda (2026-11-18)

- **Agenda**: confirmação rejeita sobreposição de horário para o mesmo artista/banda e para o mesmo local
  (`409 SCHEDULE_CONFLICT`), com advisory locks contra confirmações concorrentes; evento esgotado rejeita candidatura,
  proposta e confirmação (`409 EVENT_FULLY_BOOKED`). Testes: `agenda.rules.spec.ts` (8) e `test/agenda.e2e-spec.ts` (11,
  PostgreSQL real; o teste de concorrência falha se os locks forem removidos).
- **Cadastro/login**: duas opções + modal acessível; Google visível desde o início (`test/google-signup.e2e-spec.ts`).
- **Foto única**: removida a foto de conta; `/auth/me` expõe `profilePhotoUrl` (dados antigos preservados).
- **Layout**: descrições/nomes/URLs longos não estouram cards, perfil, painel, propostas e agenda; home e barra inferior
  revisadas em 1440/1280/768/390/360/320 px; ícones de instrumento/função.

| Verificação | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | sem erros |
| Backend (Jest, unitários + integração) | **230 testes passando** (25 suítes) |
| Frontend (Vitest) | **15 testes passando** |
| Playwright (desktop/tablet/celular) | **18 testes passando** |
| Auditoria de layout com dados extremos (7 páginas públicas + 5 do painel × 6 larguras) | 46/72 com problema antes → **0/72** depois |
| `npm run build` | API e SPA ok |

## Reunião de 18/11 (`docs/reuniao18_11.md`)

| Item | Situação |
|---|---|
| Celular: tirar filtro de instrumentos | Feito (fica no painel "Filtros") |
| Chat da negociação em pop-up (celular) | Feito (barra fixa + painel sobreposto; desktop na lateral) |
| Responsividade no celular (logo, fontes, cards, espaçamentos) | Feito (logo sem fundo esticado; 2 colunas de cards até 330 px; categorias sem quebra) |
| Feed por tipo de perfil | Feito (ver `DECISOES_TECNICAS.md`) |
| Espaçamento em "Próximos shows" | Feito (textos colados por elementos em linha) |
| Máscara de telefone | Feito (perfil e casa; exibição formatada) |
| Menus fecham ao clicar fora | Feito (`useDismiss`: menu do perfil e sino) |
| Enter envia mensagem | Feito (Shift+Enter quebra linha) |
| Feed do artista: casas e oportunidades em cards | Feito (também em `/oportunidades`) |
| Imagem do evento | Feito (migration `20261118200000_imagem_do_evento`) |
| Acesso direto à casa pelo menu do perfil | Feito (e "Minha casa" na barra inferior) |

Verificação: backend 232 testes; frontend 26; Playwright 24 (desktop, tablet, celular); lint, typecheck e build ok.
Migration aplicada só nos bancos locais.

### Correções pós-Preview (18/11)

| Pedido | Situação |
|---|---|
| Categorias do topo no celular | "Explorar" na barra inferior abre painel com as categorias; barra do topo só no desktop |
| Evento "Inscrições abertas" com vagas preenchidas | Corrigido (regra única de vaga + reconciliação automática dos dados existentes) |
| Selecionar candidatura não ocupa vaga | Feito ("Selecionar e negociar"; vaga só fecha na confirmação) |
| Contador do chat só com não lidas | Feito (migration `20261118210000_leitura_de_mensagens`) |

Verificação: backend 237 testes; frontend 28; Playwright 24 (desktop, tablet, celular); lint e typecheck ok.

## Reunião com o professor (19/11) — concluída
- ~~Rider = equipamentos que o artista possui; necessidades por candidatura (`needs`)~~ — **revisto em 23/11** (ver abaixo): o rider é o que o artista precisa.
- Evento oculto, criação única de evento com convites, "Observações", aba e página de eventos encerrados, eventos clicáveis.
- Contratar nas condições do evento; avaliações 0–5 estrelas pós-show (dois lados), médias nos perfis públicos.
- Home sem "Casas de show" no topo, busca ao digitar, redirecionamento após candidatura, sem quebra de palavras no meio.
- Migration `20261119120000_reuniao_professor` (aditiva), aplicada no staging Neon após branch de restauração `staging-pre-reuniao-professor`.
- Validação: backend 246, frontend 31, Playwright 28, lint/typecheck/build ok; smoke remoto no Preview.
- Ajustes pós-revisão: aviso do rider sem quebra de layout; candidatura em modal (identidade, necessidades e mensagem); busca de convite limpa após escolher o artista; contratante tem "Meus eventos" no topo e no Explorar em vez de "Eventos encerrados".
- Candidatura: em evento numa casa de show, o inventário da casa vem pré-marcado em "Já oferecido pela casa" (o artista desmarca e ajusta); "Outros itens" para o resto. Corrigido o retorno indevido à home quando se clicava num resultado logo após a busca ao digitar.


## Módulo de contratos (20/11) — branch `feat/contracts-module`
- Contrato PDF gerado automaticamente quando a contratação é confirmada (confirmação normal e "contratar nas condições do evento"), a partir dos templates `venue-artist.md` / `individual-artist.md`; download autenticado para as duas partes; geração sob demanda como recuperação.
- Backend: módulo `contracts` (service, controller, regras puras `contract-data.rules.ts`, `fill-template`, `to-extenso`, `generate-pdf`), migration `20261120120000_modulo_contratos` (aditiva, com CHECKs), termos de contrato opcionais na oferta, dados civis (`User`), razão social/CNPJ (`Band`, `Organization`), LGPD (exportação e anonimização).
- Frontend: seção "Condições do contrato" na proposta/contraproposta, cartão "Contrato" na negociação, "Dados para contrato" em Conta, na casa e na banda.
- Decisões e diferenças em relação à spec: `DECISOES_TECNICAS.md` ("Módulo de contratos"). Relatório: `CONTRACT_MODULE_REPORT.md`.
- Validação: backend 190 testes unitários + 127 de integração (12 suítes, incl. `contracts.e2e-spec.ts`), frontend 38, typecheck/lint/build de ambos ok; migration aplicada e conferida num banco Supabase. **Não verificados**: PDF visual (sem poppler), Playwright, e a inclusão dos templates `.md` no bundle da Vercel (conferir no Preview).
- Revisão (21/11): atualizar contrato com dados completados depois da confirmação (até a data do show), aviso de dados faltantes por lado antes e depois de confirmar, fonte embutida no PDF (espaçamento correto em qualquer leitor), assinaturas sem quebra de página, prazo do saldo no modelo da casa, cláusula 6ª para artista solo. Testes: integração de contratos 17, componente 7, e2e `contracts.spec.ts` (confirmação → download do PDF → atualização).
- Revisão pós-staging (21/11): atualização do contrato liberada enquanto confirmado (também após o show); notificação e e-mail às duas partes a cada geração/atualização; botão "Meus dados para contrato" para os dois lados; e2e do contratante pessoa física.
- Decisão do responsável (21/11): contrato bloqueado após o show (apresentação registrada ou data passada), com aviso "Show realizado em …" e botão "Atualizar contrato" desativado.
- Pendências do contrato: só na tela da negociação ("O que falta preencher"); no PDF, campos ausentes viram linhas em branco. Cartão do contrato reorganizado (ações em grade; empilhadas no celular). Formulário de evento: campos alinhados pelo topo.

## Reunião de 22/11 (2026-11-23)

CPF obrigatório no cadastro (e no primeiro acesso via Google), CNPJ obrigatório para casas, confirmações de ações,
atualização em tempo real (`/me/pulse`), histórico completo de negociações com filtro pessoal × banda, negociação
iniciada com o cachê do evento, contraproposta já na candidatura (inclusive pelo card da lista de oportunidades),
histórico e total de shows no perfil público e botão de tema claro/escuro. Decisões em `DECISOES_TECNICAS.md`.

| Verificação | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | sem erros |
| Backend (Jest, unitários + integração) | **349 testes passando** (35 suítes; novo `test/reuniao-22-11.e2e-spec.ts`) |
| Frontend (Vitest) | **46 testes passando** |
| Playwright | **32 testes passando** (novo `e2e/reuniao-22-11.spec.ts`: tema, contraproposta pela lista, tempo real, abas) |
| `npm run build` | API e SPA ok |

Antes de publicar no staging: aplicar a migration nova (`npm run db:migrate:neon:staging`).

## Correção do conceito de rider (23/11) — branch `feat/rider-update`
- Rider = o que o artista **precisa** para tocar; inventário da casa = o que a casa **oferece**. Textos, ajudas, guia rápido e docs corrigidos (a decisão de 19/11 tinha invertido o conceito).
- Novo `RiderItem.ownedQuantity` (quanto o artista já possui; CHECK 0..necessário). Editor do rider com a coluna "Já possuo" (catálogo e itens personalizados), limitada ao necessário.
- Comparação (`compareRider`): a casa cobre o que tem; o resto só conta se o artista já possui. Ex.: precisa de 2, possui 1, a casa tem 1 → **compatível**, com 1 da casa e 1 do artista, e aviso "Você precisa levar 1 un" (voz do contratante: "O artista vai levar").
- Perfil público da casa com abas **Sobre/Rider**; ao abrir **Rider**, o artista logado vê a comparação automática (escolhe a identidade se tiver mais de uma). Visitante vê convite para entrar.
- Candidatura sem "necessidades" (`needs` descontinuada; `NeedsPicker` removido): o modal mostra a comparação do rider com a casa do evento; a casa compara o rider na análise e na negociação.
- Migration `20261123140000_rider_quantidade_possuida` (aditiva).
- Riders salvos antes da mudança (`updatedAt` < 23/11 20:00, Maceió) mostram o aviso “Revise seu rider” no painel até o próximo salvamento (`riderNeedsReview`), porque os itens cadastrados como “o que você possui” passam a valer como “o que você precisa”.
- Validação (já sobre a `feat/evolucao-ridersync`): backend 362 testes passando (36 suítes, incl. 9 unitários e 3 de integração novos do rider) contra `ridersync_test` local; frontend 52 (6 novos); Playwright 32 (desktop, tablet, celular); lint, typecheck e build ok.

## Painel de administração (23/11)

- `/adm` (sem link no sistema) com login próprio (`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` em Argon2id). Totais, busca e exclusão definitiva (individual ou em lote, com confirmação) de contas, artistas/bandas, casas/contratantes, eventos e negociações. Detalhes em `DECISOES_TECNICAS.md`.
- API `AdminModule` (`/api/admin/*`, fora do Swagger; 404 quando desativado). Mídias removidas do storage após o commit.
- Card de candidatura recebida reorganizado (ações abaixo do conteúdo; com 4 botões o texto era espremido em uma coluna).
- Validação: backend 368 testes (2 unitários e 4 de integração novos); frontend 59 (3 novos); Playwright 33 (1 novo, `/adm`); lint, typecheck e build ok.
