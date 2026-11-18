# RiderSync — Relatório da evolução (2026-11-18)

Especificação: `requisitos_ridersync.md`. Checklists: `docs/CHECKLIST_IMPLEMENTACAO.md` e `docs/CHECKLIST_TESTES_MANUAIS.md`.
Decisões e conflitos com regras anteriores: `docs/DECISOES_TECNICAS.md` (seção "Evolução de 2026-11-18").

## Situação de cada requisito

Legenda: **T** implementado e testado · **C** implementado, depende de credencial externa · **M** implementado, precisa de
validação manual · **P** parcialmente implementado · **N** não implementado (com justificativa).

### Boas práticas

| Requisito | Situação | Observação |
|---|---|---|
| Separação de responsabilidades (controllers magros, regras em serviços/`*.rules.ts`) | T | NestJS em camadas (não MVC artificial); Prisma removido do `InvitationsController`; marketplace separado em serviço. |
| Código limpo, comentários só para o "porquê" | M | Revisão manual recomendada. |
| Validação de entrada, XSS, SQL Injection | T | Zod em toda entrada; Prisma/queries parametrizadas; HTML de e-mail escapado; React escapa saída. |
| Senhas com Argon2/Bcrypt; UUIDs; controle de acesso granular | T | Argon2id com migração do scrypt; UUID em todas as entidades; autorização por vínculo. |
| Exceções sem vazar detalhes | T | Filtro global; teste de corpo de erro. |
| FKs, UNIQUE, transações, índices, sem N+1 | T | Ver `docs/MODELO_DE_DADOS.md`. |
| Soft delete para dados cruciais | P | Decisão: estados de negócio + anonimização LGPD em vez de `deletedAt` genérico (evita reter dados pessoais indevidamente). |
| Formato de entrega (visão, árvore, código completo) | N/A | Refere-se às respostas; a documentação cobre visão e estrutura. |

### Mudanças gerais

| Requisito | Situação | Observação |
|---|---|---|
| Página inicial no modelo do HTML (OLX) | T | Categorias, filtros, anúncios mistos, promo; e2e + verificação visual. |
| Bateria de testes de todo o sistema | T | Backend 201, frontend 13, Playwright 17 em 3 tamanhos de tela; roteiro remoto no Preview. |
| Padrões da LGPD + documento | M | Política, termos, exportação, exclusão, retenção, consentimento. Revisão jurídica recomendada. |
| Povoar o deploy com perfis (seeders) | P | Seed idempotente pronto e validado localmente; aplicar no staging junto com o deploy do Preview (ver "Pendências"). |
| Rotas sem vazamento; botões em vez de rota na URL | M | Guardas por login e tipo de conta; autorização no servidor; rotas exibidas como texto trocadas por botões. |
| E-mail de confirmação; conta só ativa após confirmar | C | Envio real depende do Resend. Bloqueio do acesso configurável (`EMAIL_VERIFICATION_REQUIRED`), **desligado** por sua orientação ("confirmação posterior possível"). |
| Senha com especial, maiúscula e número | T | Cliente e servidor. |
| Digitar a senha duas vezes | T | |
| Ícone de olho fechado/aberto | T | |
| Login com Google | C | Integração completa; falta `GOOGLE_CLIENT_ID/SECRET`. |
| Notificações por e-mail desativáveis facilmente | T / C | Preferências e descadastro com um clique testados; entrega real depende do Resend. |
| Eventos confirmados na área principal (local, horário, artista) | T | |
| Sino com todas as notificações | T | |
| Estados automáticos do evento (vagas preenchidas, vaga cancelada, cancelado, adiado, finalizado) | T | Inclui concorrência. |
| Responsividade web | T / M | Sem rolagem horizontal em desktop/tablet/celular (e2e); conferir em aparelhos reais. |
| Sistema totalmente em português | M | Varredura feita (inclusive catálogo técnico). |
| Corrigir link "Documentação" | T | Página `/ajuda`. |
| Tirar o botão de API | T | |
| Modal próprio em "Aceitar proposta" | T | E2e falha se surgir diálogo nativo. |
| Evento público ou privado | T | |

### Mudanças de perfis

| Requisito | Situação | Observação |
|---|---|---|
| Imagem na criação (bandas, casas, músicos, visitantes) | M | Seletor com pré-visualização nos formulários de criação; "visitante" = foto da conta (cadastro e Conta). Upload coberto por integração. |
| Portfólio e Rider em abas | T | |
| Miniatura de vídeo externo | T | YouTube (por ID) e Vimeo (oEmbed). |
| Rider sem exigências do local ("Palco e energia") | T | |
| "Comparar rider" fora do perfil público | T | Disponível na negociação, na análise de candidaturas e no painel do artista. |
| "Próximos eventos" no perfil | T | Privados aparecem só como "Evento privado". |
| Estados: restringir a Alagoas | T | 102 municípios com preenchimento automático. |
| "@" clicáveis | M | Perfis, integrantes, bandas, casas e anúncios. |
| Visitante vê e busca casas de show | T | |
| Dropdown de função/cargo dos membros | T | |
| Transferência: botão exclusivo, mensagem, senha, temporizador de 3 s | T | Transação atômica no servidor; senha validada no servidor. |
| Foto "estourando" ao abrir | M | Causa: recorte/ampliação no quadro 16:10. Correção na exibição + versão principal até 1600 px + ampliação. |
| Escolha obrigatória: artista ou proprietário/contratante | T | |
| Eventos sem casa de show (usuário comum contratando) | T | Conta de contratante → "Eventos particulares". |

