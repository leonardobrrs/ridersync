# RiderSync — Arquitetura

## Visão geral

- **Frontend** (`frontend/`): uma SPA React + TypeScript + Vite, responsiva (celular, tablet e desktop). Estado remoto no
  TanStack Query; formulários com React Hook Form + Zod. Nenhum dado de sessão em `localStorage`.
- **Backend** (`backend/`): **um** monólito modular NestJS (`src/modules/*`), **um** PostgreSQL via Prisma 6.
  Sem microsserviços, filas externas, Redis, CQRS ou event sourcing.
- **Hospedagem**: Vercel (API em `gru1` + SPA estática), Neon (PostgreSQL) e Vercel Blob (arquivos, store privado).
  O frontend encaminha `/api/*` para a API no servidor da Vercel (mesma origem para o cookie de sessão).

## Camadas (convenções NestJS, sem MVC artificial)

| Camada | Onde | Responsabilidade |
|---|---|---|
| Apresentação HTTP | `*.controller.ts` / controllers em `*.module.ts` | Rotas, validação de entrada (Zod via `ZBody`/`ZQuery`), status HTTP. Sem regra de negócio. |
| Aplicação | `*.service.ts` | Casos de uso, autorização (`AccessService`), transações, notificações. |
| Domínio (regras puras) | `*.rules.ts`, `riders/compatibility.ts`, `notification.types.ts`, `video-thumbnail.ts`, `password-policy.ts` | Máquinas de estado e cálculos determinísticos, sem I/O — cobertos por testes unitários. |
| Infraestrutura | `prisma/`, `media/storage.ts`, `media/image-processing.ts`, `mail/mail.transport.ts` | Banco, armazenamento (local/S3/Vercel Blob), processamento de imagem, provedor de e-mail. |

## Módulos

| Módulo | Conteúdo |
|---|---|
| `auth` | Cadastro (tipo de conta, senha forte, aceite LGPD), login com bloqueio por tentativas, sessões (cookie HttpOnly), confirmação de e-mail, recuperação de senha, Google OAuth (PKCE), reautenticação por senha. |
| `account` | Nome, dados civis para contrato (nome completo, CPF, RG), CPF no primeiro acesso de contas Google, troca/definição de senha, tipo de conta (contas legadas), aceite de termos, exportação de dados e exclusão/anonimização (LGPD). A foto exibida é a do perfil/casa (não há foto de conta). |
| `access` | Autorização baseada em vínculo (`ACTIVE` + papel), tipo de conta, destinatários de notificações. |
| `artists` | Perfil individual, gestão comum de identidade artística (solo/banda), portfólio (miniaturas de vídeo). |
| `bands` | Banda, convites, papéis, função do integrante, transferência de propriedade com senha. |
| `organizations` | Casas de show (VENUE) e perfil de contratação individual (INDIVIDUAL), responsáveis, convites, transferência. |
| `events` | Eventos (públicos/privados, com casa ou independentes), candidaturas, vagas, ciclo de vida automático, agenda pública. |
| `bookings` | Negociação (proposta direta/convite ou a partir de candidatura — começa com o cachê do evento ou com a contraproposta enviada na candidatura), contrapropostas, mensagens, confirmação com verificação de conflito de agenda (advisory locks), apresentação realizada. |
| `riders` | Catálogo técnico, rider do artista (o que ele precisa, com a quantidade que já possui), inventário da casa, comparação determinística (a casa cobre só a diferença). |
| `marketplace` | Página inicial, busca de artistas e casas, perfis públicos. |
| `notifications` | Central de notificações, preferências, outbox de e-mail, descadastro assinado. |
| `mail` | Transporte de e-mail (Brevo ou Resend reais / log de desenvolvimento / desativado) e templates. |
| `media` | Upload validado por assinatura, reprocessamento de imagens (sharp), política de acesso a arquivos. |
| `maintenance` | Rotina diária (Cron da Vercel): transições por data, reenvio de e-mails, política de retenção. |
| `dashboard` | Painel, agenda privada e `GET /me/pulse` (assinatura do estado do usuário para atualização em tempo real por consulta periódica, sem WebSocket/Redis). |
| `contracts` | Contrato em PDF gerado na confirmação (templates por tipo de contratante), prontidão dos dados e atualização. Regras puras em `contract-data.rules.ts`. |
| `reviews` | Avaliação pós-show (0–5 estrelas, uma por lado) de contratações confirmadas já realizadas. Regras em `review.rules.ts`. |
| `admin` | Painel de administração em `/adm` com sessão própria (credenciais `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` do ambiente): visão geral e remoção moderada de usuários, perfis, casas, eventos e negociações. |

