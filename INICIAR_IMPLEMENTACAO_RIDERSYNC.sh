#!/usr/bin/env bash
set -Eeuo pipefail

# Execute na raiz do repositório RiderSync após extrair o pacote de setup.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if ! command -v claude >/dev/null 2>&1; then
  echo "ERRO: Claude Code não foi encontrado no PATH. Instale/ajuste o comando 'claude' e tente novamente." >&2
  exit 1
fi

REQUIRED_FILES=(
  ".claude/skills/ridersync-domain/SKILL.md"
  "docs/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt"
  "docs/references/Arquitetura_Plataforma_Profissionalizacao_Artistica_v1.2.md"
  "docs/references/RiderSync_celular.html"
  "docs/references/RiderSync_desktop.html"
)
for file in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERRO: arquivo necessário não encontrado: $file" >&2
    echo "Extraia RIDERSYNC_CLAUDE_SETUP_v1.2.zip na raiz do repositório e execute novamente." >&2
    exit 1
  fi
done

PROMPT=$(cat <<'PROMPT_EOF'
Você é o principal engenheiro de software responsável por IMPLEMENTAR o RiderSync neste repositório. Esta é uma solicitação de execução, não apenas de planejamento. Implemente o produto inteiro dentro do escopo atual do MVP, de ponta a ponta, usando a skill ridersync-domain e os documentos de referência.

## LEITURA OBRIGATÓRIA ANTES DE CODIFICAR
1. Leia `.claude/skills/ridersync-domain/SKILL.md`.
2. Leia `docs/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt`.
3. Leia `docs/references/Arquitetura_Plataforma_Profissionalizacao_Artistica_v1.2.md`.
4. Inspecione `docs/references/RiderSync_celular.html`, `docs/references/RiderSync_desktop.html` e `docs/references/riderSync_entidades.txt`.
5. Leia `CLAUDE.md`, `README.md`, `docs/DECISOES_TECNICAS.md` e o código existente, se já existirem.
6. Inspecione `git status`, a árvore do repositório, versões de Node/npm e os comandos de teste/build existentes. Preserve todo trabalho preexistente.

A ordem de autoridade é: decisões explícitas mais recentes do usuário; instruções v1.1; skill RiderSync; documento de arquitetura; protótipos como referência visual/comportamental. Em caso de conflito de escopo, EDITAIS ESTÃO ADIADOS e não podem ser implementados.

## OBJETIVO: ENTREGAR O MVP COMPLETO
Implemente uma aplicação funcional e integrada, não apenas telas, endpoints vazios, mocks ou documentação. O fluxo deve funcionar de verdade de React até a API, regras de domínio e PostgreSQL.

### Escopo que DEVE ser implementado
1. Fundação do projeto, ambiente local, configuração, migrations e documentação.
2. Cadastro, autenticação, logout e gerenciamento básico da conta.
3. Perfil profissional individual do músico, edição e visibilidade pública/privada.
4. Bandas com perfil coletivo independente, portfólio e rider próprios; memberships; convites; aceite/recusa; papéis OWNER, ADMIN e MEMBER; proteção do último OWNER.
5. Organizações/casas de show com perfil, responsáveis e papéis OWNER/ADMIN.
6. Marketplace público de músicos e bandas, páginas de perfil, busca e filtros essenciais por nome, estilo e localização.
7. Portfólio com links externos validados e suporte a imagens/arquivos conforme uma estratégia local documentada e uma interface de armazenamento desacoplada.
8. Catálogo de itens técnicos, riders individuais e de bandas, inventário de equipamentos da casa e comparação determinística no backend.
9. Publicação/edição/encerramento de oportunidades de apresentação por casas, vagas, prazos e condições essenciais.
10. Candidaturas de artistas/bandas, acompanhamento, retirada quando permitido, análise/aceite/recusa pela casa e prevenção de duplicidade.
11. Booking/negociação tanto por proposta direta quanto a partir de candidatura selecionada; ofertas, contrapropostas, mensagens, histórico, aceite/recusa e confirmação explícita.
12. Painel simples com ações pendentes e listagem/histórico básico de apresentações confirmadas/realizadas, sem agenda complexa.
13. Responsividade desktop/mobile, estados de carregamento/erro/vazio/sucesso, acessibilidade básica, testes e documentação.

### Funcionalidades expressamente FORA DO ESCOPO
- Editais, oportunidades culturais, chamamentos, financiamentos e qualquer catálogo relacionado.
- Não criar modelos, migrations, rotas, controllers, serviços, telas, navegação, seeds ou testes de editais/CulturalOpportunity/OpportunityRequirement.
- Não implementar pagamentos, custódia ou repasse financeiro.
- Não implementar recomendações por IA, substituição inteligente de equipamentos, compatibilidade sem correspondência explícita, agenda avançada, produtoras/agências/festivais ou analytics avançado.
- Avaliações e reviews não estão suficientemente especificadas; não invente um sistema completo de avaliações.

## DECISÕES TÉCNICAS FIXAS
- Frontend: React + TypeScript + Vite, uma SPA responsiva.
- Frontend: React Router, TanStack Query, React Hook Form e Zod; reutilize dependências existentes quando corretas.
- Backend: Node.js LTS + TypeScript + NestJS.
- Arquitetura: UM ÚNICO BACKEND NestJS como monólito modular; UM único banco PostgreSQL. Frontend e backend podem estar em diretórios separados, mas não são microserviços.
- Persistência: PostgreSQL + Prisma ORM + migrations versionadas.
- API: REST documentada com Swagger/OpenAPI.
- Testes backend: Jest + Supertest. Testes E2E de navegador: Playwright quando viável.
- Ambiente local: Docker Compose.
- Validação: Zod integrado adequadamente ao NestJS.
- Não adicionar microserviços, segundo backend, Redis, filas, CQRS, event sourcing ou infraestrutura distribuída.

Prefira estrutura simples de monorepo com `frontend/`, `backend/`, `docs/`, `docker-compose.yml` e documentação na raiz. Adapte se o repositório já possuir uma estrutura funcional; não faça migração cosmética sem necessidade.

## REGRAS DE DOMÍNIO INEGOCIÁVEIS
- User é a conta de uma pessoa; não use um papel global ARTIST/VENUE. Uma pessoa pode ter perfil individual, participar de várias bandas e administrar várias casas.
- MusicianProfile é independente da conta e tem dados públicos/privados bem separados.
- Band tem identidade, portfólio e rider próprios; nunca herda/sobrescreve automaticamente dados dos integrantes.
- BandMember controla vínculo, estado e papel. Convite pendente não é membership ativa. OWNER/ADMIN administram; MEMBER não. Impedir remoção/rebaixamento do último OWNER sem transferência válida, na mesma operação transacional.
- Organization no MVP representa VENUE. OrganizationMember controla o acesso à organização específica. Verifique membership e papel no backend para toda operação protegida.
- Event separa `organizerId` (organização responsável) de `venueId` (local físico opcional). Estados sugeridos: DRAFT, OPEN, CLOSED, COMPLETED, CANCELLED.
- EventApplication não é Booking. Estados sugeridos: PENDING, ACCEPTED, REJECTED, WITHDRAWN. Impedir candidatura duplicada para a mesma identidade artística/evento com integridade no banco.
- Aceitar candidatura não confirma contratação automaticamente.
- Booking pode nascer de proposta direta ou candidatura selecionada. Ambos os caminhos convergem para o mesmo fluxo.
- BookingOffer deve preservar todas as propostas/contrapropostas, autores, termos, timestamps e respostas; nunca sobrescrever a oferta anterior.
- BookingMessage pertence ao Booking e só pode ser acessado pelos participantes autorizados.
- Confirmação de contratação é transição explícita, autorizada e auditável. Booking confirmado não significa apresentação realizada nem pagamento.
- Performance é distinta de evento, candidatura e booking confirmado.
- Riders individuais e de bandas são independentes. Inventário da venue é separado dos riders.
- Use catálogo com IDs estáveis para itens comparáveis. Correspondência apenas por ID explícito; não inferir substitutos.
- Compare rider sob demanda no backend: COMPATIBLE se disponível >= necessário; PARTIALLY_AVAILABLE se disponível > 0 e menor que o necessário; UNAVAILABLE se ausente/zero; item customizado/sem correspondência fica NEEDS_CHECK/manual, sem auto-match. Explique quantidades, unidade e motivo.
- Dados públicos nunca podem expor hash/senha, e-mail/contato privado, mensagens, convites pendentes ou dados internos.

## DECISÕES PENDENTES: NÃO TRAVE A ENTREGA
Não interrompa a execução para perguntar sobre detalhes não bloqueantes. Faça escolhas simples e reversíveis, documente-as em `docs/DECISOES_TECNICAS.md` e mantenha o schema relacional íntegro.
- Avalie a entidade comum `Artist` somente se realmente simplificar marketplace, candidaturas, bookings e riders. Não use `type + id` polimórfico sem FK. Prefira solução relacional explícita se houver dúvida.
- Defina campos mínimos para publicação de perfil e candidatura.
- Defina um fluxo pragmático de convite de integrantes e documente-o.
- Para autenticação, implemente uma estratégia segura apropriada à SPA/API, com cookies HttpOnly/SameSite/Secure em produção ou alternativa segura documentada; não coloque tokens sensíveis em localStorage. Documente CSRF/CORS e expiração.
- Para arquivos, implemente armazenamento local seguro para desenvolvimento atrás de uma interface/adapter; deixe suporte S3 configurável sem exigir credenciais externas para executar localmente.
- Ratings/reviews permanecem ausentes.

## REGRAS DE EXECUÇÃO: NÃO PARE NO PLANO
1. Primeiro inspecione e produza um plano conciso internamente ou em `docs/IMPLEMENTATION_PROGRESS.md`.
2. Em seguida, CONTINUE DIRETAMENTE para a implementação. Não encerre a resposta após apresentar arquitetura, plano, scaffolding ou lista de tarefas.
3. Trabalhe em fatias verticais sequenciais: fundação; auth; perfil; bandas; venues; marketplace/portfólio; riders/inventário/comparação; eventos/candidaturas; booking/ofertas/mensagens; dashboard/histórico; hardening/testes/documentação.
4. Em cada fatia, implemente UI, endpoints, validação, autorização, persistência e testes relevantes antes de marcar como concluída.
5. Atualize `docs/IMPLEMENTATION_PROGRESS.md` ao final de cada fatia com status, arquivos, migrations, comandos/testes, falhas e próximo passo. Isso deve permitir retomada caso o contexto seja compactado.
6. Use a skill `ridersync-domain` em todas as mudanças relevantes de domínio. Use skills de React, Prisma, Frontend Design, Playwright e Superpowers se estiverem instaladas. A ausência de skills opcionais não deve bloquear o desenvolvimento.
7. Reaproveite a identidade visual e os fluxos dos HTMLs como referência; reconstrua tudo em React. Não mantenha duas interfaces independentes e não use localStorage como banco de dados de produção.
8. Crie seeds de demonstração somente para ambiente de desenvolvimento, claramente identificadas como fictícias. Não copie senhas ou contas de demonstração dos protótipos para produção.
9. Evite TODOs, stubs, endpoints fake, dados hardcoded para simular persistência e botões sem ação. Quando integração externa exigir segredo, faça implementação configurável e forneça modo local funcional.
10. Não apagar nem sobrescrever trabalho preexistente. Antes de migrations ou comandos com potencial destrutivo, inspecione o banco e use apenas operações não destrutivas. NUNCA execute `prisma migrate reset`, `db push --force-reset`, `git reset --hard`, `git clean -fd`, remoções em massa ou comandos equivalentes.
11. Não faça deploy, não publique dados, não envie e-mails reais e não crie contas em serviços externos sem autorização explícita.
12. Não exponha segredos. Crie `.env.example`, valide variáveis necessárias e adicione `.env` ao `.gitignore`.
13. Se um comando falhar, investigue a causa, corrija e repita. Não ignore falhas de lint, typecheck, testes ou build. Não afirme que testes passaram sem executá-los.
14. Não espere intervenção do usuário para decisões técnicas rotineiras. Só pare uma ação específica se exigir segredo/credencial indisponível ou risco real de perda de dados; continue tudo que puder sem esse bloqueio e documente a limitação.

## VALIDAÇÃO OBRIGATÓRIA ANTES DE ENCERRAR
- Instalar dependências de forma reproduzível e manter lockfiles.
- Executar migrations em banco local limpo de desenvolvimento, sem resetar banco desconhecido.
- Executar lint, typecheck, testes unitários, testes de integração e builds de frontend/backend disponíveis.
- Executar E2E Playwright nos fluxos críticos quando o ambiente permitir: cadastro/login; criação de perfil; criação/gestão de banda e convite; criação de venue; marketplace público; CRUD de rider/inventário e comparação; publicar evento/candidatar/analisar; proposta direta; negociação/contraproposta/mensagem; confirmação e histórico.
- Testar autorização negativa: acesso a perfil/organização/booking de terceiros, último OWNER, membro MEMBER tentando administrar, visitante acessando dados privados.
- Corrigir as falhas encontradas e repetir os testes afetados.
- Verificar execução documentada via Docker Compose e README.
- Criar/atualizar `CLAUDE.md`, `README.md`, `docs/DECISOES_TECNICAS.md`, `docs/IMPLEMENTATION_PROGRESS.md` e instruções de demonstração.

## CONDIÇÃO DE CONCLUSÃO E RELATÓRIO
Não declare o MVP concluído se houver fluxo P0 faltando, persistência simulada, endpoints vazios, autorização somente no frontend, migrations não verificadas ou testes relevantes não executados.
Quando tudo o que for possível no ambiente atual estiver implementado, entregue um relatório objetivo com:
- Funcionalidades concluídas e eventuais limitações.
- Estrutura de frontend/backend e módulos NestJS.
- Modelagem Prisma e migrations criadas.
- Estratégia de autenticação e armazenamento.
- Como iniciar o projeto localmente.
- Usuários/seed de demonstração (somente credenciais fictícias de desenvolvimento).
- Comandos executados e resultados reais de lint, typecheck, testes, E2E e builds.
- Pendências externas ou bloqueios não resolvidos.

Comece agora inspecionando o repositório e os documentos obrigatórios. Depois implemente efetivamente o MVP completo, sem interromper o trabalho após o planejamento.
PROMPT_EOF
)

printf '\nIniciando Claude Code no diretório: %s\n' "$ROOT"
printf 'Modelo: Opus | Permissões: acceptEdits (edições permitidas; comandos de terminal continuam sujeitos a aprovação)\n\n'
exec claude --model opus --permission-mode acceptEdits "$PROMPT"
