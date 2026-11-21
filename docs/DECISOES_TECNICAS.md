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

## Evolução de 2026-11-18 (requisitos em `requisitos_ridersync.md`)

Decisões do responsável que **substituem** regras anteriores (ordem de autoridade: decisão explícita mais recente):

1. **Tipo de conta** (`User.accountType` = `ARTIST` | `CONTRACTOR`), escolhido no cadastro e definitivo. Substitui a regra
   "sem papel global no User". Artista cria perfil individual e bandas e só entra em bandas; contratante cria casas e
   eventos e só administra casas. Contas legadas sem tipo escolhem no próximo acesso; vínculos existentes são preservados
   (a migration deriva o tipo pela atuação atual).
2. **Eventos sem casa de show**: contratante individual usa uma `Organization` do tipo `INDIVIDUAL` (criada no primeiro
   evento). Isso reaproveita autorização, negociação, confirmação e agenda sem duplicar fluxos; `INDIVIDUAL` não tem
   página pública nem inventário (FK composta + CHECK). Local livre em `Event.location*` (CHECK `Event_has_location`).
3. **Eventos privados**: visíveis só para contas de artista (lista/detalhe/candidatura) e para o organizador; nunca em
   listagens públicas, página inicial ou agenda pública do artista (lá aparecem só como "Evento privado").
4. **Vagas** (revisado em 18/11, ver abaixo): ocupadas só por contratação **confirmada** vinculada ao evento; `FILLED` automático;
   liberação por recusa/cancelamento (`ApplicationStatus.CANCELLED` = "vaga cancelada"); `POSTPONED` com remarcação.
   Locks: evento → negociação, sempre nessa ordem.
5. **Confirmação de e-mail**: implementada com token de uso único; por decisão do responsável **não bloqueia o primeiro
   acesso** (`EMAIL_VERIFICATION_REQUIRED=false`). Com `true`, o login exige e-mail confirmado.
6. **Senha**: Argon2id (`@node-rs/argon2`, parâmetros OWASP); scrypt legado verificado e regravado no login.
7. **Notificações**: tabela própria + outbox transacional (sem fila externa, compatível com serverless); deduplicação por
   `(userId, dedupeKey)`; despacho com `FOR UPDATE SKIP LOCKED`; e-mails de segurança sempre enviados.
8. **E-mail**: Resend via HTTP (sem SDK). Sem credencial, nada é enviado nem simulado (registro `SKIPPED`).
9. **Imagens**: `sharp` reprocessa uploads (orientação, remoção de metadados, WebP até 1600 px + miniatura 480 px).
   A foto "estourada" era o recorte/ampliação em `object-fit: cover` num quadro 16:10; o perfil agora mostra a imagem
   inteira sobre fundo desfocado e abre a versão grande sem ampliar além da resolução real.
10. **Rider**: itens "Palco e energia" (`artistRequirement=false`) só no inventário da casa; itens antigos ficam ocultos
    e saem no próximo salvamento (sem apagar dados na migration). Comparação de rider somente na negociação/análise de
    candidaturas e no painel do próprio artista; removida do perfil público.
11. **Localidade restrita a Alagoas**: UF única `AL` e cidade validada contra os 102 municípios (normalização de acentos),
    pois só há preenchimento automático para Alagoas.
12. **Função na banda**: `BandMember.instrument` passa a usar lista fechada (`BAND_POSITIONS`); papel de permissão
    (OWNER/ADMIN/MEMBER) continua separado; `OWNER` só por transferência (senha + confirmação com 3 s na interface).
13. **LGPD**: exclusão de conta por anonimização onde há histórico com terceiros, sem `deletedAt` genérico.
14. **Documentação**: o link "Documentação" aponta para `/ajuda` (página interna); o botão "API" (Swagger, desativado em
    produção) foi removido do rodapé.

## Lote de UX, responsividade e agenda (2026-11-18)

1. **Conflito de agenda (backend, obrigatório).** Só contratação `CONFIRMED` ocupa agenda; o intervalo é o da oferta
   aceita (`performanceAt` + `durationMinutes`, máx. 720 min). Sobreposição real é `a.início < b.fim && b.início < a.fim`,
   portanto apresentações consecutivas (19h–22h e 22h–23h) são permitidas. Recursos verificados na confirmação:
   - **artista** (`artistId`: perfil individual ou banda);
   - **local**: `Event.venueId` quando a negociação é de um evento; sem evento, a própria organização se for `VENUE`
     (contratante `INDIVIDUAL` não ocupa local físico). Artistas do **mesmo evento** formam line-up e não disputam o local.
   Regras puras em `bookings/agenda.rules.ts`; verificação em `bookings/agenda.service.ts`, dentro da transação de
   `confirm` (lock do evento → lock da negociação → advisory locks `pg_advisory_xact_lock` de artista e local, em ordem
   fixa). Duas confirmações concorrentes do mesmo recurso são serializadas; a segunda enxerga a primeira e recebe
   `409 SCHEDULE_CONFLICT`. Nada é gravado parcialmente (rollback). A mensagem não expõe dados de outra negociação.
   **Sem migration**: um constraint de exclusão (GiST) exigiria duplicar o intervalo na tabela `Booking`; os advisory
   locks dão a mesma garantia sem mudar o schema. Reversível.
