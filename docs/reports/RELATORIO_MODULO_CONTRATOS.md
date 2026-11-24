# Relatório — Módulo de Contratos

Branch: `feat/contracts-module` · Data: 2026-11-20 · Decisões e diferenças em relação à spec: `docs/decisions/DECISOES_TECNICAS.md`.

Legenda: `[x]` feito e verificado nesta máquina · `[~]` feito, com adaptação ao modelo real (ver nota) · `[ ]` não verificado/pendente.

## Schema e Banco de Dados
- [~] Campos em MusicianProfile (cpf, rg, legalName, phone) → **`User.legalName/cpf/rg`**: o representante de banda sem CNPJ (OWNER) pode não ter perfil solo. `phone` não foi criado (já existe `Artist.contactPhone`; o contrato não usa telefone do artista).
- [x] Campos em Band (`cnpj`, `legalName`)
- [~] Campos em Organization: `cnpj` e `legalName` criados; `address/city/state` **já existiam** (`addressLine`, `city`, `state`).
- [~] Campos em Booking → **ficam em `BookingOffer`** (`presentationDesc`, `advanceMinutes`, `signalCents`, `signalDueDate`, `balanceDueDate`, `paymentMethod`, `rescissionDays`, `substitutionDays` — a spec grafava `substituionDays`). `balanceValue` é derivado (cachê − sinal); `contractorType` é derivado de `Organization.type`.
- [~] Enum `ContractorType` → reaproveitado `OrganizationType` (VENUE, INDIVIDUAL), que já tem os mesmos valores.
- [~] Modelo Contract criado (`bookingId` único, `templateType`, `content`, `generatedAt`); **sem `fileUrl`** (PDF renderizado no download a partir do `content`).
- [x] Relação Contract ↔ Booking (1:1, cascade)
- [x] Migration `20261120120000_modulo_contratos` (SQL derivado por `prisma migrate diff` + CHECKs à mão) aplicada com `prisma migrate deploy` num banco Supabase (as 6 migrations); `migrate status` = up to date; tabela, 15 colunas e 8 CHECKs conferidos em `pg_constraint`/`information_schema`.
- [x] Prisma client regenerado

## Bibliotecas
- [x] pdf-lib 1.17.1
- [~] @pdf-lib/fontkit **não instalado** — só serve para fontes customizadas; o PDF usa Times padrão.
- [x] numero-por-extenso 1.0.8 (encapsulada em `to-extenso.ts`: a biblioteca devolve "um mil", "milhões reais" e vazio para zero)

## Backend — Módulo Contracts
- [~] Estrutura em `backend/src/modules/contracts/` (o repositório usa `src/modules/*`, não `src/contracts`)
- [x] Templates em `src/modules/contracts/templates/` (copiados para `dist` via `nest-cli.json`; conferido em `nest build`)
- [x] fill-template.ts
- [x] to-extenso.ts
- [x] generate-pdf.ts
- [x] contracts.service.ts
  - [x] generateForBooking() — idempotente, só para CONFIRMED, exige oferta aceita
  - [x] findByBooking()
  - [~] getDownloadUrl() → `download()` (autoriza e devolve o PDF) e `downloadUrl` no resumo; não-participante recebe **404**, não 403, como em `/bookings/:id`
- [x] contracts.controller.ts
  - [x] GET /contracts/booking/:bookingId
  - [x] GET /contracts/:id/download
  - [x] (extra) POST /contracts/booking/:bookingId — geração sob demanda/recuperação
- [x] contracts.module.ts criado e registrado em app.module.ts
- [x] (extra) `PUT /account/legal-profile`, `PUT /bands/:id/legal`, `legalName/cnpj` em `PATCH /organizations/:id`; LGPD (exportação e anonimização)

## Backend — Integração com Bookings
- [x] ContractsService injetado em BookingsService
- [x] Geração disparada ao confirmar (`confirm` e `hire`), **após o commit**; falha não desfaz a confirmação
- [x] ContractsModule importado em BookingsModule

## Arquivos Estáticos
- [~] **Não aplicável por decisão**: sem `public/contracts/` e sem `useStaticAssets`. O contrato contém CPF/RG (não pode ser público) e a Vercel não tem disco gravável. Download só por rota autenticada.

## Frontend
- [x] Detalhe da negociação traz `contract` (`id`, `templateType`, `generatedAt`, `downloadUrl`)
- [x] Botão "Baixar contrato (PDF)" quando CONFIRMED e há contrato; botão "Gerar contrato" quando falta
- [x] Visível para ambas as partes (teste de componente cobre contratante e artista)
- [x] (extra) Formulário de proposta/contraproposta com "Condições do contrato"; "Dados para contrato" em Conta, casa e banda

## Verificações Finais
- [x] Contrato não é gerado duas vezes — unicidade no banco + retorno do existente; coberto e passando em `contracts.e2e-spec.ts`
- [x] Usuário sem vínculo não baixa (404; sem login, 401; integrante MEMBER da banda, 404) — passando em `contracts.e2e-spec.ts`
- [x] Campos ausentes aparecem como [A PREENCHER] — testes unitários passam
- [x] PDF legível e com formatação adequada — inspecionado em 21/11 (casa com dados completos e evento particular sem dados); fonte embutida, assinaturas sem quebra de página
- [x] Músico solo, banda com CNPJ, banda sem CNPJ, casa, pessoa física — mapeamento nos testes unitários (`contract-data.rules.spec.ts`) e fluxo completo no `backend/test/contracts.e2e-spec.ts` (14 testes passando)

## Validação executada
| Verificação | Resultado |
|---|---|
| Backend: testes unitários | 190 passam |
| Backend: typecheck, lint, `nest build` | ok |
| Frontend: vitest | 38 passam |
| Frontend: typecheck, lint, `vite build` | ok |
| Migration aplicada | ok (Supabase) |
| Integração (Jest + Supertest, banco `ridersync_test` no Supabase) | **12 suítes, 127 testes passam** (contratos 14, bookings, bandas, LGPD, agenda, auth, segurança, marketplace, eventos…) |
| Playwright | 29 passam (inclui `contracts.spec.ts`), revisão de 21/11 |

## Observações
- Contra banco remoto (us-east-2) a integração exigiu `--testTimeout=180000` e, para `/hire` e `/confirm`, timeout de transação do Prisma maior que o padrão de 5 s (ajuste temporário, **revertido**; não faz parte desta entrega). Num banco com baixa latência passa com a config padrão. Em produção, transações longas (confirmar/contratar) devem ser observadas se o banco ficar longe da API — vale configurar `transactionOptions.timeout` no `PrismaService`.
- Texto do contrato mantido exatamente como fornecido. Atenção jurídica: a cláusula 6ª do modelo individual fala em "integrantes do grupo" também para artista solo.
- Contratações confirmadas antes deste módulo (inclusive seeds) não têm contrato; qualquer parte gera pelo botão "Gerar contrato".
- Sem IA, sem assinatura eletrônica, sem validade jurídica garantida, pagamento fora da plataforma.
