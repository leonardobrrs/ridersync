# Relatório — correção do conceito de rider (branch `feat/rider-update`)

Linha de base da comparação: **`origin/feat/evolucao-ridersync`** (`a138869`). A `feat/rider-update` foi rebaseada em cima dela e
contém **um commit** (`f0c19cb`) que só corrige o conceito de rider. Tudo que a `evolucao` trouxe fora do rider foi preservado.

Data: 23/11/2026 · Escopo: 34 arquivos, +799 / −470 em relação à `evolucao`.

## 1. Em uma frase

Na `evolucao`, **rider = o que o artista possui** e, em cada candidatura, o artista listava "o que precisa que a casa disponibilize".
Agora, **rider = o que o artista precisa para tocar**; em cada item ele informa **quanto já possui**, e a casa só precisa cobrir a
diferença. A comparação com a casa é automática e deixa explícito o que o artista deve levar.

## 2. Evolução × esta branch

| Tema | `feat/evolucao-ridersync` | `feat/rider-update` |
|---|---|---|
| Significado do rider | O que o artista **possui** e leva | O que o artista **precisa** para tocar |
| Quantidade no rider | "Quantidade que você tem" | "Quantidade necessária" + **"Já possuo"** (0 até o necessário) |
| O que a casa precisa fornecer | Lista separada por candidatura (`EventApplication.needs`, `NeedsPicker`) | Calculado: necessário − já possuo − o que a casa tem. Sem lista por candidatura |
| Comparação rider × casa | Informativa ("os dois têm / a casa tem menos / só no rider"); na candidatura, "Pedido à casa × Disponível" | Determinística, com resultado de compatibilidade e quem fornece cada parte |
| Caso "precisa de 2, possui 1, casa tem 1" | Não existia | **Compatível**: 1 da casa + 1 do artista, com aviso "Você precisa levar 1 un" |
| Perfil público da casa | Sem abas; "Estrutura técnica" numa seção | Abas **Sobre / Rider**; artista logado vê a comparação sozinha ao abrir **Rider** |
| Modal de candidatura | Escolha de necessidades + cachê/contraproposta + revisão | Comparação automática do rider com a casa do evento + **mesmo** cachê/contraproposta + revisão |
| Contratante na análise/negociação | "Pedido à casa" | "Comparar rider": mesmo resultado, na voz do contratante ("O artista vai levar …") |
| `POST /events/:id/applications` | `artistId`, `message`, `needs`, `proposedFeeCents` | `artistId`, `message`, `proposedFeeCents` (`needs` → 400) |
| Rider público do artista | Lista de itens | Lista de itens com "Já possui N" quando informado |
| Banco | `needs` em uso | `RiderItem.ownedQuantity` (+ CHECK); `needs` mantida, **descontinuada** |

## 3. Fluxo atual de funcionamento

### 3.1 Artista cadastra o rider
1. **Meu perfil › Rider técnico** (ou da banda). O texto explica: o rider é o que você *precisa*; informe quanto já possui.
2. Para cada item do catálogo (ou "outros"): **Quantidade necessária** e **Já possuo**.
3. "Já possuo" nunca passa do necessário (digitar 9 com necessário 3 vira 3; reduzir o necessário reduz o possuído). A API e o
   banco também recusam (`400` / CHECK `RiderItem_owned_within_quantity`).
4. Itens de exigência do local (palco, energia, luz, camarim) continuam fora do rider do artista.

### 3.2 Artista abre o perfil de uma casa de show
1. `/casas/:slug` → aba **Rider** (ou `?aba=rider`).
2. Artista logado: a comparação aparece **sem clicar em nada** (`GET /artists/:artistId/compatibility/:orgId`). Se tiver perfil
   individual e bandas, um seletor troca a identidade.
3. Abaixo, a "Estrutura técnica da casa" (inventário).
4. Visitante: vê só a estrutura e o convite "Entre com sua conta de artista". Contratante: não vê comparação.

### 3.3 Regra de comparação (por item; V = casa, R = necessário, O = já possuo)
A casa fornece `min(V, R)`. A falta é `R − min(V, R)` e precisa vir do artista.

| Situação | Resultado | Quem fornece |
|---|---|---|
| Falta = 0 | Compatível | Casa cobre tudo; artista não precisa levar |
| 0 < falta ≤ O | **Compatível** | Casa `min(V,R)` + **artista leva a falta** |
| falta > O (e V + O > 0) | Parcialmente disponível | Faltam `falta − O` sem cobertura |
| V = 0 e O = 0 | Indisponível | — |
| Item personalizado | Conferir com a casa (se O < R) · Compatível (se O ≥ R: artista leva tudo) | — |

