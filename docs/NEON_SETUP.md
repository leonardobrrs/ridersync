# RiderSync — Configuração do banco Neon (staging)

> Executado em 2026-11-17. Escopo: banco PostgreSQL no Neon para o backend NestJS + Prisma 6.
> **Nenhuma credencial aparece neste documento.** Os valores ficam apenas em arquivos locais ignorados pelo Git.

## 1. Identificação

| Item | Valor |
|---|---|
| Organização Neon | `org-blue-hill-10765316` |
| Projeto Neon | `raspy-sea-51272843` |
| Região do compute | `aws sa-east-1` (São Paulo) |
| PostgreSQL | 18.7 (Neon) — banco `neondb`, schema `public` |
| CLI | `neon` 9.6.0 (pacote oficial `neondatabase/neon-pkgs`) |

| Branch | ID | Endpoint | Origem | Padrão | Expiração | Uso |
|---|---|---|---|---|---|---|
| `production` | `br-damp-heart-b641825t` | (próprio) | — | sim | nenhuma | **não migrada, intocada** |
| `ridersync-staging` | `br-quiet-river-b6kimxr4` | `ep-spring-frog-b6qm7107` | `production` | não | **nenhuma** | staging migrado e validado |

`.neon` (contexto local, ignorado pelo Git) aponta para `ridersync-staging`.

### Política de expiração (`neon.ts`)
O `neon.ts` só declara Postgres (`auth: false`, nenhum outro serviço) e aplica `ttl: "7d"` **apenas a branches novas
criadas pela política** (`neon checkout --create` / `neon deploy`). Por isso staging foi criada com
`neon branches create` (sem `--expires-at`) e o contexto foi trocado com `neon checkout ridersync-staging --no-env-pull`
(branch existente → política retorna `{}`). Resultado verificado: `expires_at: null`.
**Não use `neon checkout --create` nem `neon deploy` para recriar staging**, ou a branch nova expiraria em 7 dias.

## 2. Configuração de conexão

