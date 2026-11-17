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
