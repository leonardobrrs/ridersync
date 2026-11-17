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
