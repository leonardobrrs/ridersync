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
