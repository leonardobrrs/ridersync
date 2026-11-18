# RiderSync — Checklist do que foi implementado/alterado (evolução de 2026-11-18)

## Banco de dados
- [x] Migration `20261118120000_evolucao_contas_eventos_notificacoes` (aditiva) + `ROLLBACK.md`.
- [x] Novas tabelas: `UserToken`, `Notification`, `NotificationPreference`, `EmailOutbox`.
- [x] `User`: tipo de conta, e-mail confirmado, Google, avatar, consentimento, bloqueio de login, anonimização; senha opcional.
- [x] `Event`: visibilidade, local livre, `FILLED`/`POSTPONED`, carimbos; `ApplicationStatus.CANCELLED`; `OrganizationType.INDIVIDUAL`.
- [x] `EquipmentCatalogItem.artistRequirement`; `PortfolioItem.thumbnailUrl`; `MediaAsset.thumbKey/width/height`.
- [x] CHECKs novos e índices; tradução dos nomes de catálogo em inglês; backfill de tipo de conta.
- [x] Aplicada e validada no PostgreSQL local (dev/test/e2e); **não** aplicada no Neon (nem staging nem production).

## Backend
- [x] Argon2id + migração transparente do scrypt; política de senha; confirmação de senha.
- [x] Cadastro com tipo de conta e aceite LGPD; confirmação de e-mail (opcionalmente obrigatória); recuperação de senha.
- [x] Bloqueio por tentativas; rate limit específico para e-mails.
- [x] Google OAuth 2.0 (PKCE, state assinado, validação do id_token, proteção contra sequestro prévio de conta).
- [x] Módulo de e-mail (Resend real / log de desenvolvimento / desativado) e templates escapados.
- [x] Notificações internas + outbox transacional, deduplicação, preferências, descadastro assinado, e-mails de segurança obrigatórios.
- [x] Exportação de dados e exclusão/anonimização de conta; aceite de nova versão da política.
- [x] Enforcement de tipo de conta em perfis, bandas, casas, convites e eventos independentes.
- [x] Eventos: públicos/privados, independentes, máquina de estados, vagas com lock, cascata no cancelamento, adiar/remarcar, varredura automática.
- [x] Negociações: convites vinculados a evento ocupando vaga, vaga cancelada, notificações, ordem de locks.
- [x] Agenda pública (home, perfil, casa) respeitando privacidade.
- [x] Função do integrante (lista), OWNER só por transferência com senha (bandas e casas).
- [x] Rider sem exigências do local; comparação só em contexto autorizado.
- [x] Mídia: reprocessamento com sharp (sem EXIF, miniatura), avatar privado, foto de contratante individual privada; limites alinhados à Vercel.
- [x] Miniaturas de YouTube/Vimeo; busca por @handle; filtro por instrumento; endpoint da página inicial.
- [x] Localidade restrita a Alagoas (102 municípios).
- [x] Manutenção diária (Cron) com política de retenção; `CRON_SECRET`.
- [x] `InvitationsController` sem Prisma no controller; marketplace separado em serviço.
- [x] Variáveis de ambiente novas validadas; valor vazio = ausente.

## Frontend
- [x] Página inicial no modelo de classificados (categorias, filtros, anúncios mistos, shows confirmados, oportunidades).
- [x] Cadastro com tipo de conta, senha com olho e requisitos, confirmação, termos, foto, Google; login com Google e "Esqueci minha senha".
- [x] Páginas: confirmar e-mail, redefinir senha, descadastro, Privacidade, Termos, Documentação/Ajuda.
- [x] Sino de notificações, central e preferências; aviso de e-mail não confirmado; modais obrigatórios (tipo de conta legado, nova política).
- [x] Conta e privacidade: avatar, senha (inclusive definir), exportar, excluir com 3 s, encerrar sessões.
- [x] Perfil público com abas, foto sem "estourar" + ampliação, miniaturas, próximos eventos, @handles clicáveis, sem comparação.
- [x] Casas: busca para visitantes, próximos shows; imagem na criação de perfil, banda e casa.
- [x] Bandas/casas: função em lista, papéis sem OWNER, botão "Transferir propriedade" com senha e temporizador.
- [x] Eventos: visibilidade, eventos particulares, adiar/remarcar/cancelar com motivo, vagas ocupadas, convites.
- [x] Negociação: aceitar/confirmar/recusar/encerrar com modais do sistema; comparar rider; nenhum `window.confirm/prompt`.
- [x] Navegação e guardas por tipo de conta; rodapé sem "API"; rotas não exibidas como texto; termos em inglês removidos.
- [x] CSS responsivo (celular, tablet, desktop) e redução de imagens no navegador antes do upload.

## Testes e documentação
- [x] Backend: 201 testes (unitários + integração); frontend: 13; Playwright: desktop, tablet e celular.
- [x] Seed idempotente e rico; documentação (arquitetura, modelo de dados, variáveis, provedores, testes, seeders, deploy, LGPD, decisões, relatório, checklists).
- [x] Variáveis `APP_SECRET`, `CRON_SECRET`, `PUBLIC_APP_URL` criadas na Vercel (Preview/Development); nenhum deploy, commit ou push.
