# RiderSync — Seeders (dados de demonstração)

Arquivo: `backend/src/seed/demo-seed.ts`. Dados **fictícios** (nenhuma pessoa real; links de vídeo com IDs inexistentes).

- Bloqueado com `NODE_ENV=production` e exige `SEED_DEMO=true` ou `--force`. Nunca executa automaticamente.
- **Idempotente por entidade**: contas por e-mail, perfis/bandas/casas por slug, eventos por (organizador, título),
  candidaturas por (evento, artista), negociações por (organização, artista, título). Rodar de novo não duplica nada e
  completa o que faltar — inclusive sobre os dados da versão anterior do seed.
- Senha de todas as contas `@demo.ridersync.local`: `Demo@RiderSync2026` (reaplicada a cada execução).

## Conteúdo

| Tipo | Exemplos |
|---|---|
| Músicos (artista) | Ana Lins, Lia Ferraz, João Bezerra, Bia Tenório, Tiago Ramos (+ Davi e Ravi como integrantes) |
| Bandas e membros | Maré Alta (Ana dona, Davi administrador, Lia integrante, João convidado), Trio Agreste (João dono, Ravi) — funções definidas |
| Casas de show (contratante) | Galpão Jaraguá (Rafael), Casa Sururu (Marina), Teatro Ribeirinho (Helena) — com inventário |
| Contratantes independentes | Carla Menezes (aniversário privado), Eduardo Lopes (arraiá público e recepção privada) |
| Eventos | abertos, vagas preenchidas, encerrado, adiado, cancelado, realizado; públicos e privados; com e sem casa |
| Candidaturas | pendentes, aceitas, recusadas |
| Negociações | em negociação (inclusive com contraproposta), termos aceitos aguardando confirmação, confirmadas (públicas e privada), realizada |
| Notificações | exemplos para Ana, Rafael e João |

## Como executar

Local:
```bash
npm run db:seed                       # usa backend/.env
```

Staging (Neon `ridersync-staging`) — **somente depois** de aplicar as migrations e de publicar o código compatível
(os dados novos usam estados que a versão anterior da API não conhece):
```bash
cd backend
npm run db:migrate:neon:staging                     # prisma migrate deploy (não destrutivo, trava de branch)
npx dotenv -o -e .env.neon-staging -- sh -c '[ "$NEON_BRANCH" = ridersync-staging ] && npx tsx src/seed/demo-seed.ts --force'
```
Nunca rode contra a branch `production` do Neon.

## Seed de vitrine com imagens (`showcase-seed.ts`)

`npm run db:seed:showcase` = seed de demonstração + vitrine. Idempotente (não duplica; só põe imagem onde ainda não há).
Bloqueado com `NODE_ENV=production`.

- **Conteúdo:** 13 artistas solo e 4 bandas novas, 9 casas, 2 contratantes independentes, 27 eventos (abertos, lotados,
  encerrados, adiados, cancelados, realizados, privados e rascunho), 33 candidaturas, 20 negociações e apresentações
  realizadas. Agenda coerente: nenhuma contratação confirmada se sobrepõe (artista ou local) e evento `FILLED` tem todas
  as vagas confirmadas.
- **Imagens:** `backend/seed-assets/showcase/<tag>-<n>.jpg` (instrumentos, casas, palcos — sem rostos identificáveis),
  licenças CC0/PDM listadas em `CREDITS.json`. Cada imagem passa pelo mesmo processamento da API (WebP + miniatura) e vai
  para o storage configurado (`STORAGE_DRIVER`).
- **Contas novas (senha `Demo@RiderSync2026`):** artistas `caio`, `marilia`, `renato`, `julia`, `pedro`, `nanda`,
  `zecicero`, `lucas`, `rebeca`, `thiago`, `gabi`, `damiao`, `clara`; contratantes `fernanda` (Armazém Pajuçara e Bar do
  Cais), `gustavo`, `luana`, `roberto`, `silvia`, `antonio`, `paula` e `marcos` — todas `@demo.ridersync.local`.

### Staging (Neon `ridersync-staging` + Vercel Blob privado)

As imagens precisam ir para o Blob do staging, então o comando usa o token do store (variável de Development/Preview do
projeto `ridersync` na Vercel). Nunca rodar contra produção.

```bash
cd backend
vercel env pull /tmp/vercel-dev.env --environment=development --project ridersync --yes
set -a; . ./.env.neon-staging; set +a
[ "$NEON_BRANCH" = ridersync-staging ] && \
  DATABASE_URL="$DATABASE_URL_UNPOOLED" STORAGE_DRIVER=vercel-blob \
  BLOB_READ_WRITE_TOKEN="$(grep ^BLOB_READ_WRITE_TOKEN= /tmp/vercel-dev.env | cut -d= -f2- | tr -d '"')" \
  npx tsx src/seed/showcase-seed.ts --force --with-demo
rm /tmp/vercel-dev.env
```
