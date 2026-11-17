# RiderSync

Plataforma de profissionalização artística para músicos, bandas e casas de show de Alagoas: perfis profissionais,
portfólio, riders técnicos, inventário das casas com comparação de compatibilidade, oportunidades de apresentação,
candidaturas e negociações (propostas, contrapropostas, mensagens e confirmação de contratação).

> MVP v1.1. **Editais/oportunidades culturais estão adiados.** A plataforma **não processa pagamentos**.

## Stack

- **Frontend**: React 19 + TypeScript + Vite (SPA responsiva) · React Router · TanStack Query · React Hook Form + Zod
- **Backend**: NestJS 11 — **um único monólito modular** · REST + Swagger · Zod
- **Dados**: PostgreSQL 16 + Prisma 6 (migrations versionadas)
- **Testes**: Jest + Supertest (API), Vitest (UI), Playwright (E2E)
- **Ambiente**: Docker Compose

```
.
├── backend/                 API NestJS
│   ├── prisma/              schema.prisma + migrations (inclui CHECKs e catálogo técnico)
│   ├── src/common/          validação Zod, erros, regras de membership
│   ├── src/modules/         auth, account, access, media, artists, bands, organizations,
│   │                        marketplace, riders, events, bookings, dashboard
│   ├── src/seed/            seed de demonstração (somente desenvolvimento)
│   └── test/                testes de integração (Supertest + PostgreSQL)
├── frontend/                SPA React
│   ├── src/features/        telas por domínio
│   ├── src/components/      layout, campos, estados, diálogos
│   └── e2e/                 testes Playwright
├── docs/                    decisões, progresso, demonstração, referências
└── docker-compose.yml       db + api + web
```

## Pré-requisitos

| Ferramenta | Versão | Para quê |
|---|---|---|
| Node.js | 22 LTS (≥ 22.12) | rodar backend e frontend |
| npm | 10+ (vem com o Node) | instalar dependências |
| Docker + Compose v2 (ou Podman) | recente | subir o PostgreSQL (e, opcionalmente, a aplicação inteira) |

Confira com `node -v`, `npm -v` e `docker compose version`.

