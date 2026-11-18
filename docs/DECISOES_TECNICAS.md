# RiderSync — Decisões técnicas (MVP)

> Registro das decisões tomadas durante a implementação do MVP (2026-11-17).
> Decisões marcadas como **reversíveis** foram tomadas para não bloquear a entrega e podem ser revistas.
> Escopo: **editais/oportunidades culturais estão ADIADOS** — não há modelos, rotas, telas, seeds ou testes deles.

## 1. Stack e versões

| Camada | Escolha | Observação |
|---|---|---|
| Frontend | React 19 + TypeScript 5.9 + Vite 7 | SPA única e responsiva (desktop + celular) |
| Rotas / dados / formulários | React Router 7, TanStack Query 5, React Hook Form 7 + Zod 4 | |
| Backend | NestJS 11 (Node 22 LTS) | **um** monólito modular |
| Banco / ORM | PostgreSQL 16 + Prisma 6.19 | migrations versionadas em `backend/prisma/migrations` |
| Validação | Zod 4 via `ZodValidationPipe` próprio (`backend/src/common/zod.ts`) | o mesmo schema gera o corpo no Swagger (`z.toJSONSchema`) |
| API | REST + Swagger em `/api/docs` (desabilitado em produção, exceto com `SWAGGER=true`) | |
| Testes | Jest + Supertest (backend), Vitest + Testing Library (frontend), Playwright (E2E) | |
| Ambiente local | Docker Compose (`db`, `api`, `web`) | validado com Podman rootless (socket compatível com Docker) |

Versões fixadas em majors estáveis e conhecidas (NestJS 11 em vez de 12, Prisma 6 em vez de 7/8, TS 5.9 em vez de 7)
para reduzir risco de incompatibilidade com decorators/metadata e com o fluxo clássico de migrations do Prisma.

## 2. Arquitetura do backend

Módulos em `backend/src/modules`: `auth`, `account`, `access`, `media`, `artists`, `bands`, `organizations`
(+ convites), `marketplace`, `riders`, `events`, `bookings`, `dashboard`. Todos no mesmo processo e no mesmo banco.

- Controllers finos; regras de negócio em services; **regras puras testáveis** em arquivos `*.rules.ts`
  (`membership.rules.ts`, `event.rules.ts`, `booking.rules.ts`) e `riders/compatibility.ts`.
- `AccessService` centraliza autorização por vínculo (nunca por papel enviado pelo cliente).
- Erros normalizados `{ statusCode, code, message, details? }` (`AllExceptionsFilter`), sem stack trace ao cliente.
- Operações que alteram várias linhas usam `$transaction`; invariantes sensíveis a concorrência usam
  `SELECT … FOR UPDATE` na entidade-mãe (banda, organização, booking) e atualizações condicionais por estado
  (`updateMany where status = <lido>`) para transições de evento/candidatura.

## 3. Modelo de dados — decisões

### 3.1 Entidade `Artist` (ADOTADA)
`Artist` é a identidade artística profissional comum a **músico individual** e **banda**. Justificativa: marketplace,
portfólio, rider, candidaturas, bookings e apresentações referenciam "um artista" — sem `Artist`, cada uma dessas
tabelas precisaria de duas FKs anuláveis + CHECK, e cada consulta/autorização seria duplicada.

- `Artist.musicianProfileId` (UNIQUE, FK) **ou** `Artist.bandId` (UNIQUE, FK), com CHECK
  `Artist_exactly_one_subtype` garantindo exatamente um subtipo coerente com `kind` (SOLO/BAND). **Sem `type + id` polimórfico.**
- Os dados de perfil profissional (nome artístico, bio, cidade, estilos, formações, contatos públicos, foto, visibilidade)
  ficam em `Artist`. Cada banda tem sua própria linha `Artist` — **não herda nem copia** dados dos integrantes.
- `MusicianProfile` guarda o vínculo 1:1 com `User` e dados individuais (instrumentos). `Band` guarda os integrantes.
- `TechnicalRider` (1:1 com `Artist`), `PortfolioItem`, `EventApplication`, `Booking`, `Performance` referenciam `artistId`.

### 3.2 Público × privado
- `User.email` e credenciais nunca saem em endpoints públicos. Contatos exibidos são os **contatos públicos** que o
  artista/casa escolhe preencher (`contactEmail`, `contactPhone`, `instagram`, `website`).