## Máquinas de estado

### Evento (`events/event.rules.ts`)

```
DRAFT ──publicar──▶ OPEN ──(última contratação confirmada, automático)──▶ FILLED
  │                  │ ▲                                          │
  │                  │ └──(vaga liberada, automático)─────────────┘
  │                  ├──encerrar / prazo vencido (automático)──▶ CLOSED ──reabrir──▶ OPEN
  │                  ├──adiar──▶ POSTPONED ──remarcar──▶ OPEN | FILLED | CLOSED
  │                  └──cancelar──▶ CANCELLED (final)
  └──cancelar──▶ CANCELLED
OPEN/FILLED/CLOSED ──data passada (automático)──▶ COMPLETED (com contratação confirmada) | CLOSED (sem)
```

- Transições manuais são validadas por `assertEventTransition`; as automáticas por `statusAfterSlotChange` (vagas) e
  `sweepTarget` (data/prazo). A varredura roda no Cron diário e, no máximo uma vez por minuto por instância, antes de
  consultas de eventos — os estados nunca dependem do frontend.
- **Vaga ocupada** = contratação `CONFIRMED` vinculada ao evento (de candidatura ou convite). Selecionar candidatura e
  negociar não ocupam vaga. A confirmação ocorre com `SELECT … FOR UPDATE` no evento: confirmações concorrentes
  nunca excedem as vagas (teste de integração com duas requisições simultâneas); cancelar uma confirmada reabre o evento.
- Cancelar o evento: candidaturas pendentes → `REJECTED`, aceitas → `CANCELLED`, negociações ativas → `CANCELLED`
  (com registro de auditoria) e aviso aos artistas.

### Candidatura

`PENDING → ACCEPTED | REJECTED | WITHDRAWN`; `ACCEPTED → REJECTED | WITHDRAWN | CANCELLED`; `WITHDRAWN → PENDING`
(reenvio); `REJECTED` e `CANCELLED` são finais. `CANCELLED` = **vaga cancelada** (negociação encerrada sem acordo
ou contratação cancelada) e libera a vaga automaticamente.

### Negociação (`bookings/booking.rules.ts`)

`NEGOTIATING → AGREED (proposta aceita) → CONFIRMED (confirmação explícita do contratante)`; `NEGOTIATING → DECLINED`;
`NEGOTIATING | AGREED | CONFIRMED → CANCELLED`. Contraproposta cria nova oferta e marca a anterior como `SUPERSEDED`.
Todas as ações bloqueiam o evento (se houver) e depois a negociação — mesma ordem do cancelamento de evento, evitando deadlock.

## Visibilidade de eventos

| Quem | Eventos públicos | Eventos privados |
|---|---|---|
| Visitante | listagem, detalhe, página inicial, agenda pública | nunca (404) |
| Conta de contratante | listagem e detalhe | só os próprios (gestão) |
| Conta de artista | listagem e detalhe | listagem e detalhe, candidatura |
| Perfil público do artista ("Próximos eventos") | com local e horário | apenas “Evento privado” e data |

Show confirmado é público se o evento é `PUBLIC` (não cancelado) ou se é proposta direta de uma **casa de show**;
propostas de contratante individual (festa particular) nunca são divulgadas.

## Notificações e e-mails

`NotificationsService.notify(tx, destinatários, …)` grava, **na mesma transação da ação**, a notificação interna e
(conforme preferências) o e-mail no **outbox** (`EmailOutbox`). `dedupeKey` único por destinatário impede duplicidade.
Após o commit, `flush()` reivindica linhas com `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, envia e marca
`SENT`/`SKIPPED`/`FAILED` (até 5 tentativas; o Cron reprocessa falhas). Links com token (confirmação de e-mail, redefinição
de senha) são enviados diretamente e **não** ficam no outbox. Categoria `ACCOUNT` (segurança) é sempre enviada por e-mail.

## Segurança (resumo)

Ver também `docs/product/LGPD.md`. Sessão server-side (cookie HttpOnly, SameSite=Lax, Secure em produção, token só como hash);
CSRF por cabeçalho `X-Requested-With` + verificação de `Origin`; CORS por lista explícita; Argon2id (migração
transparente do scrypt legado); bloqueio de conta após tentativas; rate limit por rota sensível; autorização por vínculo
em todo endpoint protegido; IDs UUID; `select` explícito nas consultas públicas; erros sem detalhes internos;
uploads validados por assinatura e reencodados (sem EXIF/GPS); `helmet` e CSP restritiva no download de arquivos.
