# CLAUDE.md — RiderSync

Guia para agentes trabalhando neste repositório. Leia também a skill `.claude/skills/ridersync-domain/SKILL.md`
(regras de domínio) e `docs/DECISOES_TECNICAS.md` (decisões já tomadas).

## Escopo

- MVP v1.1. **Editais/oportunidades culturais estão ADIADOS**: não criar `CulturalOpportunity`, `OpportunityRequirement`,
  rotas, telas, seeds ou testes relacionados sem reativação explícita do responsável.
- Fora do MVP: pagamentos, IA/recomendações, substituição de equipamentos, agenda avançada, avaliações/reviews,
  produtoras/agências/festivais.
- Ordem de autoridade: decisões explícitas recentes do usuário → `docs/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt` →
  skill `ridersync-domain` → `docs/references/Arquitetura_*.md` → protótipos HTML (só referência visual).

## Arquitetura

- `backend/`: **um** NestJS monólito modular (`src/modules/*`), **um** PostgreSQL via Prisma. Não criar microserviços,
  Redis, filas, CQRS ou event sourcing.
- `frontend/`: **uma** SPA React + Vite responsiva. Estado remoto no TanStack Query; formulários RHF + Zod.
- `Artist` é a identidade artística comum (SOLO ou BAND) com FK explícita para `MusicianProfile` **ou** `Band`
  (CHECK `Artist_exactly_one_subtype`). Riders, portfólio, candidaturas, bookings e performances usam `artistId`.
- Autorização sempre no backend via `AccessService` (vínculo `ACTIVE` + papel). Nunca confiar em papel/ID vindo do cliente.
- Regras puras ficam em `*.rules.ts` e `riders/compatibility.ts` — adicione testes unitários ao alterá-las.

## Comandos

```bash
npm ci                     # instala tudo (workspaces; lockfile na raiz)
npm run db:up              # PostgreSQL (docker compose); Podman: export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock
npm run db:migrate         # prisma migrate deploy (não destrutivo)
npm run db:seed            # dados FICTÍCIOS (bloqueado em produção)
npm run dev:api            # :3000  (Swagger /api/docs)
npm run dev:web            # :5173  (proxy /api)
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e           # Playwright em :3100/:5174 com banco ridersync_e2e
```

Nova migration: edite `backend/prisma/schema.prisma`, rode `cd backend && npx prisma migrate dev --create-only --name <nome>`,
revise o SQL (adicione CHECKs à mão quando necessário) e aplique com `npx prisma migrate dev`.

## Regras de segurança operacional

- **Nunca** executar `prisma migrate reset`, `db push --force-reset`, `git reset --hard`, `git clean -fd` ou apagar volumes/bancos.
- Testes de integração só rodam contra `ridersync_test` (o `globalSetup` recusa outro banco).
- Não versionar `.env`; use `backend/.env.example`. Não enviar e-mails reais nem publicar dados.
- Endpoints públicos devem usar `select` explícito; nunca expor `User.email`, hash, mensagens ou convites.

## Convenções

- Textos de interface e mensagens de erro em português do Brasil.
- Erros da API: `{ statusCode, code, message, details? }`; use os helpers de `backend/src/common/errors.ts`.
- Requisições de escrita exigem `X-Requested-With: RiderSync` (o cliente `frontend/src/lib/api.ts` já envia).
- Valores monetários em centavos; datas em ISO com offset; UI no fuso America/Maceio.
- Ao concluir uma fatia, atualize `docs/IMPLEMENTATION_PROGRESS.md`.