- Endpoints públicos usam `select` explícito (`publicArtistCardSelect`, etc.) — nunca serializam o registro Prisma inteiro.
- Página pública de banda lista integrantes **apenas** se o integrante tiver perfil individual público; caso contrário só a contagem.
- Perfis começam **PRIVATE**.

### 3.3 Campos mínimos para publicação (REVERSÍVEL)
Para `visibility = PUBLIC`: nome artístico, cidade, ≥ 1 estilo musical e descrição com ≥ 40 caracteres
(`publicationIssues()`). Um perfil público não pode perder esses campos (422). **Candidatar-se** e **receber proposta
direta** exigem perfil público (a casa precisa conseguir vê-lo).

### 3.4 Memberships, papéis e convites (REVERSÍVEL)
- `BandMember` / `OrganizationMember` com `role` e `status` (`INVITED`, `ACTIVE`, `DECLINED`, `CANCELLED`, `REMOVED`, `LEFT`),
  `UNIQUE (entidade, userId)`. **INVITED não é membership ativa** — toda autorização exige `ACTIVE`.
- **Convite por e-mail de conta já cadastrada.** Não há envio de e-mail (nenhum provedor configurado); o convidado
  vê o convite em *Painel → Convites* e aceita/recusa. Se o e-mail não tem conta, a API informa (404) — isso revela a
  existência da conta apenas a administradores autenticados de uma banda/casa; aceito no MVP.
- Re-convite reaproveita a mesma linha (volta a `INVITED`).
- O criador de banda **não precisa** ter perfil individual (evita barreira de entrada).

| Ação (banda) | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Ver banda, integrantes e rider interno | ✓ | ✓ | ✓ |
| Editar perfil, portfólio, rider; candidatar; negociar | ✓ | ✓ | — |
| Convidar | ADMIN/MEMBER | só MEMBER | — |
| Alterar papéis / transferir propriedade | ✓ | — | — |
| Remover integrante | qualquer | só MEMBER | — |
| Sair | ✓ (se não for o último OWNER) | ✓ | ✓ |

Casa de show (`Organization` tipo `VENUE`): OWNER e ADMIN gerenciam perfil, inventário, eventos, candidaturas e
negociações e convidam ADMIN; só OWNER altera papéis/remove responsáveis.

**Último OWNER**: `assertKeepsAnOwner` dentro de transação com `FOR UPDATE` bloqueia remover, rebaixar ou sair sendo
o único OWNER; `transfer-ownership` promove o alvo e rebaixa o atual **na mesma transação**.

### 3.5 Eventos e candidaturas
- `Event.organizerId` (responsável, obrigatório) ≠ `Event.venueId` (local, opcional; por padrão = organizador).
- Estados: `DRAFT → OPEN ↔ CLOSED → COMPLETED`, e `CANCELLED` a partir de DRAFT/OPEN/CLOSED. Abrir exige prazo e data
  futuros; concluir exige data passada. Rascunhos não são públicos.
- No MVP todo evento é uma oportunidade com vagas e prazo (decisão recomendada pelo documento de arquitetura).
- `EventApplication`: `UNIQUE (eventId, artistId)` no banco. Retirada (`WITHDRAWN`) permite reenvio enquanto as
  inscrições estiverem abertas (a mesma linha volta a `PENDING`; nunca há duas linhas).
- **Aceitar candidatura não cria nem confirma Booking.** Aceite respeita o número de vagas.

### 3.6 Booking, ofertas, mensagens e confirmação
- Dois caminhos (`origin = DIRECT | APPLICATION`) e **um único fluxo**. CHECK garante `APPLICATION ⇔ applicationId`.
  Uma candidatura gera no máximo um booking (`applicationId UNIQUE`).
- Estados: `NEGOTIATING → AGREED → CONFIRMED`; `DECLINED` / `CANCELLED` encerram.
  - Responder a uma oferta: só o lado oposto ao autor. **Aceitar** → `AGREED`. **Recusar** → `DECLINED`.
    **Contraproposta** → a oferta anterior vira `SUPERSEDED` (termos intactos) e uma **nova linha** é criada (`previousOfferId`).
  - **Confirmação explícita** pela casa contratante (`AGREED → CONFIRMED`), com `confirmedAt/confirmedById` e CHECK
    `Booking_confirmed_has_audit`.
  - Toda transição é registrada em `BookingStatusChange` (ator, lado, nota, data).
