#!/bin/sh
# Inicialização do container da API: migrations (não destrutivas) → seed demo opcional → API.
set -e
npx prisma migrate deploy
if [ "$SEED_DEMO" = "true" ]; then
  node dist/seed/demo-seed.js
fi
exec node dist/main.js