2. **Evento esgotado.** Evento cujas vagas estão todas ocupadas por contratações confirmadas rejeita candidatura,
   aceite de candidatura, nova proposta vinculada e nova confirmação com `409 EVENT_FULLY_BOOKED`, mesmo que o estado
   tenha sido alterado manualmente. Continua consultável (detalhe público, histórico e agenda).
3. **Foto única.** Removida a "foto da conta" (`PUT/DELETE /account/avatar`). A foto exibida para a pessoa é a do perfil
   individual ou, para contratantes, a da organização (`/auth/me` → `user.profilePhotoUrl`). A coluna `User.avatarId` e
   os arquivos existentes foram **preservados** (sem migration destrutiva); a exclusão de conta continua apagando-os.
4. **Cadastro.** A tela inicial mostra só "Sou artista" e "Sou contratante"; a escolha abre um modal (`<dialog>` nativo:
   foco preso, Esc fecha, foco volta ao botão de origem, rolagem interna) com o mesmo `RegisterSchema` e a mesma
   validação do backend. É possível trocar o tipo sem perder o que foi digitado. "Continuar com Google" aparece desde o
   primeiro carregamento (login e cadastro); sem escolha prévia, a conta Google nasce sem tipo/aceite e o `AccountGate`
   pede ambos no primeiro acesso. Google desligado no ambiente → botão desabilitado com aviso e
   `/api/auth/google/start` redireciona para `/entrar?erro=google-indisponivel`.
5. **Texto do usuário nunca estoura o layout.** `overflow-wrap:anywhere` no conteúdo principal, `minmax(0,1fr)`/`min-width:0`
   em grids e flex, limite de linhas nos cards (texto completo na página do perfil/evento e no `title`).
6. **Ícones de instrumento/função** centralizados em `frontend/src/lib/instruments.ts` (normaliza acento/caixa só para
   escolher o desenho; o valor gravado e o texto exibido não mudam; desconhecido → ícone genérico).
7. **Barra inferior**: altura em `--tabbar-h`, `safe-area-inset-*`, alvos ≥ 44 px, item ativo sempre marcado ("Painel"
   nas subpáginas sem atalho próprio), número variável de itens, barra de salvar acima dela; em telas de toque some com
   o teclado aberto e volta com atraso (não rouba o toque que fechou o teclado).

## Reunião de 18/11 (`docs/reuniao18_11.md`)

- **Feed por tipo de conta** (aba "Para você" da página inicial):
  - *Artista/banda*: o objetivo é conseguir apresentações → só **oportunidades abertas** (inclusive privadas, que só
    artistas veem) e **casas de show**, em cards. As abas Músicos/Bandas continuam listando todos os perfis.
  - *Contratante/casa*: o objetivo é contratar → **artistas e bandas** e os **shows confirmados** (referência do
    circuito). Oportunidades são vagas para artistas e saem do feed, do menu do topo e da barra inferior; outras casas
    não são alvo do contratante e ficam só na aba "Casas de show". Chamada "Publicar evento" no topo do feed.
  - *Visitante*: vitrine completa (precisa entender a plataforma antes de escolher o tipo de conta).
  - A busca por texto sempre mostra o resultado completo (artistas e casas), para qualquer conta.
- **Imagem do evento**: `Event.imageId` → `MediaAsset` (mesmo pipeline das fotos: reprocessada, sem EXIF, miniatura).
  Visibilidade igual à do evento: público → todos; privado → contas de artista e organizador; rascunho → organizador.
- **Celular**: a fileira de instrumentos saiu da barra de categorias (poluía a tela); o filtro de instrumento ficou no
  painel "Filtros". Chat da negociação em painel sobreposto aberto por uma barra fixa; no desktop continua na lateral.
- **Telefone**: máscara só no frontend (o backend já aceitava o formato); exibição pública formatada com link `tel:`.
- **Menus**: um único hook (`useDismiss`) fecha menus/painéis ao tocar fora (`pointerdown`) e com Esc.

### Revisão de 18/11 (após o Preview)

- **Vaga = contratação confirmada.** Selecionar candidatura ou enviar convite não ocupa vaga: o contratante pode
  negociar com vários artistas em paralelo e a vaga só fecha quando uma negociação termina em sucesso (confirmação).
  Confirmações concorrentes continuam serializadas pelo lock do evento (nunca excedem o total). Cancelar uma contratação
  confirmada reabre o evento. "Selecionar e negociar" faz seleção + proposta numa única transação.