- Lado do usuário é calculado no backend (`VENUE` se responsável ativo da casa; `ARTIST` se administra o artista).
  Quem não participa recebe 404 (não revela existência). Quem administra **os dois lados** não pode agir (evita autonegociação).
- Integrantes MEMBER de banda **não** acessam negociações da banda (só OWNER/ADMIN). **REVERSÍVEL**.
- **Sem pagamentos**: nenhum status de pagamento existe.

### 3.7 Performance
`Performance` (1:1 com Booking) é criada explicitamente por qualquer participante **após** a data acordada de um booking
`CONFIRMED`. Booking confirmado ≠ apresentação realizada ≠ pagamento. A "agenda" do MVP é apenas: próximas
contratações confirmadas + histórico de apresentações registradas (sem calendário, recorrência ou conflitos).

### 3.8 Rider, inventário e compatibilidade
- Catálogo `EquipmentCatalogItem` com **IDs estáveis** (`mic-din`, `di`, `bateria`…) inserido pela migration (dado de
  referência, não demo). Itens personalizados ("outros") usam `customName` — CHECK exatamente um de catálogo/personalizado.
- `RiderItem.quantity > 0`; `VenueEquipmentItem.quantity >= 0`; `UNIQUE` por item de catálogo em cada rider/inventário.
- Inventário pertence somente a `Organization` do tipo VENUE: FK composta `(organizationId, organizationType)` +
  CHECK `organizationType = 'VENUE'`.
- Comparação sob demanda em `riders/compatibility.ts` (função pura), por item:
  `COMPATIBLE` (disp. ≥ nec.), `PARTIALLY_AVAILABLE` (0 < disp. < nec.), `UNAVAILABLE` (ausente ou 0),
  `NEEDS_CHECK` (item personalizado — nunca auto-match, nem com item personalizado de mesmo nome). Resposta inclui
  nome, unidade, necessário, disponível, falta e motivo. Sem substituições/equivalências. Resultado não é persistido.
- Quem pode comparar: quem participa da identidade artística, ou responsável pela casa quando o artista é público ou já
  se relacionou com a casa (candidatura/negociação).

## 4. Autenticação, sessão, CSRF e CORS

- **Sessão server-side**: token aleatório de 256 bits no cookie `rs_session` (`HttpOnly`, `SameSite=Lax`, `Secure` quando
  `COOKIE_SECURE=true`, `Path=/`). No banco fica só o **SHA-256** do token (`Session.tokenHash`). Expiração fixa de
  `SESSION_TTL_HOURS` (padrão 7 dias); sessões expiradas são removidas ao serem usadas.
  Logout apaga a sessão; troca de senha revoga as demais sessões. **Nenhum token em localStorage.**
- Senhas com **scrypt** nativo do Node (N=16384, r=8, p=1, salt de 16 bytes) e comparação em tempo constante; login com
  e-mail inexistente executa hash fictício para reduzir enumeração por tempo.
- **CSRF**: requisições que alteram estado exigem o cabeçalho `X-Requested-With: RiderSync` (forçando preflight CORS em
  qualquer origem cruzada) e, se o navegador enviar `Origin`, ela deve estar em `CORS_ORIGINS` ou ser a mesma origem.
  Somado ao `SameSite=Lax`.
- **CORS**: allowlist explícita (`CORS_ORIGINS`), `credentials: true`. Em dev o Vite faz proxy de `/api` (mesma origem);
  no Compose o nginx faz proxy (mesma origem).
- Rate limit (`@nestjs/throttler`, memória do processo): 600 req/min geral; `THROTTLE_AUTH_LIMIT` (padrão 20/min) em
  cadastro/login. Helmet para cabeçalhos de segurança.
- Recuperação de senha por e-mail **não implementada** (exige provedor de e-mail e autorização para envio).

## 5. Arquivos e mídia

- Interface `StorageDriver` (`backend/src/modules/media/storage.ts`) com `LocalStorageDriver` (padrão, disco em
  `STORAGE_LOCAL_DIR`, fora de qualquer pasta servida estaticamente, chaves validadas contra path traversal) e
  `S3StorageDriver` (`STORAGE_DRIVER=s3` + `S3_BUCKET`, `S3_REGION`, opcional `S3_ENDPOINT` para MinIO).
  O adapter S3 compila e é configurável, mas **não foi exercitado contra um bucket real** (sem credenciais).