> Não tem PostgreSQL instalado? Não precisa: o banco roda num container pelo `docker compose`.
> Usa Podman em vez de Docker? Veja [Usando Podman](#usando-podman-em-vez-de-docker).

## Como rodar em desenvolvimento (backend + frontend)

Todos os comandos abaixo são executados **na raiz do repositório**, salvo indicação. São necessários **dois
terminais** ao final: um para a API (backend) e outro para a interface (frontend).

### 1. Clonar e instalar as dependências (uma vez)

```bash
git clone git@github.com:leonardobrrs/ridersync.git
cd ridersync
npm ci
```

O `npm ci` instala backend e frontend de uma vez (npm workspaces, lockfile único na raiz) e gera o Prisma Client
automaticamente (`postinstall` do backend).

### 2. Criar os arquivos de ambiente do backend (uma vez)

```bash
cp backend/.env.example backend/.env
```

Os valores padrão já funcionam com o banco do `docker compose` (usuário `ridersync`, senha `ridersync_dev_only`,
porta `5432`). O arquivo `backend/.env` não é versionado.

Só se for rodar os **testes de integração**, crie também o `backend/.env.test` (aponta para o banco `ridersync_test`):

```bash
sed 's#/ridersync?#/ridersync_test?#; s#NODE_ENV=development#NODE_ENV=test#; s#./storage#./test-storage#' \
  backend/.env.example > backend/.env.test
echo "THROTTLE_AUTH_LIMIT=10000" >> backend/.env.test
```

### 3. Subir o banco de dados

```bash
npm run db:up        # = docker compose up -d db
```

Sobe o PostgreSQL 16 em `localhost:5432`. Na primeira vez, cria também os bancos `ridersync_test` (integração) e
`ridersync_e2e` (Playwright). Os dados ficam no volume `ridersync_db-data` e sobrevivem a reinícios.
Verifique com `docker compose ps` (o serviço `db` deve aparecer como `healthy`).

### 4. Aplicar as migrations (e, opcionalmente, os dados de demonstração)

```bash
npm run db:migrate   # prisma migrate deploy — cria/atualiza as tabelas, não apaga dados
npm run db:seed      # opcional: contas e dados FICTÍCIOS (veja "Contas de demonstração")
```

Repita `npm run db:migrate` sempre que baixar código com migrations novas. O seed é idempotente (rodar de novo não duplica).

### 5. Rodar o backend (terminal 1)

```bash
npm run dev:api
```

- API em **http://localhost:3000/api** (recarrega automaticamente ao salvar arquivos de `backend/src`).
- Documentação Swagger em **http://localhost:3000/api/docs**.
- Teste rápido: `curl http://localhost:3000/api/health` → `{"status":"ok"}`.

### 6. Rodar o frontend (terminal 2)

```bash
npm run dev:web
```

- Interface em **http://localhost:5173** — abra no navegador.
- O Vite encaminha `/api` para `http://localhost:3000` (mesma origem), então o login por cookie funciona sem
  configurar CORS. **O backend precisa estar rodando** (passo 5).
- Para apontar o proxy para outra API: `VITE_API_PROXY=http://localhost:3200 npm run dev:web`.

Pronto: crie uma conta em http://localhost:5173/cadastro ou entre com uma conta de demonstração.

### Dia a dia (depois da primeira vez)

```bash
npm run db:up        # se o container do banco estiver parado
npm run dev:api      # terminal 1
npm run dev:web      # terminal 2
```

Para parar: `Ctrl+C` nos terminais e `docker compose stop db` (os dados são mantidos).

### Rodando cada parte de dentro da própria pasta (alternativa)

```bash
# backend
cd backend
npx prisma migrate deploy     # migrations
npm run start:dev             # API em modo watch (:3000)
npm run build && npm start    # ou: build de produção + execução

# frontend
cd frontend
npm run dev                   # Vite (:5173)
npm run build && npm run preview   # build de produção servido em :4173 (também com proxy de /api)
```

### Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| `Configuração de ambiente inválida: DATABASE_URL` ao iniciar a API | falta o `backend/.env` (passo 2) |
| `Can't reach database server at localhost:5432` | banco parado: `npm run db:up`; veja `docker compose ps` |
| `port 5432 is already allocated` | já existe um PostgreSQL local; use `POSTGRES_PORT=5433 npm run db:up` e ajuste a porta em `DATABASE_URL` no `backend/.env` |
| Tela carrega, mas login/listas falham (erro de conexão) | a API não está rodando no :3000 (passo 5) |
| `Property 'PrismaClientKnownRequestError' does not exist` / client desatualizado | `npm run prisma:generate -w backend` |
| Erro `CSRF` ao chamar a API com curl/Postman | requisições de escrita exigem o cabeçalho `X-Requested-With: RiderSync` |
| `Port 5173 is in use` | outro Vite aberto; feche-o (a porta é fixa por causa do proxy/CORS) |

## Aplicação completa via Docker Compose (sem Node local)

Sobe banco, API e frontend (nginx) em containers — útil para demonstração:

```bash
docker compose up --build
# com dados de demonstração:
API_NODE_ENV=development SEED_DEMO=true docker compose up --build
```

- Interface: **http://localhost:8080** (o nginx encaminha `/api` para a API).
- API direta: http://localhost:3000/api.
- O container da API executa `prisma migrate deploy` (não destrutivo) antes de iniciar.
- Portas configuráveis por `POSTGRES_PORT`, `API_PORT`, `WEB_PORT` (veja `.env.example` na raiz). Se já estiver
  rodando `npm run dev:api` na porta 3000, use por exemplo `API_PORT=3200 docker compose up --build`.
- Parar: `docker compose down` (mantém os dados; **não** use `-v`, que apaga o volume do banco).

## Usando Podman em vez de Docker

```bash
systemctl --user start podman.socket
export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock
docker compose up -d db      # o docker compose passa a usar o Podman
```

Em sistemas com SELinux (Fedora etc.) o bind mount do script de init já usa o rótulo `:z`.

## Contas de demonstração (somente desenvolvimento)

Criadas por `npm run db:seed`. Dados **fictícios**; senha de desenvolvimento para todas: `demo-ridersync-2026`.

| E-mail | Papel na demo |
|---|---|
| `ana@demo.ridersync.local` | Musicista (perfil público), OWNER da banda Maré Alta, recebeu proposta direta |
| `davi@demo.ridersync.local` | ADMIN da banda Maré Alta |
| `lia@demo.ridersync.local` | MEMBER da banda Maré Alta (só visualiza) |
| `joao@demo.ridersync.local` | Musicista; tem convite pendente para a Maré Alta |
| `bia@demo.ridersync.local` | Musicista em Penedo |
| `rafael@demo.ridersync.local` | OWNER da casa Galpão Jaraguá (inventário, evento aberto, candidatura e proposta) |
| `marina@demo.ridersync.local` | OWNER da casa Casa Sururu |

Roteiro de demonstração: [`docs/DEMO.md`](docs/DEMO.md).

## Comandos

| Comando (raiz) | O que faz |
|---|---|
| `npm run lint` | ESLint backend + frontend |
| `npm run typecheck` | `tsc --noEmit` backend + frontend |
| `npm test` | Jest (unitários + integração no banco `ridersync_test`) e Vitest |
| `npm run test:e2e` | Playwright: sobe API (:3100) e SPA (:5174) isoladas no banco `ridersync_e2e` |
| `npm run build` | build de produção da API e da SPA |

Primeira execução do E2E: `npx -w frontend playwright install chromium`. O E2E sobe sua própria API (:3100) e SPA (:5174) — não precisa (nem deve) reaproveitar os servidores de desenvolvimento, mas o banco (`npm run db:up`) precisa estar rodando.

Os testes de integração recusam-se a rodar se `DATABASE_URL` não apontar para `ridersync_test` e só limpam dados desse banco.

## Segurança (resumo)

Sessão server-side em cookie `HttpOnly`/`SameSite=Lax` (`Secure` em produção), senha com scrypt, proteção CSRF por
cabeçalho + verificação de origem, CORS por allowlist, autorização por vínculo no backend em todas as operações,
validação Zod de toda entrada, uploads validados por assinatura binária. Detalhes em
[`docs/DECISOES_TECNICAS.md`](docs/DECISOES_TECNICAS.md).

## Variáveis de ambiente (backend)

Veja `backend/.env.example`. Principais: `DATABASE_URL`, `CORS_ORIGINS`, `COOKIE_SECURE` (use `true` sob HTTPS),
`SESSION_TTL_HOURS`, `STORAGE_DRIVER` (`local`|`s3`) e `S3_*`, `SEED_DEMO`. A API valida as variáveis ao iniciar.

## Documentação

- [`docs/DECISOES_TECNICAS.md`](docs/DECISOES_TECNICAS.md) — modelo de dados, permissões, estados, segurança, armazenamento
- [`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md) — progresso por fatia e resultados de testes
- [`docs/DEMO.md`](docs/DEMO.md) — roteiro de demonstração
- [`docs/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt`](docs/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt) e `docs/references/` — referências de produto
- Swagger: `http://localhost:3000/api/docs`