- **Reconciliação**: a rotina automática corrige eventos futuros cujo estado não bate com as confirmações (dados da
  regra anterior), sem notificações e de forma idempotente.
- **Mensagens não lidas**: tabela `BookingRead` (última leitura por pessoa e negociação). Conta só mensagens da outra
  parte posteriores à leitura; abrir a conversa (pop-up no celular, lateral no desktop) ou responder marca como lida e
  também marca os avisos "Nova mensagem" daquela negociação.
- **Celular/tablet (≤ 900 px)**: a barra de categorias do topo sai; "Explorar" substitui "Início" na barra inferior
  (a logo continua levando ao início). Escolhido em vez de menu lateral: a barra inferior já é a navegação principal
  no celular e fica ao alcance do polegar.
- **Filtros com vários valores** (18/11): estilo, cidade, instrumento, formação e tipo de espaço viraram marcadores.
  Na URL ficam como `genre=MPB,Forró` (a API também aceita o parâmetro repetido). Dentro do mesmo filtro os valores
  se combinam por OU; entre filtros diferentes, por E. Cidades: sugestões em destaque + busca entre os 102 municípios.

## Reunião com o professor (19/11) — `docs/reuniao_com_o_professor_19_11.md`

- **Rider = o que o artista possui.** As necessidades (o que a casa deve disponibilizar) são informadas em cada
  candidatura (`EventApplication.needs`), manualmente ou com "Preencher a partir do meu perfil" (copia os itens do rider
  como ponto de partida). A comparação técnica na análise da candidatura e na negociação usa essas necessidades
  (`GET /applications/:id/compatibility`); sem casa de show (evento particular) não há inventário para comparar.
- **Evento oculto** (`HIDDEN`): fora de todas as listagens, da página inicial e da agenda pública (aparece só como
  "Evento privado" no perfil do artista); detalhe e imagem só para o organizador e artistas com convite/candidatura;
  não aceita candidaturas (`INVITE_ONLY`). Convites na criação: o evento é publicado e cada artista recebe uma proposta
  com data, duração e cachê do evento (por isso o cachê é exigido para convidar).
- **Criação única de evento**: mesma tela pela casa ou por "Meus eventos", escolhendo uma das casas ou "outro local".
  "Requisitos" virou "Observações" (`Event.notes`, coluna histórica mantida).
- **Eventos encerrados**: aba "Encerrados" em Oportunidades (`state=closed`: vagas preenchidas, encerrados e realizados)
  e página do evento fechado com aviso de situação e atrações confirmadas (perfis públicos). Eventos clicáveis na home,
  nas casas, nos perfis, na agenda e na negociação.
- **Contratar nas condições do evento** (`POST /applications/:id/hire`): o artista aceitou as condições publicadas ao
  se candidatar; o contratante confirma na hora (NEGOTIATING → AGREED → CONFIRMED auditado), com as mesmas travas de
  vagas e agenda. Exige cachê definido; "Selecionar e negociar" continua para outros termos.
- **Avaliações** (`Review`, 0–5 estrelas + comentário): uma por lado, só após a apresentação (data acordada passada ou
  registrada). Registrar a apresentação notifica os dois lados e abre o formulário para quem registrou. Médias e
  comentários recentes no perfil do artista e na página da casa.
- **Home**: sem botão "Casas de show" no topo (o filtro da página faz isso); a busca filtra enquanto se digita.
- **Quebra de palavras**: `overflow-wrap:anywhere` (quebrava palavras no meio em colunas estreitas) trocado por
  `break-word`; selos, botões e datas não quebram.


## Módulo de contratos (2026-11-20) — branch `feat/contracts-module`

Instrução de origem: `AGENT_CONTRACT_MODULE.md` (templates `venue-artist.md` e `individual-artist.md`). A spec foi escrita para um
schema genérico; as diferenças abaixo vêm do modelo real do repositório e são **decisões a validar** com o responsável.

- **Quando gera**: ao CONFIRMAR a contratação (`POST /bookings/:id/confirm` e `POST /applications/:id/hire`), **depois do commit**
  da transação, para que falha de PDF/template nunca desfaça a confirmação (erro registrado em log). Se falhar, qualquer das partes
  gera pelo botão "Gerar contrato" (`POST /contracts/booking/:id`, idempotente). Um contrato por negociação (`Contract.bookingId`
  único; corrida entre duas confirmações resolvida pela violação de unicidade).
- **Template**: `Organization.type` define o modelo (VENUE → `venue-artist.md`; INDIVIDUAL → `individual-artist.md`); não há
  `Booking.contractorType` (seria dado derivado e redundante). Só substituição de strings (`fillTemplate`); ausente = `[A PREENCHER]`.
  Testemunhas saem como linhas em branco para assinatura à mão.
