# Roteiro de demonstração (dados fictícios)

Pré-requisito: `npm run db:up && npm run db:migrate && npm run db:seed`, depois `npm run dev:api` e `npm run dev:web`
(ou `API_NODE_ENV=development SEED_DEMO=true docker compose up --build` e acesse http://localhost:8080).
Senha de todas as contas demo: `Demo@RiderSync2026`.

1. **Visitante** — abra `/`: marketplace público com filtros (tipo, estilo, cidade, formação). Abra *Maré Alta*:
   portfólio, rider e integrantes públicos (sem e-mails da conta). Veja `/oportunidades` e `/casas`.
   Tente `/painel` → redireciona para login.
2. **Rafael (casa)** — `rafael@demo.ridersync.local`.
   - *Casas de show → Galpão Jaraguá*: aba **Inventário técnico** (bateria com quantidade 0, projetor personalizado).
   - Aba **Eventos → Sexta Autoral**: candidatura da Maré Alta em análise. **Comparar rider** mostra compatível,
     parcialmente disponível, indisponível e "conferir com a casa" com quantidades e motivo.
   - **Selecionar** a candidatura (não confirma contratação) → **Iniciar negociação** com proposta.
3. **Ana (artista/banda)** — `ana@demo.ridersync.local`.
   - *Negociações*: proposta direta do Galpão e a negociação da Maré Alta. Faça **Contraproposta** (a proposta anterior
     fica no histórico como "Substituída") e envie uma **mensagem**.
   - *Minhas bandas → Maré Alta → Integrantes*: papéis, convite pendente do João, transferência de propriedade;
     tente sair da banda sendo a única OWNER → bloqueado.
   - *Meu perfil → Rider técnico*: rider individual independente do rider da banda.
4. **Rafael** — aceite a contraproposta e clique **Confirmar contratação**; o registro de estados mostra a trilha de
   auditoria. *Apresentações* lista a contratação confirmada (ainda não "realizada").
5. **Lia (MEMBER)** — `lia@demo.ridersync.local`: vê a banda em modo leitura; não edita nem negocia.
6. **João** — `joao@demo.ridersync.local`: *Convites* → aceitar o convite da Maré Alta.
7. **Celular** — reduza a janela (ou use o modo dispositivo): barra inferior de atalhos e filtros em diálogo.
