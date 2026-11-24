# RiderSync — Configuração da Vercel (Preview / staging)

Time `projetao2` (Hobby). Dois projetos ligados ao repositório GitHub `ridersync` (branch de produção `main`).

| Projeto | Root Directory | Framework | Node | Região | Domínio de produção |
|---|---|---|---|---|---|
| `ridersync` (API) | `backend` | NestJS (`backend/vercel.json`) | 22.x (dashboard + `engines`) | `gru1` | `ridersync-mu.vercel.app` |
| `ridersync-front` | `frontend` | Vite (`frontend/vercel.json`) | 22.x (dashboard + `engines`) | — (estático) | `ridersync-front.vercel.app` |

## Variáveis da API (`ridersync`) — Preview e Development

| Variável | Valor / origem |
|---|---|
| `DATABASE_URL` | Neon branch `ridersync-staging` (pooled). **Production não tem** — Neon Production não é usado. |
| `COOKIE_SECURE` | `true` |
| `CORS_ORIGINS` | Preview: `https://ridersync-front.vercel.app,https://ridersync-front-*-projetao2.vercel.app`; Development: `http://localhost:5173` |
| `STORAGE_DRIVER` | `vercel-blob` |
| `BLOB_READ_WRITE_TOKEN` | injetada pela conexão do Blob store `ridersync-staging-blob` (privado, `gru1`) |

`CORS_ORIGINS` é uma lista separada por vírgula; `*` casa apenas **um rótulo DNS** (`[a-z0-9-]+`), e a mesma lista
valida o `Origin` no guard de CSRF (`backend/src/config/env.ts`, `originMatcher`).

## Comunicação front → API (mesma origem)

O navegador só fala com o domínio do front. `/api/:path*` é reescrito **no servidor da Vercel** para
`https://ridersync-api-staging.vercel.app/api/:path` (no destino de regras de projeto use `:path`, sem `*`) por uma **regra de roteamento do projeto** `ridersync-front`
(`vercel routes`, nome "API RiderSync (staging)"), que também define o cabeçalho `x-vercel-protection-bypass` com o
segredo *Protection Bypass for Automation* da API. O segredo fica só na configuração da Vercel: não está no
repositório, no bundle nem chega ao navegador.

- O cookie `rs_session` (HttpOnly, Secure, SameSite=Lax, sem `Domain`) é gravado no domínio do front.
- Escritas exigem `X-Requested-With: RiderSync` e `Origin` permitida (CSRF).
- `frontend/vercel.json` só contém o fallback do SPA, que **não** captura `/api/`.

`ridersync-api-staging.vercel.app` é um alias atribuído manualmente ao deployment de Preview da API em uso
(veja abaixo). Para trocar a API de staging, basta reatribuir o alias — o front não precisa de novo deploy.

## Deployment Protection

Ambos os projetos mantêm **Standard Protection** (Vercel Authentication em Preview e URLs geradas). A API aceita o
proxy do front graças ao bypass de automação; acesso direto às URLs de Preview da API continua exigindo login Vercel.
As rotas privadas continuam protegidas pela sessão da aplicação.

## Primeiro deploy de Preview

Sempre a partir da **raiz** do repositório (o Root Directory de cada projeto é aplicado pela Vercel e o
`package-lock.json` dos workspaces fica na raiz). O `.vercelignore` da raiz impede o envio de `.env*`, `dist/` etc.

```bash
vercel deploy --project ridersync --scope projetao2 --yes        # Preview da API → imprime a URL
vercel alias set <URL-da-API> ridersync-api-staging.vercel.app --scope projetao2
vercel deploy --project ridersync-front --scope projetao2 --yes  # Preview do front
```

Regra de rota "API RiderSync (staging)" do `ridersync-front`: **publicada** em 2026-11-17
(`vercel routes publish` no projeto do front). Enquanto estiver só em staging, ela vale apenas no alias de teste
de rotas. Atenção: regras de projeto valem para **todos** os ambientes, inclusive a produção do front.