- **Termos acordados ficam na oferta, não no booking**: `BookingOffer` ganhou campos opcionais (`presentationDesc`, `advanceMinutes`,
  `signalCents`, `signalDueDate`, `balanceDueDate`, `paymentMethod`, `rescissionDays`, `substitutionDays`). Assim sinal/prazos são
  negociados e preservados no histórico como cachê e data (contraproposta cria nova linha). O contrato usa a oferta **ACEITA**.
  Saldo = cachê − sinal (derivado, não armazenado). Valores em centavos (`feeCents` da spec "Decimal" não existe aqui).
  Padrões: rescisão 2 dias, substituição 5 dias, informação de alteração 3 dias.
- **Dados civis ficam em `User` (`legalName`, `cpf`, `rg`)**, não em `MusicianProfile`: o representante de uma banda sem CNPJ é o
  OWNER, que pode não ter perfil solo; o contratante pessoa física também precisa. `Band` ganhou `legalName`/`cnpj`; `Organization`,
  `legalName`/`cnpj` (casa). Endereço/telefone do contratante individual usam as colunas já existentes da organização INDIVIDUAL.
  CPF/CNPJ são validados (dígitos verificadores), guardados só com dígitos e protegidos por CHECK. Nunca entram em seleções públicas
  (`orgLegalSelect` é separado de `orgManageSelect`, que alimenta a página pública da casa).
- **Contratante INDIVIDUAL**: nome/CPF/RG vêm do OWNER ativo da organização INDIVIDUAL; sem dados, "[A PREENCHER]" (o nome da conta
  não é assumido como nome civil). **Banda sem CNPJ**: OWNER ativo é parte e representante. **Banda com CNPJ**: razão social + CNPJ.
- **Sem arquivo estático nem `/public/contracts/`**: o contrato tem CPF/RG e a Vercel não tem disco gravável. O texto preenchido é
  congelado em `Contract.content` e o PDF é renderizado a cada download por `GET /contracts/:id/download` (autenticado, só as duas
  partes — OWNER/ADMIN da casa/organização ou administradores do artista; demais recebem 404, como em `/bookings/:id`;
  `Cache-Control: private, no-store`). Por isso não existe `fileUrl`.
- **Bibliotecas**: `pdf-lib` (fontes padrão Times; `@pdf-lib/fontkit` dispensado — não há fonte customizada) e `numero-por-extenso`
  (encapsulada: corrige "um mil"→"mil", "milhões reais"→"milhões de reais" e zero vazio; testes em `to-extenso.spec.ts`).
- **Pendência (LGPD)**: o texto do contrato retém nome/CPF/RG das duas partes mesmo se uma conta for excluída depois (a anonimização
  limpa `User`, mas o contrato é registro da outra parte). Decidir política de retenção com o responsável.
- **Fora do escopo (mantido)**: assinatura eletrônica, validade jurídica garantida, pagamentos, uso de IA no preenchimento.
- **Revisão (21/11)**: o contrato não fica mais congelado enquanto faltam dados. `POST /contracts/booking/:id/refresh` refaz o
  texto com os dados cadastrais atuais, pelas duas partes, enquanto a contratação estiver CONFIRMED — inclusive depois
  do show (revisão de 21/11, após teste no staging: um contrato gerado tarde não podia ser corrigido; a assinatura é fora da
  plataforma). Cada geração/atualização notifica as duas partes (sino + e-mail, categoria Negociações; tipos
  `CONTRACT_READY`/`CONTRACT_UPDATED`, um aviso por versão). O cartão tem "Meus dados para contrato", que leva à tela de
  dados do lado de quem vê (casa, banda ou Conta). Os termos continuam os da oferta
  aceita. `GET /contracts/booking/:id/readiness` lista os dados cadastrais faltantes de cada lado (regra pura
  `missingPartyData`) com o link de onde completar; a tela avisa antes de confirmar e no cartão do contrato. O resumo do
  contrato expõe só `pendingFields` (quantidade de "[A PREENCHER]"), nunca o texto.
- **PDF com fonte embutida** (Tinos, SIL OFL 1.1, métricas da Times New Roman; `fonts/` copiada para `dist` pelo nest-cli):
  com a Times padrão não embutida, cada leitor usava uma fonte substituta e palavras em maiúsculas invadiam o espaço
  seguinte. Embutida inteira (o subset do pdf-lib + fontkit perde glifos desta fonte); o PDF fica com ~600 KB.
  Blocos de assinatura nunca são partidos entre páginas. Modelo da casa passou a imprimir o prazo do saldo; a cláusula de
  substituição usa "da equipe que acompanha <artista>" para artista solo.