| Arquivo (em `backend/`) | Branch | Versionado? | Conteúdo (nomes) |
|---|---|---|---|
| `.env` | PostgreSQL local (Docker/Podman) | não | configuração completa de desenvolvimento — **inalterado** |
| `.env.neon` | `production` | não | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_BRANCH_ID` — **inalterado** |
| `.env.neon-staging` | `ridersync-staging` | não | mesmos nomes, gerados por `neon env pull` |

Nomes reais fornecidos pela CLI e verificados (sem exibir valores):

- `DATABASE_URL` → host com sufixo `-pooler` (**pooled**), `sslmode=require` — usado pela aplicação.
- `DATABASE_URL_UNPOOLED` → mesmo endpoint sem `-pooler` (**direta**), `sslmode=require` — usado pelo Prisma Migrate.
- `NEON_BRANCH=ridersync-staging`, `NEON_BRANCH_ID=br-quiet-river-b6kimxr4`.

Proteção no Git: `.gitignore` da raiz (`.env`, `.env.*`, `.neon`) e `backend/.gitignore` (`.env.neon*`).
Verificado com `git check-ignore` antes de baixar as credenciais.

Driver: mantido o **Prisma Client padrão (engine nativo, TCP)** — adequado para um servidor NestJS de longa duração,
conforme a skill `neon-postgres` (preservar ORM/driver existente; pooled para a aplicação, direta para migrations).
`schema.prisma`, migrations e a versão do Prisma (6.19.3) **não foram alterados**.

Para regenerar as credenciais de staging:

```bash
neon env pull --service postgres --branch ridersync-staging --file backend/.env.neon-staging
```

## 3. Scripts (`backend/package.json`)

| Script | O que faz | Conexão |
|---|---|---|
| `dev:neon:staging` | API em modo watch contra staging | `DATABASE_URL` (pooled) |
| `db:status:neon:staging` | `prisma migrate status` (somente leitura) | `DATABASE_URL_UNPOOLED` (direta) |
| `db:migrate:neon:staging` | `prisma migrate deploy` (não destrutivo) | `DATABASE_URL_UNPOOLED` (direta) |
| `dev:neon` / `db:migrate:neon` | equivalentes para **production** (criados antes; production ainda não foi migrada) | idem |

Uso (na raiz): `npm run dev:neon:staging -w backend`, `npm run db:migrate:neon:staging -w backend`.

**Precedência das variáveis**: `dotenv -o -e .env.neon-staging` carrega o arquivo do Neon **sobrescrevendo** inclusive
variáveis já exportadas no shell; depois a API (`main.ts`) e o Prisma CLI carregam `backend/.env` **sem sobrescrever**,
então só completam o que faltar (CORS, cookie, storage…). As variáveis de conexão vêm sempre do arquivo Neon.

**Trava de segurança**: os três scripts de staging abortam com
`ABORTADO: .env.neon-staging nao aponta para ridersync-staging` se `NEON_BRANCH` não for `ridersync-staging`.

Verificações de precedência executadas (classificando o destino, sem imprimir URLs):

| Cenário | Destino |
|---|---|
| cadeia de `dev:neon:staging` + `DATABASE_URL` local exportada no shell | Neon **pooled** `ep-spring-frog-b6qm7107` |
| cadeia de `db:migrate:neon:staging` | Neon **direta** `ep-spring-frog-b6qm7107` |
| mesma trava usando o arquivo de production | **abortado** (exit 1) |
| scripts normais (`start:dev`, `prisma:deploy`) | continuam no PostgreSQL local |

## 4. Migrations aplicadas em staging

1. `npm run db:status:neon:staging -w backend` → destino `ep-spring-frog-b6qm7107…neon.tech`, `20261117113114_init` pendente.
2. Inspeção somente leitura: staging não tinha nenhuma tabela.
3. `npm run db:migrate:neon:staging -w backend` → `Applying migration 20261117113114_init` → `All migrations have been successfully applied.`
4. Status após migração → `Database schema is up to date!`
5. `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --exit-code` → `No difference detected.` (exit 0)

Estrutura verificada em staging:

- 21 tabelas de domínio + `_prisma_migrations` (`finished_at` preenchido, sem rollback, 1 passo aplicado).
- 15 CHECK constraints — todas as da migration (`Artist_exactly_one_subtype`, `PortfolioItem_url_xor_media`,
  `RiderItem_catalog_xor_custom`, `RiderItem_quantity_positive`, `VenueEquipmentItem_venue_only`,
  `Event_deadline_before_start`, `Booking_origin_matches_application`, `Booking_confirmed_has_audit`, entre outras).
- 46 chaves estrangeiras; 62 índices (43 únicos), incluindo `User_email_key`, `EventApplication_eventId_artistId_key`,
  `BandMember_bandId_userId_key`, `OrganizationMember_organizationId_userId_key`, `Booking_applicationId_key`,
  `RiderItem_riderId_catalogItemId_key`.
- Catálogo técnico: **20 itens** (Áudio 10, Backline 6, Palco e energia 4).

Nenhum seed de demonstração, `migrate reset`, `db push`, `TRUNCATE` ou `DROP` foi executado.

## 5. Teste real de integração (API → Neon staging)

API iniciada com `npm run dev:neon:staging -w backend` (trava aprovada) e exercitada pelos endpoints reais:

| # | Teste | Resultado |
|---|---|---|
| 1 | `GET /api/health` | PASS — HTTP 200 |
| 2 | `GET /api/catalog/equipment` | PASS — HTTP 200, 20 itens |
| 3 | `POST /api/auth/register` | PASS — HTTP 201; cookie `rs_session` com `HttpOnly`, `SameSite`, `Path`, `Max-Age` |
| 4a | `POST /api/auth/logout` → `GET /api/auth/me` sem cookie | PASS — 204 → 401 |
| 4b | login com senha errada | PASS — 401 `INVALID_CREDENTIALS` |
| 4c | `POST /api/auth/login` + `GET /api/auth/me` com cookie | PASS — 200 / 200 |
| 5 | `POST /api/me/musician-profile` | PASS — 201, `SOLO`, `PRIVATE` |
| 6a | `GET /api/me/musician-profile` | PASS — perfil persistido retornado |
| 6b | `GET /api/artists/:id/rider` | PASS — rider próprio criado com o perfil |
| 6c | `GET /api/public/artists/:slug` (perfil privado) | PASS — 404 |

**10/10 aprovados.**

Persistência confirmada por consulta direta ao banco staging: 1 `User`, 1 `Session`, 1 `MusicianProfile`,
1 `Artist`, 1 `TechnicalRider` para o usuário do teste. A mesma consulta no PostgreSQL **local** retornou 0 —
prova de que a API estava conectada ao Neon, não ao banco local.

### Dados sintéticos utilizados (removidos)

| Campo | Valor |
|---|---|
| E-mail | `smoke-staging-20261117132249@ridersync-staging.example` (domínio reservado `.example`) |
| `User.id` | `c4dbc90c-26ad-42cf-8848-13acfd56949f` |
| `Artist.id` | `1ba45760-3912-458e-9a5b-877ac9060838` (slug `artista-sintetico-20261117132249`) |

Limpeza: `DELETE` pontual em `"User"` filtrando por id **e** e-mail sintético (1 linha); sessão, perfil, artista e
rider removidos por `ON DELETE CASCADE`. Estado após limpeza: 0 linhas para o teste e **0 usuários em staging**.
Staging permanece com schema completo + catálogo técnico.

A suíte Jest/Supertest **não** foi executada contra o Neon (ela trunca tabelas); continua usando `ridersync_test` local.

## 6. Verificação final

| Comando | Resultado |
|---|---|
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm test` | backend 9 suítes / 78 testes passando (banco local `ridersync_test`); frontend 2 arquivos / 7 testes |
| `npm run build` | OK |