Exemplos: R=2, O=1, V=1 → compatível, 1 da casa + 1 do artista. R=2, O=0, V=1 → parcial, falta 1. R=2, O=1, V=3 → compatível, a
casa cobre as 2 e o artista não precisa levar nada. Correspondência continua só por item de catálogo idêntico (sem substitutos).

### 3.4 O que o artista vê
- Colunas: Necessário · Você possui · A casa tem · **Você leva** · Resultado · Motivo.
- Aviso em destaque: "**Você precisa levar** 1 un · Amplificador de guitarra (a casa fornece 1). Com isso, a casa atende o seu rider."
- A API explica em terceira pessoa; a tela do artista troca "o artista" por "você" (`reasonFor`).

### 3.5 Candidatura
1. No modal, ao escolher a identidade, aparece **"Seu rider × [casa]"** com a comparação (evento sem casa de show mostra a
   orientação de combinar na negociação).
2. Cachê (aceitar o publicado ou contraproposta), mensagem e a etapa "Confirme sua candidatura" **permanecem como na `evolucao`**.
3. O corpo enviado não tem mais `needs`.

### 3.6 Contratante
- Na análise da candidatura: botão **Comparar rider** (não aparece em evento sem casa de show). O resultado mostra "O artista vai
  levar …" para os itens em que a casa depende do equipamento do artista.
- Na negociação: **Comparar rider com a casa**, com a perspectiva conforme o lado (artista ou contratante).
- "Contratar nas condições do evento" segue bloqueado quando há contraproposta (comportamento da `evolucao`).

## 4. Decisões de integração (resolução dos conflitos)

**Fiquei com o meu lado (conceito de rider):** `compatibility.ts`, `Compatibility.tsx`, `EquipmentEditor.tsx`, textos do
perfil público/painel/guia rápido, e o trecho de rider em docs, checklist e e2e. O commit `a138869` da `evolucao`
(rider = o que o artista tem) foi superado por completo nesses arquivos.

**Preservei da `evolucao`:** contraproposta de cachê na candidatura (`proposedFeeCents`, inclusive o bloqueio de contratação
direta), etapa de revisão da candidatura, tempo real (`/me/pulse`), histórico de negociações e de shows, CPF/CNPJ, tema
claro/escuro, ícones de contato e e-mail público com opt-in, prazos de pagamento.

**Removido:** `NeedsPicker.tsx` e o botão "Desmarcar o que já tenho no rider"; `NeedSchema`, a validação de `needs` na
candidatura e `needs` das respostas; `RIDER_VS_VENUE` (rótulos informativos que ficaram sem uso).

**Migrations:** a minha foi renomeada para `20261123140000_rider_quantidade_possuida`, para rodar **depois** das duas da
`evolucao` (`20261123113235`, `20261123130731`). O registro foi ajustado nos bancos locais `ridersync`, `ridersync_test` e
`ridersync_e2e`.

## 5. Verificação (já sobre a `evolucao`)

| Verificação | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | sem erros |
| Backend (Jest, unitários + integração) | 362 testes, 36 suítes, todos passando (inclui `reuniao-22-11`) |
| Frontend (Vitest) | 52 testes passando (6 novos) |
| Playwright | 32 passando (desktop, tablet, celular), com o fluxo principal atualizado |
| `npm run build` | API e SPA ok |

Os testes de integração rodaram no `ridersync_test` **local**, nunca no Supabase do `.env.test`.

## 6. Pontos de atenção

1. **Atualização remota:** o `git fetch` falhou por erro de certificado SSL desta máquina. O rebase usou a cópia local de
   `origin/feat/evolucao-ridersync` (`a138869`). Se alguém empurrou algo depois, é preciso `fetch` + novo rebase.
2. **Bancos de desenvolvimento/staging:** ainda precisam de `npm run db:migrate` (a migration deste commit e as duas da
   `evolucao`). O `ridersync` local já tem a nossa; faltam as duas da `evolucao`.
3. **Dados existentes:** riders cadastrados continuam com `quantity` e `ownedQuantity = 0`; passam a valer como "necessário".
   Quem seguiu a descrição antiga ("o que você possui") deve revisar o rider.
4. **Candidaturas antigas:** o que estava em `needs` deixa de ser exibido (a coluna foi mantida, sem apagar dados).
5. **Tela não verificada visualmente:** a aba **Rider** da casa no celular (o e2e responsivo ainda não cobre essa aba).
6. **Sem push:** nada foi enviado ao remoto. O commit anterior ao rebase está salvo na branch `backup/rider-update-pre-rebase`.
