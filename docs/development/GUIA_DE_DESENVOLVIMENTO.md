# RiderSync — Guia de desenvolvimento

Regras, convenções e fluxo de trabalho para quem desenvolve no RiderSync. Decisões já tomadas (e o porquê):
[`../decisions/DECISOES_TECNICAS.md`](../decisions/DECISOES_TECNICAS.md). Mapa da documentação: [`../README.md`](../README.md).

## Escopo vigente

- MVP v1.1 com as evoluções de 18/11, 19/11 e 22/11/2026. **Editais/oportunidades culturais estão adiados**: não criar
  `CulturalOpportunity`, `OpportunityRequirement`, rotas, telas, seeds ou testes relacionados sem decisão do responsável.
- Fora do escopo: pagamentos (valores são combinados fora da plataforma), recomendações automáticas, substituição de
  equipamentos, agenda avançada, produtoras/agências/festivais. **Avaliações pós-show (0–5) e contratos em PDF fazem
  parte do produto.**
- A evolução de 18/11 ([`../product/REQUISITOS_EVOLUCAO_2026-11-18.md`](../product/REQUISITOS_EVOLUCAO_2026-11-18.md)) e
  as decisões seguintes substituem regras anteriores quando houver conflito.
- Ordem de prioridade entre documentos: decisões recentes do responsável → `docs/decisions/DECISOES_TECNICAS.md` (seções
  datadas; a mais recente prevalece) → `docs/product/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt` → `docs/references/`
  (arquitetura original e protótipos: só referência histórica/visual).
- `docs/reports/` e `docs/history/` são registros datados — não descrevem o estado atual.

## Regras críticas de domínio

- Contas separadas por `User.accountType` (ARTIST × CONTRACTOR). CPF obrigatório no cadastro; CNPJ obrigatório em casas.
- `Artist` é a identidade artística comum (SOLO ou BAND), com FK para `MusicianProfile` **ou** `Band`
  (CHECK `Artist_exactly_one_subtype`). Rider, portfólio, candidaturas, bookings e performances usam `artistId`.
- Eventos sem casa usam `Organization` `INDIVIDUAL`; visibilidade `PUBLIC`/`PRIVATE`/`HIDDEN`; estados incluem
  `FILLED` e `POSTPONED`; candidatura `CANCELLED` = vaga cancelada. Localidade restrita a Alagoas.
- **Vaga só é ocupada por contratação CONFIRMADA.** A confirmação verifica conflito de agenda do artista e do local
  (advisory locks) e gera o contrato.
- **Rider = o que o artista PRECISA para tocar**; `RiderItem.ownedQuantity` = quanto ele já leva; a casa cobre só a
  diferença (`riders/compatibility.ts`). `EventApplication.needs` está descontinuada (coluna mantida, sem uso).
- Negociação a partir de candidatura começa com o cachê do evento ou com a contraproposta da candidatura
  (`EventApplication.proposedFeeCents`).
- E-mail de contato só é público com `showContactEmail = true`.

## Arquitetura e convenções

- `backend/`: **um** NestJS monólito modular (`src/modules/*`), **um** PostgreSQL via Prisma. Sem microsserviços,
  Redis, filas, CQRS, event sourcing ou WebSocket (tempo real = `GET /me/pulse` consultado pelo frontend).
- `frontend/`: **uma** SPA React + Vite responsiva. Estado remoto no TanStack Query; formulários RHF + Zod.
- Autorização sempre no backend via `AccessService` (vínculo `ACTIVE` + papel). Nunca confiar em papel/ID do cliente.
- Regras puras ficam em `*.rules.ts`, `riders/compatibility.ts` e `contracts/contract-data.rules.ts` — com testes unitários.
- Textos de interface e mensagens de erro em português do Brasil.
- Erros da API: `{ statusCode, code, message, details? }` com os helpers de `backend/src/common/errors.ts`.
- Escritas exigem `X-Requested-With: RiderSync` (o cliente `frontend/src/lib/api.ts` já envia).
- Valores monetários em centavos; datas em ISO com offset; UI no fuso America/Maceio.
- Endpoints públicos usam `select` explícito; nunca expor `User.email`, CPF/CNPJ, hash, mensagens ou convites.

## Comandos

```bash
npm ci                     # instala tudo (npm workspaces; lockfile único na raiz)
npm run db:up              # PostgreSQL local (docker compose); Podman: export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock
npm run db:migrate         # prisma migrate deploy no banco local (não destrutivo)
npm run db:seed            # dados FICTÍCIOS (bloqueado em produção); db:seed:showcase = vitrine com imagens + histórico
npm run dev:api            # :3000  (Swagger /api/docs)
npm run dev:web            # :5173  (proxy /api)
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e           # Playwright em :3100/:5174 com banco ridersync_e2e
```

Nova migration: edite `backend/prisma/schema.prisma`, rode `cd backend && npx prisma migrate dev --create-only --name <nome>`,
revise o SQL (CHECKs à mão quando necessário) e aplique com `npx prisma migrate dev`. Migrations são sempre aditivas.
No banco remoto (staging), só com autorização do responsável: `npm run db:migrate:neon:staging -w backend`, antes do deploy.

## Segurança operacional

- **Nunca** executar `prisma migrate reset`, `db push --force-reset`, `git reset --hard`, `git clean -fd` ou apagar
  volumes/bancos.
- Testes de integração só rodam contra `ridersync_test` (o `globalSetup` recusa outro banco).
- Não versionar `.env*` (só os `.env.example`). Não expor segredos. Não enviar e-mails reais em testes; contas de teste
  usam `@demo.ridersync.local`.
- Deploy, variáveis da Vercel e o Neon (staging/production) só com autorização do responsável.

## Fluxo de trabalho

1. Trabalhe numa branch (nunca direto na `main`, que publica Production na Vercel).
2. Antes de mudar código, leia a seção relevante de `docs/decisions/DECISOES_TECNICAS.md`.
3. Ao mudar regra de negócio, atualize/adicione testes (unitário + integração; E2E quando mudar fluxo de tela).
4. Valide com lint, typecheck, `npm test`, `npm run test:e2e` e `npm run build`.
5. Registre decisões novas em `docs/decisions/DECISOES_TECNICAS.md` e o progresso em
   `docs/reports/IMPLEMENTATION_PROGRESS.md`; mantenha `README.md` e `docs/architecture/` coerentes com o código.
6. Mensagens de commit em português (`feat:`, `fix:`, `docs:`, `chore:`).