- Production intacta: metadados idênticos ao instantâneo inicial (`updated_at 2026-11-17T13:14:44Z`,
  `logical_size 31711232`, sem reset, sem expiração); `neon branches schema-diff production ridersync-staging` mostra as
  22 tabelas **somente** em staging e 0 linhas removidas/alteradas em production. `neon deploy` não foi executado.
- `backend/.env`, `backend/.env.neon` e `docker-compose.yml` com hash idêntico ao de antes; container
  `ridersync-db-1` e volumes locais preservados.
- `git status`: nenhum arquivo de credencial rastreado ou fora do `.gitignore`.

## 7. Pendências para publicar na Vercel

1. **Formato de execução do backend**: a API é um servidor NestJS de longa duração. Na Vercel é preciso adaptá-la
   (função Node com o app Express do Nest, preferencialmente em Fluid compute) ou hospedar a API em outro serviço Node e
   publicar só a SPA na Vercel.
2. **Mesma origem para o cookie de sessão**: publicar SPA e API sob o mesmo domínio (rewrite `/api/*` → API). Em domínios
   diferentes, o cookie `SameSite=Lax` não é enviado.
3. **Variáveis de ambiente na Vercel** (por ambiente Preview/Production): `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`
   (só para migrations), `NODE_ENV=production`, `COOKIE_SECURE=true`, `CORS_ORIGINS=<domínio>`, `SESSION_TTL_HOURS`.
4. **Migrations fora do runtime**: rodar `prisma migrate deploy` com a URL direta em CI/etapa de release antes do deploy,
   nunca no início de cada função.
5. **Arquivos**: o disco da Vercel é efêmero — configurar `STORAGE_DRIVER=s3` (`S3_BUCKET`, `S3_REGION`, credenciais) ou
   avaliar armazenamento de objetos; o adapter S3 existe, mas ainda não foi exercitado contra um bucket real.
6. **Prisma em ambiente serverless**: gerar o client no build (o `postinstall` já faz isso) e, com várias instâncias,
   limitar conexões por instância (`connection_limit` na URL pooled) se necessário.
7. **Rate limit em memória** não é compartilhado entre instâncias — aceitável no MVP, revisar em produção.
8. **Production**: ainda sem schema. Migrar somente com autorização, após validar em staging
   (`npm run db:migrate:neon -w backend`), e decidir se `production` deve ficar protegida no Neon.
9. Opcional: integração Neon ↔ Vercel para branches de preview automáticas.
