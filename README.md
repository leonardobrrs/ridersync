# RiderSync

Plataforma de profissionalização artística para músicos, bandas e casas de show de Alagoas: perfis profissionais,
portfólio, riders técnicos, inventário das casas com comparação de compatibilidade, oportunidades de apresentação,
candidaturas e negociações (propostas, contrapropostas, mensagens e confirmação de contratação).

> MVP v1.1. **Editais/oportunidades culturais estão adiados.** A plataforma **não processa pagamentos**.

## Stack

- **Frontend**: React 19 + TypeScript + Vite (SPA responsiva) · React Router · TanStack Query · React Hook Form + Zod
- **Backend**: NestJS 11 — **um único monólito modular** · REST + Swagger · Zod
- **Dados**: PostgreSQL 16 + Prisma 6 (migrations versionadas)
- **Testes**: Jest + Supertest (API), Vitest (UI), Playwright (E2E)
- **Ambiente**: Docker Compose

```
.
├── backend/                 API NestJS
│   ├── prisma/              schema.prisma + migrations (inclui CHECKs e catálogo técnico)
│   ├── src/common/          validação Zod, erros, regras de membership
│   ├── src/modules/         auth, account, access, media, artists, bands, organizations,
│   │                        marketplace, riders, events, bookings, dashboard
│   ├── src/seed/            seed de demonstração (somente desenvolvimento)
│   └── test/                testes de integração (Supertest + PostgreSQL)
├── frontend/                SPA React
│   ├── src/features/        telas por domínio
│   ├── src/components/      layout, campos, estados, diálogos
│   └── e2e/                 testes Playwright
├── docs/                    decisões, progresso, demonstração, referências
└── docker-compose.yml       db + api + web
```

## Pré-requisitos

- Node.js 22 LTS (≥ 22.12) e npm 10
- Docker com Compose v2 (ou Podman com `podman.socket`, veja abaixo)

## Início rápido (desenvolvimento)

```bash
npm ci                                   # instala frontend e backend (workspaces, lockfile único)
cp backend/.env.example backend/.env     # valores padrão funcionam com o compose
sed 's#/ridersync?#/ridersync_test?#; s#NODE_ENV=development#NODE_ENV=test#; s#./storage#./test-storage#' \
  backend/.env.example > backend/.env.test && echo "THROTTLE_AUTH_LIMIT=10000" >> backend/.env.test
npm run db:up                            # PostgreSQL (cria também ridersync_test e ridersync_e2e)
npm run db:migrate                       # aplica migrations no banco de desenvolvimento
npm run db:seed                          # (opcional) dados FICTÍCIOS de demonstração
npm run dev:api                          # API em http://localhost:3000/api  · Swagger em /api/docs
npm run dev:web                          # SPA em http://localhost:5173 (proxy de /api → :3000)
```

### Aplicação completa via Docker Compose

```bash
docker compose up --build                # web em http://localhost:8080 · API em http://localhost:3000/api
# com dados de demonstração:
API_NODE_ENV=development SEED_DEMO=true docker compose up --build
```

O container da API executa `prisma migrate deploy` (não destrutivo) antes de iniciar. Portas configuráveis por
`POSTGRES_PORT`, `API_PORT`, `WEB_PORT` (veja `.env.example`).

**Podman**: `systemctl --user start podman.socket` e
`export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock` — o `docker compose` passa a usar o Podman.
Em sistemas com SELinux o bind mount do script de init usa o rótulo `:z`.

## Contas de demonstração (somente desenvolvimento)

Criadas por `npm run db:seed`. Dados **fictícios**; senha de desenvolvimento para todas: `demo-ridersync-2026`.

| E-mail | Papel na demo |
|---|---|
| `ana@demo.ridersync.local` | Musicista (perfil público), OWNER da banda Maré Alta, recebeu proposta direta |
| `davi@demo.ridersync.local` | ADMIN da banda Maré Alta |
| `lia@demo.ridersync.local` | MEMBER da banda Maré Alta (só visualiza) |
| `joao@demo.ridersync.local` | Musicista; tem convite pendente para a Maré Alta |
| `bia@demo.ridersync.local` | Musicista em Penedo |
| `rafael@demo.ridersync.local` | OWNER da casa Galpão Jaraguá (inventário, evento aberto, candidatura e proposta) |
| `marina@demo.ridersync.local` | OWNER da casa Casa Sururu |

Roteiro de demonstração: [`docs/DEMO.md`](docs/DEMO.md).

## Comandos

| Comando (raiz) | O que faz |
|---|---|
| `npm run lint` | ESLint backend + frontend |
| `npm run typecheck` | `tsc --noEmit` backend + frontend |
| `npm test` | Jest (unitários + integração no banco `ridersync_test`) e Vitest |
| `npm run test:e2e` | Playwright: sobe API (:3100) e SPA (:5174) isoladas no banco `ridersync_e2e` |
| `npm run build` | build de produção da API e da SPA |

Primeira execução do E2E: `npx -w frontend playwright install chromium`.

Os testes de integração recusam-se a rodar se `DATABASE_URL` não apontar para `ridersync_test` e só limpam dados desse banco.

## Segurança (resumo)

Sessão server-side em cookie `HttpOnly`/`SameSite=Lax` (`Secure` em produção), senha com scrypt, proteção CSRF por
cabeçalho + verificação de origem, CORS por allowlist, autorização por vínculo no backend em todas as operações,
validação Zod de toda entrada, uploads validados por assinatura binária. Detalhes em
[`docs/DECISOES_TECNICAS.md`](docs/DECISOES_TECNICAS.md).

## Variáveis de ambiente (backend)

Veja `backend/.env.example`. Principais: `DATABASE_URL`, `CORS_ORIGINS`, `COOKIE_SECURE` (use `true` sob HTTPS),
`SESSION_TTL_HOURS`, `STORAGE_DRIVER` (`local`|`s3`) e `S3_*`, `SEED_DEMO`. A API valida as variáveis ao iniciar.

## Documentação

- [`docs/DECISOES_TECNICAS.md`](docs/DECISOES_TECNICAS.md) — modelo de dados, permissões, estados, segurança, armazenamento
- [`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md) — progresso por fatia e resultados de testes
- [`docs/DEMO.md`](docs/DEMO.md) — roteiro de demonstração
- [`docs/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt`](docs/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt) e `docs/references/` — referências de produto
- Swagger: `http://localhost:3000/api/docs`