- PostgreSQL guarda apenas metadados (`MediaAsset`).
- Validação por **assinatura binária** (não confia no mimetype): JPG/PNG/WEBP até 5 MB; PDF até 10 MB (portfólio).
  SVG/HTML são recusados.
- Upload direto no recurso (`PUT /artists/:id/photo`, `POST /artists/:id/portfolio/upload`, `PUT /organizations/:id/photo`),
  sem uploads órfãos. Substituir/remover apaga o objeto.
- Download via `GET /api/media/:id` com política de visibilidade (perfil público, participante ou quem enviou),
  `X-Content-Type-Options: nosniff`, CSP `sandbox`, PDF como `attachment`.
- Links externos de áudio/vídeo: somente `https://`, host público, sem credenciais embutidas.

## 6. Frontend

- Uma SPA responsiva; identidade visual portada dos protótipos (`docs/references/*.html`): fita de gaffer amarela,
  cabeçalho "case", capas em estilo cartaz, tipografia Big Shoulders Stencil / Figtree / JetBrains Mono.
  No celular: barra inferior de atalhos e filtros em diálogo.
- Estado remoto só no TanStack Query; sessão via `GET /api/auth/session` (200 com `null` para visitante).
- Linguagem por persona: artista vê "Oportunidades de apresentação"; casa vê "Eventos/Publicações".
- Datas exibidas e digitadas no fuso **America/Maceio** (UTC−3, sem horário de verão); a API recebe ISO com offset.
- Valores monetários em centavos (inteiros) na API.

## 7. Seeds

`backend/src/seed/demo-seed.ts` — dados **fictícios** (`@demo.ridersync.local`, nomes com "(demo)"), idempotente,
bloqueado com `NODE_ENV=production`, só roda com `SEED_DEMO=true` ou `--force`. O catálogo técnico não é seed: vem da migration.

## 8. Fora do escopo / pendências conhecidas

- Editais/oportunidades culturais (adiado por decisão do projeto).
- Pagamentos, IA/recomendações, substituição de equipamentos, agenda avançada, produtoras/agências/festivais, analytics.
- Avaliações/reviews (não especificadas) — não existem no schema nem na UI.
- Recuperação de senha e envio de e-mails (precisa de provedor). Exclusão de conta (precisa definir destino de bandas/casas
  em que a pessoa é OWNER e do histórico de negociações).
- Notificações em tempo real (a tela de negociação revalida a cada 20 s).
- Limpeza periódica de sessões expiradas (hoje removidas sob demanda).
- `npm audit` aponta `deepmerge-ts < 8` usado apenas pelo CLI do Prisma 6 (ferramenta de build/migration, não runtime da API).

## 9. Login com Google (OIDC) — adicionado em 2026-11-18

- Fluxo Authorization Code + **PKCE (S256)** + `state` + `nonce`, guardados no cookie temporário `rs_oauth_google`
  (HttpOnly, SameSite=Lax, `Path=/api/auth/google`, 10 min, removido no retorno — o `state` vale uma vez).
- Rotas: `GET /api/auth/providers`, `GET /api/auth/google?next=…`, `GET /api/auth/google/callback`. São acessadas
  pelo **domínio do front** (proxy `/api`), então o cookie de sessão `rs_session` fica no domínio do front e os
  redirecionamentos são relativos (`next` só aceita caminhos internos — sem open redirect).
- O `id_token` vem direto do token endpoint do Google (TLS + client secret); validamos `iss`, `aud`, `exp`, `nonce`
  e `email_verified` (OIDC Core §3.1.3.7). Sem dependência nova.
- **Sem migration**: a conta é encontrada pelo **e-mail verificado** pelo Google. Conta nova recebe senha aleatória
  inutilizável (entra só pelo Google); conta existente com o mesmo e-mail é reutilizada. REVERSÍVEL: guardar o `sub`
  do Google exigirá coluna nova em `User`.
- Configuração: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (as três ou nenhuma; o redirect
  deve terminar em `/api/auth/google/callback`, https fora de localhost). Sem elas o botão não aparece.
- URIs cadastrados no Google: `http://localhost:5173/api/auth/google/callback` (dev) e
  `https://ridersync-front-staging.vercel.app/api/auth/google/callback` (Preview/staging). URLs de Preview com hash
  não funcionam com Google (sem curinga).