## Estado em 2026-11-17

- API Preview `ridersync-jhsjo916p-projetao2.vercel.app` ← alias `ridersync-api-staging.vercel.app`.
- Front Preview `ridersync-front-lgsnmpzzh-projetao2.vercel.app` (protegido por login Vercel).
- `ridersync-front.vercel.app` (produção do front): Preview promovido em 2026-11-17 (`vercel promote`) → `ridersync-front-lrrazu2cq-projetao2.vercel.app`; usa a API de staging via a regra de rota.
- Testes ao vivo pelos dois domínios do front: cadastro, login/logout, sessão, CSRF, rota privada, upload/leitura/
  exclusão no Blob — todos PASS. Usuários de teste removidos do staging.
- Limite da Vercel: corpo de requisição de função ≤ 4,5 MB — PDFs de até 10 MB aceitos pela API falharão no upload.
- Neon staging populado com o seed de demonstração (`src/seed/demo-seed.ts`, idempotente, só adiciona): 7 contas
  fictícias `<nome>@demo.ridersync.local` (ana, lia, davi, joao, bia, rafael, marina) com a senha de desenvolvimento
  definida no seed. O app de staging é público: trate essas contas como públicas.

## Publicar um Preview da versão de 2026-11-18 (evolução: contas, eventos, notificações, LGPD)

Pré-requisitos já feitos: variáveis `APP_SECRET`, `CRON_SECRET` e `PUBLIC_APP_URL` criadas em Preview/Development
(ver `docs/operations/VARIAVEIS_DE_AMBIENTE.md`). Nada disto toca o Neon **Production**.

1. Ponto de restauração do staging (Neon CLI): `neon branches create --name staging-pre-evolucao --parent ridersync-staging`.
2. Migration no staging (não destrutiva, com trava de branch): `npm run db:migrate:neon:staging -w backend`.
   A partir daqui o Preview antigo continua funcionando (migration aditiva) enquanto não houver dados com os estados novos.
3. Deploy da API (Preview) e alias estável:
   ```bash
   vercel deploy --project ridersync --scope projetao2 --yes
   vercel alias set <URL-da-API> ridersync-api-staging.vercel.app --scope projetao2
   ```
4. Dados de demonstração (opcional): ver `docs/development/SEEDERS.md`.
5. Deploy do front (Preview): `vercel deploy --project ridersync-front --scope projetao2 --yes`.
6. Validar com `docs/development/CHECKLIST_TESTES_MANUAIS.md`.
7. Credenciais externas pendentes (Resend e Google): `docs/operations/PROVEDORES_EXTERNOS.md`.

Rollback: reatribuir o alias `ridersync-api-staging.vercel.app` ao deployment anterior da API e, se necessário,
restaurar o staging a partir da branch do passo 1 (a migration não remove dados; ver `ROLLBACK.md` da migration).

## Estado em 2026-11-18 — Preview da evolução publicado (branch `feat/evolucao-ridersync`)

| Item | Valor |
|---|---|
| Neon | backup `staging-pre-evolucao` (`br-weathered-bar-b66k9nvk`, filha de `ridersync-staging`, sem expiração); migration `20261118120000_*` aplicada **só** em `ridersync-staging`; `production` intocada |
| Seed | executado 2× no staging (idempotente); contas `@demo.ridersync.local`, senha `Demo@RiderSync2026` |
| API (Preview) | deployment da branch, alias **`ridersync-api-staging.vercel.app`** |
| Front (Preview) | deployment da branch, alias **`ridersync-front-staging.vercel.app`** |
| Variáveis alteradas (Preview da API) | `PUBLIC_APP_URL=https://ridersync-front-staging.vercel.app`; `CORS_ORIGINS` = front-staging + `ridersync-front-*-projetao2.vercel.app` |

### Regras de roteamento do projeto `ridersync-front` (valem para todos os deployments)

