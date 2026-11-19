# RiderSync — Modelo de dados

Fonte de verdade: `backend/prisma/schema.prisma`. CHECKs que o Prisma não expressa ficam nas migrations SQL.

## Migrations

| Migration | Conteúdo |
|---|---|
| `20261117113114_init` | Modelo do MVP, CHECKs de domínio e catálogo técnico. |
| `20261118120000_evolucao_contas_eventos_notificacoes` | Tipo de conta, verificação de e-mail, Google, avatar, consentimento, bloqueio de login, anonimização; tokens; notificações, preferências e outbox; eventos públicos/privados, local livre, estados `FILLED`/`POSTPONED`; candidatura `CANCELLED`; organização `INDIVIDUAL`; catálogo `artistRequirement`; miniatura de portfólio; variantes de mídia. Recuperação em `ROLLBACK.md` na pasta da migration. |
| `20261118200000_imagem_do_evento` | `Event.imageId` (opcional, único, FK para `MediaAsset` com `SET NULL`): imagem exibida no card do evento. Aditiva. |
| `20261118210000_leitura_de_mensagens` | Tabela `BookingRead` (negociação × pessoa → última leitura) para o contador de mensagens não lidas. Aditiva. |

## Entidades

### Conta e acesso
- **User** — conta da pessoa. `accountType` (`ARTIST` | `CONTRACTOR`; nulo só em contas legadas, que escolhem no próximo acesso),
  `passwordHash` (Argon2id; nulo em contas só-Google), `emailVerifiedAt`, `googleSub` (único), `avatarId` (único),
  `termsAcceptedAt`/`termsVersion` (consentimento LGPD), `failedLoginCount`/`lockedUntil`, `anonymizedAt` (conta excluída).
  CHECK `User_has_credential`: conta ativa tem senha ou Google.
- **Session** — sessão server-side; só o hash SHA-256 do token.
- **UserToken** — tokens de uso único (`EMAIL_VERIFICATION`, `PASSWORD_RESET`); só o hash; emitir novo invalida os anteriores.

### Identidades artísticas
- **Artist** — identidade comum (SOLO ou BAND) com FK explícita para `MusicianProfile` **ou** `Band` (CHECK `Artist_exactly_one_subtype`).
- **MusicianProfile**, **Band**, **BandMember** (`role` OWNER/ADMIN/MEMBER = permissão; `instrument` = função/cargo, lista fechada).
- **PortfolioItem** — link externo **ou** arquivo (CHECK); `thumbnailUrl` calculada no servidor (YouTube/Vimeo).
- **TechnicalRider**, **RiderItem** — rider de uma identidade; itens de catálogo com `artistRequirement=false` são recusados.

### Contratantes
- **Organization** — `VENUE` (casa de show, pública, com inventário) ou `INDIVIDUAL` (perfil de contratação de pessoa física,
  sem página pública e sem inventário — FK composta + CHECK `VenueEquipmentItem_venue_only`).
- **OrganizationMember** (OWNER/ADMIN), **VenueEquipmentItem**.

### Eventos e contratação
- **Event** — `organizerId` (responsável) ≠ `venueId` (local físico, opcional). Sem `venueId`, o local fica em
  `locationName/Address/City/State` (CHECK `Event_has_location`). `visibility` (`PUBLIC`/`PRIVATE`), `status`
  (`DRAFT`,`OPEN`,`FILLED`,`CLOSED`,`POSTPONED`,`COMPLETED`,`CANCELLED`), carimbos `publishedAt`, `filledAt`,
  `closedAt`, `postponedAt`, `completedAt`, `cancelledAt`. CHECKs de vagas, prazo ≤ data e cachê.
- **EventApplication** — única por (evento, identidade).
- **Booking**, **BookingOffer** (histórico imutável de termos), **BookingMessage**, **BookingStatusChange** (auditoria), **Performance**.

### Notificações
- **Notification** — `category`, `type`, `title`, `body`, `link` (somente caminho interno — CHECK), `dedupeKey`
  (único por usuário), `readAt`.
- **NotificationPreference** — e-mail geral e por categoria (Convites, Candidaturas, Negociações, Eventos).
- **EmailOutbox** — e-mails a despachar (`PENDING → SENDING → SENT | SKIPPED | FAILED`).

### Arquivos
- **MediaAsset** — metadados; conteúdo no storage. Imagens reprocessadas: `storageKey` (até 1600 px, WebP) e
  `thumbKey` (até 480 px), `width`/`height`.

## Índices relevantes (novos)

`Event(visibility,status,startsAt)`, `Event(venueId)`, `Booking(eventId)`, `Organization(type,name)`,
`Notification(userId,readAt)`, `Notification(userId,createdAt)`, `Notification(createdAt)`, `EmailOutbox(status,createdAt)`,
`UserToken(userId,purpose)`, `UserToken(expiresAt)`, únicos em `User.googleSub`, `User.avatarId`, `MediaAsset.thumbKey`,
`Notification(userId,dedupeKey)`.

## Exclusão de dados (sem soft delete indiscriminado)

Não há `deletedAt` genérico. Estados de negócio substituem a exclusão (`CANCELLED`, `WITHDRAWN`, `LEFT`, `REMOVED`).
A exclusão de conta (LGPD) apaga o que não tem histórico com terceiros e **anonimiza** o restante (`User.anonymizedAt`,
artista “Artista removido”, contratante individual “Contratante removido”) — ver `docs/LGPD.md`.
