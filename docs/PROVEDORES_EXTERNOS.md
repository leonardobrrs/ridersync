# RiderSync — Provedores externos

| Integração | Situação | Depende de credencial? |
|---|---|---|
| Neon (PostgreSQL) | Em uso (branch `ridersync-staging`) | já configurada |
| Vercel Blob (arquivos, store privado `ridersync-staging-blob`) | Em uso | já configurada |
| Brevo (e-mail transacional) | **Em uso no Preview** (`BrevoTransport`) | `BREVO_API_KEY` + remetente verificado (configurado) |
| Resend (e-mail transacional) | Implementada (`ResendTransport`), alternativa | `RESEND_API_KEY` + domínio verificado |
| Google OAuth 2.0 (login) | Implementada (PKCE + validação do `id_token`) | **sim** — `GOOGLE_CLIENT_ID/SECRET` |
| Vercel Cron (manutenção diária) | Configurado em `backend/vercel.json` | `CRON_SECRET` já criado; o Cron só roda em deployments de Production |
| YouTube / Vimeo (miniaturas) | Implementado (YouTube por ID; Vimeo via oEmbed público) | não |

Nenhuma integração é simulada: sem credencial, e-mails ficam registrados como **não enviados** (`SKIPPED`, motivo
"provedor não configurado") e o botão "Entrar com Google" não aparece.

## Brevo — e-mails reais (em uso)

Conta Brevo (plano free: **300 e-mails/dia**). Driver `MAIL_DRIVER=brevo` usa a API transacional
`POST https://api.brevo.com/v3/smtp/email` com o cabeçalho `api-key`.

- Preview (projeto `ridersync`): `MAIL_DRIVER=brevo`, `BREVO_API_KEY` (Secret), `MAIL_FROM="RiderSync <projetao89@gmail.com>"`.
- Desenvolvimento local: `BREVO_API_KEY` no `backend/.env`, mas o driver padrão continua `log` (não envia).
  Para testar envio real localmente: `MAIL_DRIVER=brevo` no `backend/.env`.
- O remetente precisa estar verificado na Brevo (**Senders, Domains & Dedicated IPs**). Hoje só existe o remetente
  Gmail da conta, sem domínio próprio autenticado: as mensagens podem cair em spam. Para produção, autentique um
  domínio próprio (registros DKIM/DMARC indicados pela Brevo) e troque `MAIL_FROM` para um endereço desse domínio.
- Trocar a chave: Brevo → **SMTP & API → API Keys** → gerar nova chave e revogar a antiga; depois
  `vercel env add BREVO_API_KEY --environment preview --sensitive --force --project ridersync --scope projetao2`,
  `vercel redeploy <url-da-api>` e mover o alias `ridersync-api-staging.vercel.app`.

## Resend — habilitar e-mails reais (alternativa)

1. Crie a conta em https://resend.com e adicione um domínio que você controla (ex.: `mail.ridersync.app`).
2. Publique no DNS os registros SPF/DKIM exibidos pelo Resend e aguarde o status **Verified**.
   (Sem domínio verificado, o Resend só entrega para o e-mail dono da conta — útil apenas para testes.)
3. Crie uma API key com permissão **Sending access**.
4. No projeto Vercel `ridersync` (Preview e, quando for o caso, Production):
   ```bash
   vercel env add RESEND_API_KEY --environment preview --sensitive
   vercel env add MAIL_DRIVER --environment preview        # valor: resend
   vercel env add MAIL_FROM --environment preview          # ex.: RiderSync <nao-responda@mail.ridersync.app>
   ```
5. Faça um novo deploy de Preview. Teste: cadastro → e-mail "Confirme seu e-mail"; "Esqueci minha senha".
   Falhas aparecem como `FAILED` em `EmailOutbox` (`lastError`) e são reenviadas até 5 vezes.

## Google — habilitar "Entrar com Google"

1. Google Cloud Console → crie um projeto → **APIs e serviços → Tela de consentimento OAuth** (tipo Externo; escopos
   `openid`, `email`, `profile`; adicione usuários de teste enquanto o app estiver em modo de teste).
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
   - Origens JavaScript autorizadas: `https://ridersync-front-staging.vercel.app` (Preview) e `http://localhost:5173` (dev).
   - URIs de redirecionamento autorizados: `https://ridersync-front-staging.vercel.app/api/auth/google/callback`
     (e `http://localhost:5173/api/auth/google/callback`). O redirect usa `PUBLIC_APP_URL` + `/api/auth/google/callback`.
3. Cadastre na Vercel (Preview): `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (`--sensitive`). Confirme que
   `PUBLIC_APP_URL` aponta para o mesmo domínio autorizado.
4. Novo deploy de Preview. O botão aparece em `/entrar` e `/cadastro` (no cadastro, só após escolher o tipo de conta e aceitar os termos).

Regras de segurança implementadas: `state` com nonce em cookie HttpOnly assinado (HMAC com `APP_SECRET`, 10 min), PKCE S256,
validação de emissor/público/expiração/`email_verified`, redirecionamento pós-login apenas para caminhos internos. Se a conta
existente com o mesmo e-mail nunca confirmou o e-mail, a senha e as sessões são descartadas ao vincular o Google
(proteção contra sequestro prévio de conta).

## Vercel Cron

`backend/vercel.json` agenda `GET /api/internal/maintenance` diariamente às 06:00 UTC (03:00 em Maceió). A Vercel envia
`Authorization: Bearer <CRON_SECRET>`. A rotina: transições automáticas de eventos por data, reenvio de e-mails com
falha e retenção (sessões/tokens expirados, notificações antigas, outbox). **Crons só executam em Production**; em Preview
as transições por data ocorrem sob demanda (antes das consultas de eventos, no máximo 1×/min por instância).