| # | Regra | Condição | Destino |
|---|---|---|---|
| 1 | `API RiderSync (front-staging)` | `has host = ridersync-front-staging.vercel.app` (igualdade exata) | `https://ridersync-api-staging.vercel.app/api/:path` |
| 2 | `API RiderSync (site publico, API legada)` | `missing host = ridersync-front-staging.vercel.app` | `https://ridersync-api-legado.vercel.app/api/:path` |

As duas injetam `x-vercel-protection-bypass` com o segredo de automação da API (só na configuração da regra; não está no
código, no bundle nem no navegador). O segredo anterior foi **revogado** em 2026-11-18 e substituído.

`ridersync-api-legado.vercel.app` fixa o deployment **antigo** da API (`ridersync-jhsjo916p`), para que o site público
(`ridersync-front.vercel.app`, front antigo) continue exatamente como estava, sem passar a falar com a API nova.
O site público continua usando o banco de **staging** (não existe API de produção configurada) — decisão pendente.

### Acesso ao Preview

`ridersync-front-staging.vercel.app` é um deployment de Preview, protegido pela *Vercel Authentication*: abra logado na
Vercel com uma conta do time `projetao2`. Para testes automatizados use o segredo de automação do projeto `ridersync-front`
(`x-vercel-protection-bypass`). Links de e-mail e o retorno do Google também passam por essa proteção.

### Atualizar o Preview depois de novos commits na branch

Cada push em `feat/evolucao-ridersync` gera deployments de Preview nos dois projetos, mas os aliases **não** se movem
sozinhos: depois que ficarem *Ready*, rode `vercel alias set <url-api> ridersync-api-staging.vercel.app` e
`vercel alias set <url-front> ridersync-front-staging.vercel.app` (escopo `projetao2`). Se mudar variáveis da API, faça
`vercel redeploy <url-api>` antes de mover o alias (as variáveis são fixadas no deploy).

## Production publicada (2026-11-20)

`main` recebeu a branch `feat/evolucao-ridersync` (merge `9d0f6b7`, com o README do Herberty). Decisão do responsável:
**Production usa o mesmo banco do staging** (`ridersync-staging` no Neon; o branch `production` do Neon segue sem uso).

| Item | Production |
|---|---|
| Site público | `ridersync-front.vercel.app` (deploy de produção do `ridersync-front`, a partir da `main`) |
| API | `ridersync-mu.vercel.app` (deploy de produção do projeto `ridersync`) |
| Regra de rota 2 do front | renomeada `API RiderSync (site publico, producao)`: `missing host = ridersync-front-staging.vercel.app` → `https://ridersync-mu.vercel.app/api/:path` (a API legada deixou de ser usada) |
| Variáveis da API | as do Preview passaram a valer também em Production (banco, Blob, e-mail Brevo, Google, `APP_SECRET`, `CRON_SECRET`, `COOKIE_SECURE`, `STORAGE_DRIVER`); próprias de Production: `PUBLIC_APP_URL` e `CORS_ORIGINS` = `https://ridersync-front.vercel.app`, `GOOGLE_REDIRECT_URI` = `https://ridersync-front.vercel.app/api/auth/google/callback` |

`APP_SECRET` é o mesmo do Preview porque assina os links de descadastro gravados em e-mails e o banco é compartilhado.
Pendente: autorizar o callback de Production no cliente OAuth do Google Cloud Console.

**Painel de administração (`/adm`, 23/11):** variáveis `ADMIN_USERNAME` e `ADMIN_PASSWORD_HASH` (hash Argon2id, gerado com
`npm run admin:hash -w backend`; nunca a senha) no projeto `ridersync`, em Production e Preview (o banco é o mesmo). Sem elas o
painel responde 404. Para trocar a senha: gere outro hash, substitua `ADMIN_PASSWORD_HASH` e faça redeploy (as sessões abertas caem).