## Arquivos e módulos alterados (principais)

- **Banco**: `backend/prisma/schema.prisma`, nova migration + `ROLLBACK.md`.
- **Backend novos**: `modules/mail/*`, `modules/notifications/*`, `modules/maintenance/*`, `modules/auth/{google,token,reauth}.service.ts`,
  `modules/account/{account.service,account-deletion.service}.ts`, `modules/events/{event-lifecycle,public-agenda}.service.ts`,
  `modules/marketplace/marketplace.service.ts`, `modules/media/{image-processing,upload}.ts`, `modules/organizations/invitations.service.ts`,
  `common/{al-cities,password-policy,video-thumbnail}.ts`.
- **Backend alterados**: `config/env.ts`, `common/{validation,domain-lists,errors}.ts`, `app.module.ts`, auth, account, access,
  artists, bands, organizations, events, bookings, riders, media, marketplace, dashboard, seed.
- **Frontend novos**: componentes `AccountGate`, `AccountTypeChooser`, `CityField`, `Media`, `NotificationBell`, `PasswordField`,
  `Tabs`, `TransferOwnershipDialog`; páginas `legal/LegalPages`, `notifications/NotificationPages`; `lib/password.ts`; `styles/features.css`.
- **Frontend alterados**: `App.tsx`, `Layout`, `Dialog`, `Icon`, auth, account, marketplace (home, perfil, casas), oportunidades,
  bandas, casas, eventos, negociações, perfil do artista, painel, tipos e formatações.
- **Testes**: 9 specs unitários novos/reescritos, 4 suítes de integração novas, e2e reescritos + `responsive.spec.ts`.
- **Configuração**: `backend/vercel.json` (Cron), `backend/.env.example`, `frontend/playwright.config.ts`.
- **Dependências**: `@node-rs/argon2` 2.2.2 e `sharp` 0.35.5 (binários Linux x64 no lockfile).

## Ambientes

- Migration aplicada nos bancos locais e, em 2026-11-18, no Neon **staging** (com backup `staging-pre-evolucao` antes); diff schema × banco vazio.
- Neon **production**: não alterado. Seed executado no staging. Preview publicado da branch `feat/evolucao-ridersync` (`ridersync-front-staging.vercel.app` → `ridersync-api-staging.vercel.app`); ver `docs/VERCEL_SETUP.md`.
- Vercel: criadas `APP_SECRET`, `CRON_SECRET` (aleatórias, secretas) e `PUBLIC_APP_URL` em Preview/Development do projeto `ridersync`.

## Pendências que dependem de você

1. **Resend**: conta, domínio verificado e `RESEND_API_KEY` + `MAIL_DRIVER=resend` + `MAIL_FROM` (ver `docs/PROVEDORES_EXTERNOS.md`).
2. **Google OAuth**: projeto no Google Cloud, redirect `https://ridersync-front-staging.vercel.app/api/auth/google/callback`, `GOOGLE_CLIENT_ID/SECRET`.
3. **Decidir o destino do site público** `ridersync-front.vercel.app` (front antigo + API antiga + banco de staging): promover a nova versão ou dar a ele um banco próprio.
4. **E-mail do encarregado (LGPD)** real em `PRIVACY_CONTACT_EMAIL` e revisão jurídica da política.
5. Revisar a branch `feat/evolucao-ridersync` e decidir o merge na `main`.

## Limitações conhecidas e riscos técnicos

- **Dependências nativas na Vercel** (`argon2`, `sharp`): validadas no Preview de 2026-11-18 (login com Argon2id e
  reprocessamento de imagem para WebP funcionando na função em `gru1`).
- **Cron só em Production**: no Preview, transições por data ocorrem sob demanda (antes das consultas, 1×/min por instância)
  e falhas de e-mail só são reenviadas na próxima ação que dispara notificações.
- **E-mail enviado dentro da requisição** (após o commit): adiciona a latência do provedor às ações que notificam; o outbox
  garante reenvio e evita duplicidade.
- **Uploads limitados a 4 MB** (limite de 4,5 MB do corpo das funções da Vercel); fotos maiores são reduzidas no navegador,
  PDFs acima de 4 MB são recusados com mensagem.
- **Evento privado** é visível a **qualquer** conta de artista (conforme o requisito), não apenas a convidados.
- **Itens antigos de rider** com exigências do local ficam ocultos até o próximo salvamento; **funções de banda** antigas
  em texto livre são preservadas e exibidas até serem trocadas.
- **Alagoas apenas**: perfis antigos de outra UF continuam existindo, mas edições exigem município de Alagoas.
- Nenhum teste automatizado contra Resend/Google/Vercel Blob reais (o Blob foi validado manualmente em 2026-11-17).
- **Página inicial com muitos shows** (corrigido em 2026-11-18, encontrado no Preview): o texto para leitor de tela dos cards
  escapava do carrossel e criava rolagem horizontal no celular/tablet. Correção em `global.css` (`.rowscroll` posicionado)
  e teste de regressão em `frontend/e2e/responsive.spec.ts`.
- **Preview protegido**: `ridersync-front-staging.vercel.app` exige login na Vercel (membros do time); links de e-mail e o
  retorno do Google também passam por essa proteção enquanto ela estiver ativa.
