# RiderSync — Variáveis de ambiente (backend)

Validadas na inicialização por `backend/src/config/env.ts` (falha cedo com mensagem clara). Valor vazio equivale a não definido.
Modelo comentado: `backend/.env.example`. O frontend não usa variáveis em produção (chama `/api` na mesma origem).

| Variável | Obrigatória | Padrão | Uso |
|---|---|---|---|
| `NODE_ENV` | não | `development` | `production` na Vercel (inclusive Preview). Bloqueia seed e o driver de e-mail `log`. |
| `PORT` | não | `3000` | Porta local. |
| `DATABASE_URL` | **sim** | — | PostgreSQL (Neon: URL *pooled*). |
| `CORS_ORIGINS` | não | `http://localhost:5173` | Lista separada por vírgula; `*` casa um único rótulo DNS. Também valida `Origin` no CSRF. |
| `COOKIE_SECURE` | não | `false` | `true` em HTTPS. |
| `SESSION_TTL_HOURS` | não | `168` | Duração da sessão. |
| `STORAGE_DRIVER` | não | `local` | `local` (só dev), `s3` ou `vercel-blob`. Na Vercel, `local` é recusado. |
| `BLOB_READ_WRITE_TOKEN` | com `vercel-blob` | — | Injetada ao conectar o Blob store ao projeto. |
| `S3_*` | com `s3` | — | Bucket, região, endpoint e credenciais. |
| `PUBLIC_APP_URL` | recomendada | `http://localhost:5173` | Origem pública da SPA: links dos e-mails e redirect do Google. |
| `APP_SECRET` | **em produção** | segredo efêmero em dev | ≥ 32 caracteres. Assina links de descadastro e o estado do OAuth. |
| `CRON_SECRET` | para o cron | — | ≥ 16 caracteres. Sem ela, `/api/internal/maintenance` responde 404. |
| `MAIL_DRIVER` | não | `log` (dev) / `disabled` (produção) | `resend` (envio real), `log` (dev: não envia), `disabled`. |
| `RESEND_API_KEY` | com `resend` | — | Chave da API do Resend. |
| `MAIL_FROM` | não | `RiderSync <nao-responda@ridersync.app>` | Remetente em domínio verificado no Resend. |
| `MAIL_DEV_OUTBOX_DIR` | não | — | Somente dev/testes: grava e-mails do driver `log` em JSON. |
| `EMAIL_VERIFICATION_REQUIRED` | não | `false` | `true` = login só após confirmar o e-mail. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | juntas, para Google | — | Login com Google. Sem elas o botão não aparece e a rota responde 400. |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES` | não | `5` / `15` | Bloqueio de conta por tentativas. |
| `THROTTLE_AUTH_LIMIT` | não | `20` | Requisições/min por IP nas rotas de autenticação. |
| `PRIVACY_CONTACT_EMAIL` | não | `privacidade@ridersync.app` | Contato do encarregado (LGPD). |
| `SWAGGER` | não | — | `true` habilita `/api/docs` em produção. |
| `SEED_DEMO` | não | `false` | Habilita o seed de demonstração (nunca em produção). |

## Situação na Vercel (projeto `ridersync`) — 2026-11-18

| Variável | Preview | Development | Production |
|---|---|---|---|
| `DATABASE_URL` (Neon staging) | ✔ | ✔ | — (proposital) |
| `COOKIE_SECURE`, `CORS_ORIGINS`, `STORAGE_DRIVER` | ✔ | ✔ | — |
| `BLOB_READ_WRITE_TOKEN` | ✔ | ✔ | — |
| `APP_SECRET`, `CRON_SECRET` (gerados aleatoriamente, secretos) | ✔ | ✔ | — |
| `PUBLIC_APP_URL` | `https://ridersync-front.vercel.app` | `http://localhost:5173` | — |
| `RESEND_API_KEY`, `MAIL_DRIVER=resend`, `MAIL_FROM` | **pendente (credencial)** | — | — |
| `GOOGLE_CLIENT_ID/SECRET` | **pendente (credencial)** | — | — |
