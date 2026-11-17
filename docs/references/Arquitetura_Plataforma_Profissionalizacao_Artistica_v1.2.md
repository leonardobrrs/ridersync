**uDOCUMENTO DE PRODUTO E ARQUITETURA**

**Plataforma de**  
**Profissionalização Artística**

Visão do produto, decisões de design, histórias de usuário e diretrizes para construir um MVP evolutivo

|  |  |  |
| :---- | :---- | :---- |

**PROPÓSITO**

Ajudar músicos independentes e pequenas bandas a organizar sua atuação profissional, dar visibilidade ao próprio trabalho, avaliar requisitos de oportunidades culturais e antecipar necessidades técnicas de apresentações.

| Documento | Arquitetura conceitual e plano de desenvolvimento do MVP |
| :---- | :---- |
| Versão | 1.2 — stack backend recomendada e cruzamentos automáticos básicos no MVP |
| Data | 11 de novembro de 2026 |

*Escopo inicial: músicos independentes, bandas e casas de show / espaços culturais em Alagoas.*

# **Como utilizar este documento**

Este documento consolida a visão do produto, as decisões de experiência, o escopo funcional do MVP e a stack tecnológica recomendada. Ele deve orientar a apresentação acadêmica, o desenho da experiência, a modelagem de dados e a ordem de implementação. Não substitui um diagrama ER físico nem uma especificação detalhada de API; funciona como referência de arquitetura e escopo para que essas entregas sejam construídas de forma coerente.

| LEITURA IMPORTANTE — DECISÕES E HIPÓTESES As decisões identificadas como consolidadas devem orientar o MVP. Os pontos marcados como “em aberto” ainda precisam de validação. Recomendações técnicas adicionais são apresentadas como diretrizes, não como decisões já implementadas. |
| :---- |

## **Estrutura do documento**

* 1\. Apresentação do projeto e argumento de valor  
* 2\. Objetivos, limites e princípios do produto  
* 3\. Personas, navegação e decisões de experiência  
* 4\. Arquitetura conceitual e responsabilidades das entidades  
* 5\. Módulos funcionais e fluxos principais  
* 6\. Histórias de usuário e critérios de aceitação  
* 7\. Fluxo de desenvolvimento recomendado  
* 8\. Prioridades e entregas do MVP  
* 9\. Cuidados arquiteturais e prevenção de retrabalho  
* 10\. Decisões pendentes, glossário e critérios de conclusão

# **1\. Apresentação do projeto**

## **1.1 A ideia em uma apresentação curta**

| PITCH DO PROJETO A plataforma é um ambiente digital de profissionalização para músicos independentes e pequenas bandas. Em vez de oferecer apenas uma vitrine para divulgação, ela reúne em um mesmo lugar ferramentas para organizar a carreira artística — perfil profissional, portfólio e rider técnico — e caminhos para encontrar oportunidades culturais, candidatar-se a apresentações e negociar contratações com casas de show. Assim, o artista deixa de depender exclusivamente de contatos informais ou de ser encontrado por contratantes: ele passa a ter uma presença profissional organizada e pode buscar ativamente novas oportunidades. O sistema aproxima artistas e espaços culturais, mas não intermedeia pagamentos; as partes negociam pela plataforma e realizam os pagamentos externamente. |
| :---- |

Versão de uma frase: “Uma plataforma que ajuda artistas independentes a se apresentarem profissionalmente, encontrarem oportunidades e se conectarem a espaços culturais — da organização da carreira à negociação de apresentações.”

## **1.2 Problema que o projeto pretende enfrentar**

O projeto parte da hipótese de que músicos independentes e pequenas bandas frequentemente precisam organizar sua atuação profissional utilizando ferramentas dispersas: redes sociais para divulgação, arquivos separados para portfólio e rider, conversas informais para negociar apresentações e buscas manuais para encontrar editais ou espaços interessados. Essa dispersão pode dificultar a apresentação profissional do trabalho, a atualização das informações e a descoberta de oportunidades.

O problema deve ser apresentado como uma necessidade que o projeto pretende investigar e atender, não como uma estatística de mercado já comprovada. A validação acadêmica pode ser fortalecida com entrevistas, questionários ou observação de músicos e casas de show da região.

## **1.3 Proposta de solução**

A solução combina duas frentes complementares:

* Profissionalização: perfil individual ou coletivo, portfólio, rider técnico e organização de informações relevantes para a carreira.  
* Conexão com oportunidades: marketplace público, publicação de eventos com vagas para artistas, candidaturas, propostas e consulta de oportunidades culturais.

O marketplace não é o produto inteiro. Ele é uma das ferramentas que dá utilidade econômica e visibilidade ao ambiente de profissionalização.

## **1.4 Diferenciais e valor entregue**

| Para artistas e bandas | Para casas de show / espaços culturais |
| :---- | :---- |
| Centralizar informações profissionais em um perfil que pode ser apresentado a contratantes. | Encontrar artistas com informações organizadas, portfólio e dados técnicos acessíveis. |
| Manter portfólio e rider próprios, inclusive para a identidade coletiva de uma banda. | Publicar oportunidades de apresentação e receber candidaturas em um fluxo estruturado. |
| Descobrir oportunidades e candidatar-se ativamente, sem depender apenas de propostas recebidas. | Pesquisar artistas e iniciar conversas ou propostas de contratação. |
| Acompanhar candidaturas, propostas e apresentações em um só ambiente. | Reduzir a dispersão de contatos e informações durante a seleção de atrações. |

## **1.5 Por que o escopo é adequado ao MVP**

O MVP concentra-se em duas personas com objetivos complementares: artista/banda e casa de show. Essa escolha oferece um ciclo de valor claro — artista organiza e divulga seu trabalho; casa encontra artistas ou publica vagas; ambos podem iniciar uma negociação — sem exigir de início uma plataforma completa para produtoras, agências, festivais ou gestão avançada de programação.

# **2\. Objetivos, limites e princípios do produto**

## **2.1 Objetivo central**

Ajudar músicos independentes e pequenas bandas a profissionalizarem sua presença, organizarem materiais essenciais, encontrarem oportunidades culturais e de apresentação e receberem propostas de contratação.

## **2.2 Objetivos específicos do MVP**

* Permitir a criação de uma identidade profissional individual e de uma identidade própria para bandas.  
* Disponibilizar perfis públicos e portfólios que facilitem a descoberta de artistas.  
* Permitir cadastro e atualização de riders técnicos independentes por artista ou banda.  
* Permitir que casas de show mantenham um perfil de estabelecimento e publiquem eventos com vagas para apresentações.  
* Organizar o ciclo de candidatura, análise e início de negociação.  
* Permitir consulta de editais e oportunidades culturais com requisitos e fonte original.  
* Oferecer um painel simples que leve o usuário às próximas ações profissionais.  
* Executar automaticamente, sob demanda e por regras explícitas, a comparação dos itens e quantidades do rider do artista/banda com os equipamentos cadastrados pela casa de show.  
* Comparar requisitos estruturados de oportunidades culturais com informações do perfil profissional, distinguindo atendimento, não atendimento, ausência de informação e necessidade de verificação.

## **2.3 Fora do escopo do MVP**

* Processamento, custódia ou repasse de pagamentos.  
* Persona e fluxos completos para produtores independentes, agências, produtoras e festivais.  
* Recomendação automática de artistas ou oportunidades baseada em inteligência artificial.  
* Interpretação automática de editais em PDF, análise documental automatizada e recomendação inteligente de elegibilidade.  
* Sugestões inteligentes de substituição de equipamentos, otimização avançada e análise complexa de compatibilidade de riders.  
* Gestão avançada de festivais, programação, equipes ou múltiplos palcos.  
* Sistema configurável e complexo de permissões.

## **2.4 Princípios orientadores**

| Princípio | Aplicação prática |
| :---- | :---- |
| Artista como protagonista | Toda funcionalidade deve contribuir para a organização, apresentação ou descoberta do trabalho artístico. |
| Experiência simples, domínio coerente | A interface do MVP pode atender apenas duas personas, sem limitar desnecessariamente os conceitos do domínio. |
| Separar ciclos de vida | Perfil, banda, evento, candidatura, negociação e apresentação são conceitos diferentes. |
| Preparar sem antecipar | Criar pontos de extensão previsíveis, mas não implementar comportamentos de personas futuras. |
| Informação confiável | Exibir claramente prazos, estados, requisitos e origem das oportunidades; não inferir dados ausentes. |
| Pagamento externo | A plataforma organiza a conexão e a negociação, sem assumir o papel de processadora de pagamentos. |

# **3\. Personas, navegação e decisões de experiência**

## **3.1 Personas do MVP**

| Persona | Objetivos principais | Ações na plataforma |
| :---- | :---- | :---- |
| Artista individual | Profissionalizar a carreira, divulgar o trabalho e encontrar apresentações. | Criar perfil, atualizar portfólio e rider, buscar oportunidades, candidatar-se e negociar propostas. |
| Banda | Construir uma identidade coletiva independente dos perfis dos integrantes. | Criar perfil próprio, gerenciar membros, portfólio e rider, candidatar-se e receber propostas. |
| Casa de show / espaço cultural | Descobrir artistas e organizar a captação de atrações. | Manter perfil do espaço, publicar eventos com vagas, receber candidaturas, pesquisar artistas e enviar propostas. |

Artista individual e banda são duas formas de atuação da persona principal. Para efeitos de escopo, não são personas independentes: compartilham objetivos, mas possuem necessidades específicas de gestão e identidade.

## **3.2 Duas experiências conectadas**

| Área pública — Marketplace | Área privada — Painel profissional |
| :---- | :---- |
| Página inicial para visitantes; busca e descoberta de músicos e bandas; perfis e portfólios públicos; acesso às oportunidades de apresentação e culturais. | Dashboard; gerenciamento de perfil; portfólio; rider; oportunidades e candidaturas; propostas e negociação; agenda ou histórico básico. |

## **3.3 Comportamento de entrada**

| Situação | Comportamento esperado |
| :---- | :---- |
| Visitante sem conta | Acessa o marketplace e pode explorar perfis e oportunidades públicas. |
| Usuário cadastrado sem perfil profissional | Continua explorando o marketplace e recebe incentivo contextual para criar seu perfil. |
| Usuário com perfil profissional | É direcionado ao painel profissional, mantendo o marketplace disponível no menu. |
| Responsável por casa de show | Acessa as funções de gestão da organização conforme sua associação e permissão. |
| Administrador de banda | Acessa a área de gestão da banda conforme o vínculo e a permissão atribuída. |

## **3.4 Navegação sugerida**

No painel do artista, a navegação principal deve privilegiar tarefas recorrentes: Visão geral; Meu perfil; Minha banda (quando aplicável); Portfólio; Rider técnico; Oportunidades de apresentação; Oportunidades culturais; Minhas propostas; Minha agenda; Marketplace.

Na área da casa de show, a navegação pode ser organizada em: Visão geral; Perfil do estabelecimento; Eventos e oportunidades; Candidaturas recebidas; Buscar artistas; Propostas e negociações.

| DECISÃO DE UX A seção destinada a eventos deve ser apresentada ao artista como “Oportunidades de apresentação”. O mesmo objeto de domínio pode aparecer como “Eventos” ou “Publicações” na área administrativa da casa de show, mas a linguagem deve refletir o objetivo de cada persona. |
| :---- |

## **3.5 Dashboard**

O dashboard deve funcionar como ponto de partida, não como painel analítico complexo. Recomenda-se apresentar: propostas pendentes, candidaturas em andamento, oportunidades culturais recentes, progresso de preenchimento do perfil, atalhos para editar portfólio/rider, atividade recente e próximas apresentações confirmadas. Indicadores avançados ficam para versões posteriores.

# **4\. Arquitetura conceitual e responsabilidades das entidades**

## **4.1 Visão arquitetural recomendada**

Para o MVP, recomenda-se uma aplicação backend única organizada como monólito modular, com módulos separados por domínio funcional e uma API REST para comunicação com o frontend. Essa abordagem reduz o custo operacional e a complexidade de integração, mantendo fronteiras internas claras para uma possível evolução futura. A stack recomendada é TypeScript sobre Node.js LTS, utilizando NestJS, PostgreSQL e Prisma ORM.

| ORGANIZAÇÃO EM CAMADAS Interface / apresentação → casos de uso e aplicação → regras de domínio → persistência e serviços externos. As regras de autorização e integridade não devem existir apenas na interface: precisam ser verificadas no servidor e, quando aplicável, protegidas também por constraints no banco. |
| :---- |

Os módulos podem ser separados em Identidade e Acesso; Perfis e Bandas; Organizações; Marketplace; Oportunidades e Eventos; Contratações; Riders; Oportunidades Culturais; e Painel/Notificações. A separação é lógica e não exige serviços independentes. No MVP, os módulos devem permanecer na mesma aplicação e compartilhar o mesmo banco relacional, respeitando suas responsabilidades.

## **4.2 Stack tecnológica recomendada**

A recomendação abaixo prioriza produtividade no desenvolvimento acadêmico, tipagem, consistência relacional, validação das regras de negócio e facilidade de manutenção. Ela é uma escolha de referência para o projeto, não uma exigência de que todos os componentes sejam instalados desde o primeiro dia.

| Camada / necessidade | Tecnologia recomendada | Uso no projeto |
| :---- | :---- | :---- |
| Linguagem e runtime | TypeScript \+ Node.js LTS | Linguagem principal do backend e ambiente de execução. Selecionar uma versão LTS compatível com a versão do NestJS e suas dependências. |
| Framework | NestJS | Estrutura modular com controllers, providers, guards e serviços. Implementar como monólito modular, sem microserviços no MVP. |
| API | REST \+ Swagger / OpenAPI | Endpoints HTTP para o frontend e documentação dos contratos da API. |
| Banco de dados | PostgreSQL | Persistência relacional, transações, chaves estrangeiras, índices e constraints para integridade. |
| ORM e migrations | Prisma ORM | Acesso tipado aos dados e controle de migrations. Regras críticas também devem ser protegidas por constraints no banco. |
| Validação | Zod | Validação de payloads e dados de entrada, integrada ao NestJS por pipes/adaptadores compatíveis. |
| Autenticação e autorização | NestJS Guards \+ Passport ou estratégia equivalente | Verificar identidade e permissões com base nos vínculos de membership. Definir entre cookie seguro/sessão ou access token com refresh seguro conforme a arquitetura do frontend. |
| Testes | Jest \+ Supertest | Testes unitários de regras e testes de integração dos endpoints e fluxos críticos. |
| Ambiente local | Docker Compose | Padronizar a execução local do backend e do PostgreSQL. |
| Arquivos e mídia | Armazenamento de objetos compatível com S3 | Guardar imagens, documentos e materiais de portfólio; no PostgreSQL ficam metadados e referências, não arquivos grandes. |

Organização interna sugerida: controllers recebem requisições e validam o contrato HTTP; serviços de aplicação coordenam os casos de uso; serviços/regras de domínio implementam decisões do negócio; Prisma realiza a persistência. Não criar camadas ou padrões genéricos sem necessidade demonstrada.

Não iniciar o MVP com Redis, filas, microserviços ou CQRS. Esses componentes só devem ser adicionados quando houver uma necessidade concreta, como processamento assíncrono significativo, cache comprovadamente necessário ou escala que justifique a separação.

## **4.3 Entidades centrais**

| Entidade | Responsabilidade | Observações de modelagem |
| :---- | :---- | :---- |
| User | Representar a pessoa e sua conta de acesso. | Não deve conter um papel global como ARTIST ou VENUE. Uma pessoa pode ter várias relações no sistema. |
| MusicianProfile | Representar a identidade profissional individual. | Relaciona-se à conta da pessoa; guarda biografia, localização, estilos, habilidades e informações profissionais. |
| Band | Representar um grupo musical com identidade própria. | Tem perfil público, portfólio e rider próprios; não herda automaticamente dados dos integrantes. |
| BandMember | Representar a participação de uma pessoa em uma banda. | Permite múltiplas bandas por pessoa e múltiplos integrantes por banda; contém papel e estado do convite/vínculo. |
| Organization | Representar uma organização ou estabelecimento contratante. | No MVP, a interface aceita inicialmente o tipo VENUE. Dados do estabelecimento incluem nome, endereço, capacidade e informações de contato. |
| OrganizationMember | Representar a associação de pessoas a uma organização. | Permite responsáveis e administradores; não mistura o vínculo organizacional com o perfil individual. |
| Event | Representar uma publicação de evento/oportunidade de apresentação. | Separa responsável pela organização do evento e local físico; inclui prazo e vagas para candidatura no MVP. |
| EventApplication | Representar a candidatura de um artista/banda a um evento. | Tem estado e histórico próprios; não equivale a uma contratação. |
| Booking | Representar a negociação ou acordo comercial. | Pode originar-se de uma candidatura ou de uma proposta direta pelo marketplace. |
| BookingOffer | Representar proposta, contraproposta e condições comerciais. | Mantém histórico das condições e do estado de cada oferta. |
| BookingMessage | Representar mensagens vinculadas à negociação. | Deve estar associada a um Booking, mantendo o contexto da conversa. |
| Performance | Representar uma apresentação efetivamente realizada ou registrada. | É posterior à contratação confirmada; não equivale ao pagamento. |
| TechnicalRider / RiderItem | Representar o rider e seus itens técnicos. | O artista individual e a banda mantêm riders próprios e independentes. |
| CulturalOpportunity | Representar edital, chamamento, residência, seleção ou financiamento. | Deve manter instituição, prazo, localidade, requisitos e link para fonte original. |
| OpportunityRequirement | Representar um requisito de uma oportunidade cultural. | A ausência de dado do artista deve permanecer como “não informado”, não “não atende”. |
| VenueEquipmentItem | Representar equipamentos e recursos técnicos disponíveis em uma casa de show. | Pertence à Organization do tipo VENUE; registra item, quantidade, categoria e observações. É separado do rider do artista. |

## **4.4 Relações conceituais principais**

| Relação | Cardinalidade conceitual | Regra importante |
| :---- | :---- | :---- |
| User — MusicianProfile | Uma conta pode ter no máximo um perfil individual no modelo inicial. | O perfil profissional não é a própria conta; manter credenciais e dados profissionais separados. |
| User — BandMember — Band | Uma pessoa pode participar de várias bandas; uma banda pode ter várias pessoas. | Usar entidade associativa com papel, estado e datas do vínculo. |
| User — OrganizationMember — Organization | Uma pessoa pode administrar várias organizações; uma organização pode ter várias pessoas. | No MVP, OWNER e ADMIN são suficientes para casas de show. |
| Organization — Event | Uma organização pode publicar vários eventos. | O organizador é obrigatório; no MVP, deve ser uma organização do tipo VENUE. |
| Organization — Event (venue) | Um estabelecimento pode sediar vários eventos; o local pode estar ausente. | venueId é opcional e distinto de organizerId. |
| Event — EventApplication | Um evento recebe várias candidaturas. | Impedir duplicidade de candidatura do mesmo artista ao mesmo evento. |
| Artist — Booking | Um artista ou banda pode participar de várias negociações. | A referência comum Artist é uma possibilidade a validar; evitar referências polimórficas sem integridade. |
| Booking — BookingOffer / BookingMessage | Uma negociação possui várias ofertas e mensagens. | Preservar histórico e estados; não sobrescrever silenciosamente uma proposta anterior. |
| Booking — Performance | Uma contratação pode resultar em uma ou mais apresentações, conforme o escopo adotado. | No MVP, pode-se limitar a uma apresentação por booking se a regra de negócio assim exigir. |
| TechnicalRider — RiderItem | Um rider possui vários itens técnicos. | Cada item registra equipamento/recurso, quantidade, categoria e observações necessárias. |
| Organization (VENUE) — VenueEquipmentItem | Uma casa de show possui vários itens de estrutura/equipamentos. | Manter o inventário do espaço separado do rider do artista ou banda. |
| CulturalOpportunity — OpportunityRequirement | Uma oportunidade possui vários requisitos estruturados. | Cada requisito deve poder ser comparado com campos do perfil ou marcado para verificação humana. |

## **4.5 Organização, banda e casa de show não são a mesma coisa**

Band e Organization devem permanecer separadas. Ambas podem ter vários usuários associados, mas representam conceitos diferentes: a banda é uma identidade artística coletiva; a organização representa um estabelecimento ou contratante. Compartilhar o fato de possuírem administradores não justifica fundi-las em uma única tabela.

A casa de show deve ser modelada como Organization com tipo VENUE no MVP. No futuro, tipos como PRODUCTION\_COMPANY, AGENCY ou FESTIVAL poderão ser habilitados sem transformar User em uma conta de um único tipo. Essa extensibilidade não exige que os fluxos futuros sejam construídos agora.

## **4.6 Event: organizador e local físico**

Event deve manter dois conceitos separados: organizerId identifica quem responde pela publicação e pela seleção; venueId identifica onde o evento acontece e pode ser opcional. No MVP, o organizador será uma casa de show. No futuro, uma produtora ou festival poderá organizar uma apresentação em uma casa de show diferente, ou publicar um evento cujo local ainda não esteja definido.

Para o MVP, Event deve suportar pelo menos título, descrição, organizador, local opcional, data/horário, prazo de candidatura, quantidade de vagas, estilos ou características procuradas, condições da apresentação, requisitos e estado da publicação. A modelagem física deve ser ajustada ao fluxo real da interface e às regras de validação.

## **4.7 EventApplication não é Booking**

| REGRA DE DOMÍNIO ESSENCIAL A candidatura comunica interesse em participar de uma oportunidade. A contratação registra uma negociação comercial ou um acordo entre as partes. Aceitar uma candidatura pode iniciar um Booking, mas não deve marcar automaticamente uma contratação como confirmada. |
| :---- |

Estados iniciais sugeridos para EventApplication: PENDING, ACCEPTED, REJECTED e WITHDRAWN. Estados iniciais sugeridos para Event: DRAFT, OPEN, CLOSED, COMPLETED e CANCELLED. A transição de estado deve ser validada no servidor e registrada de modo consistente.

## **4.8 Abstração Artist: decisão técnica a validar**

A abstração Artist pode representar tanto MusicianProfile quanto Band para operações compartilhadas, como busca, candidatura, contratação, rider e performance. Ela é útil se reduzir duplicação real em vários módulos. Uma implementação possível é um registro Artist associado a exatamente um MusicianProfile ou uma Band.

Se essa abordagem for adotada com musicianProfileId e bandId opcionais, deve existir uma constraint que garanta que exatamente um deles esteja preenchido, além de unicidade nas associações. Outra alternativa é manter referências separadas em cada entidade consumidora, com validação equivalente. Evitar um campo “tipo \+ id” polimórfico sem chaves estrangeiras e integridade referencial.

| RECOMENDAÇÃO Não criar Artist apenas para “deixar genérico”. Validar se a mesma referência simplifica pelo menos os módulos de marketplace, candidaturas e bookings. Se sim, adotar como conceito central desde cedo; se não, manter a distinção entre MusicianProfile e Band e evitar refatoração especulativa. |
| :---- |

## **4.9 Rider técnico e comparação de compatibilidade**

O rider deve pertencer ao artista ou à banda como identidade profissional, não a cada integrante individual dentro da banda. Se Artist for adotado, TechnicalRider pode referenciá-lo. Caso contrário, a tabela deve manter referências explícitas e mutuamente exclusivas ao MusicianProfile ou à Band, protegidas por constraint. RiderItem pertence ao TechnicalRider e registra item/equipamento, quantidade, categoria e observações.

O cadastro da estrutura técnica da casa de show faz parte do MVP e deve ser separado do rider artístico, por exemplo em VenueEquipmentItem vinculado à Organization do tipo VENUE. O MVP deve executar automaticamente, sob demanda, uma comparação básica e determinística entre RiderItem e VenueEquipmentItem, considerando a identificação catalogada do item e as quantidades necessárias/disponíveis. O resultado de cada item será COMPATÍVEL, PARCIALMENTE\_DISPONÍVEL ou INDISPONÍVEL. RiderCompatibilityService calcula o resultado quando o artista/banda consulta a compatibilidade com uma casa de show; não é obrigatório persistir uma entidade genérica de compatibilidade.

A identificação dos itens deve usar um catálogo ou identificadores consistentes, não apenas textos livres. No MVP, comparar somente itens com correspondência explícita; não presumir que equipamentos diferentes sejam substitutos. Disponibilidade igual ou superior à necessidade indica COMPATÍVEL; quantidade positiva inferior indica PARCIALMENTE\_DISPONÍVEL; item ausente do inventário ou quantidade zero indica INDISPONÍVEL. A tela deve apresentar quantidade necessária, quantidade disponível e motivo do resultado.

Sugestões automáticas de substituição, recomendações de ajustes, análise de equivalência entre equipamentos e otimização inteligente permanecem no backlog. O resultado básico deve explicar quais itens foram atendidos e quais apresentam diferença de quantidade ou ausência.

## **4.10 Oportunidades culturais e comparação de requisitos**

CulturalOpportunity e OpportunityRequirement devem registrar o conteúdo essencial da oportunidade e sua origem. O link para a publicação oficial deve permanecer visível para conferência. No MVP, os requisitos serão cadastrados de forma estruturada e comparados automaticamente, sob demanda, com informações do perfil profissional por regras explícitas. OpportunityEligibilityService executa essa avaliação sem exigir uma entidade genérica de compatibilidade ou interpretação automática de documentos.

Estados sugeridos para cada requisito: ATENDIDO, NÃO\_ATENDIDO, NÃO\_INFORMADO e VERIFICAÇÃO\_NECESSÁRIA. A interface deve mostrar o motivo do resultado. Ausência de informação não significa descumprimento, e a comparação não garante elegibilidade jurídica nem substitui a leitura do edital original. Extração de PDF, análise documental automática e recomendação inteligente permanecem no backlog.

Os requisitos objetivos devem apontar para campos conhecidos do perfil e utilizar operadores claros (por exemplo, igualdade, lista permitida, valor mínimo ou presença de informação). Critérios subjetivos, documentais ou jurídicos devem ser marcados para VERIFICAÇÃO\_NECESSÁRIA, em vez de receber uma classificação automática sem base suficiente. A comparação deve exibir o requisito, o dado do perfil considerado e a justificativa do resultado; não representa garantia de elegibilidade.

# **5\. Módulos funcionais e fluxos principais**

## **5.1 Identidade e acesso**

Responsável por cadastro, autenticação, recuperação de acesso e associação do usuário aos perfis, bandas e organizações. O acesso a recursos deve ser verificado com base na propriedade do recurso e nos vínculos de membership, não em um único papel armazenado no usuário.

## **5.2 Perfil individual, banda e portfólio**

O perfil individual apresenta o músico; a banda apresenta o grupo. Ambos podem ter campos e seções semelhantes, mas cada entidade deve possuir seus próprios dados e ciclo de edição. O portfólio deve permitir organizar materiais de apresentação — por exemplo, descrição, imagens, links de áudio/vídeo e materiais externos — conforme as decisões de escopo e armazenamento.

## **5.3 Marketplace de artistas**

O marketplace deve listar artistas e bandas com informações públicas relevantes e permitir busca por nome, estilo musical, localização e características de apresentação. A busca não deve exigir que o contratante conheça previamente o nome do artista. Perfis públicos precisam respeitar a configuração de visibilidade e não expor dados privados de conta.

## **5.4 Oportunidades de apresentação**

A casa de show cria uma publicação com inscrições abertas, define prazo, vagas e informações da apresentação. Artistas e bandas podem consultar os detalhes e enviar candidatura. A casa acompanha as candidaturas e seleciona ou rejeita. A seleção pode iniciar uma negociação no módulo de Booking.

## **5.5 Contratação e negociação**

Uma negociação pode começar de duas maneiras: (a) a casa encontra um artista no marketplace e envia uma proposta direta; ou (b) a casa seleciona uma candidatura de evento e inicia uma negociação vinculada à oportunidade. Booking centraliza as ofertas, contrapropostas, mensagens e o estado da contratação. Não há fluxo de pagamento dentro da plataforma.

## **5.6 Apresentações e agenda**

Performance representa a realização da apresentação. O dashboard pode apresentar próximas apresentações já confirmadas e um histórico básico. Agenda avançada, disponibilidade recorrente, conflitos de datas e gestão de calendário compartilhado podem ser adiados se ameaçarem o prazo do MVP.

## **5.7 Oportunidades culturais**

A área de oportunidades culturais deve funcionar como catálogo consultável, com filtros básicos, requisitos estruturados e acesso à fonte original. No MVP, OpportunityEligibilityService executa automaticamente, sob demanda, a comparação de requisitos objetivos com informações disponíveis no perfil e apresenta ATENDIDO, NÃO\_ATENDIDO, NÃO\_INFORMADO ou VERIFICAÇÃO\_NECESSÁRIA, sempre com justificativa. Não confundir esse fluxo com eventos de casas de show: um evento com vagas busca atrações para uma programação; um edital ou chamamento pode selecionar projetos, oferecer financiamento ou estabelecer outra modalidade de participação.

## **5.8 Riders e compatibilidade técnica**

O módulo mantém riders independentes de músicos e bandas e o inventário de equipamentos das casas de show. RiderCompatibilityService executa automaticamente, sob demanda, a comparação dos itens e quantidades necessários com os recursos cadastrados pelo estabelecimento e apresenta COMPATÍVEL, PARCIALMENTE\_DISPONÍVEL ou INDISPONÍVEL, com as quantidades consideradas e a justificativa. A comparação é determinística e explicável; recomendações de substituição e análise inteligente ficam para versões futuras.

# **6\. Histórias de usuário e critérios de aceitação**

As histórias abaixo descrevem o comportamento esperado no MVP. Elas podem ser convertidas em tarefas de desenvolvimento e testes. Os critérios são mínimos e devem ser refinados durante a prototipação.

## **6.1 Conta e perfil profissional**

| ID / história | Critérios de aceitação essenciais | Prioridade |
| :---- | :---- | :---- |
| US-01 — Como visitante, quero explorar o marketplace sem criar conta, para conhecer artistas e oportunidades. | Páginas públicas carregam sem autenticação; ações privadas solicitam login; dados privados não são exibidos. | P0 |
| US-02 — Como pessoa, quero criar uma conta e acessar a plataforma. | Cadastro valida dados obrigatórios; credenciais são protegidas; login e logout funcionam; erros são apresentados claramente. | P0 |
| US-03 — Como usuário, quero criar meu perfil profissional individual. | O perfil fica associado à conta; campos essenciais podem ser editados; perfil pode ser exibido publicamente conforme a regra de visibilidade. | P0 |
| US-04 — Como artista, quero montar meu portfólio. | Posso adicionar e remover materiais/links; a visualização pública reflete as alterações autorizadas; links inválidos são tratados. | P0 |
| US-05 — Como artista, quero cadastrar e atualizar meu rider técnico. | Posso adicionar itens e quantidades; o rider é associado ao meu perfil; alterações não afetam riders de outras entidades. | P0 |

## **6.2 Bandas e integrantes**

| ID / história | Critérios de aceitação essenciais | Prioridade |
| :---- | :---- | :---- |
| US-06 — Como músico, quero criar uma banda com identidade própria. | A banda possui nome e perfil próprios; o criador recebe vínculo de OWNER; as regras sobre perfil individual são aplicadas conforme decisão validada. | P0 |
| US-07 — Como administrador de banda, quero convidar músicos cadastrados. | O convite identifica a pessoa; o convidado pode aceitar ou recusar; o vínculo só fica ativo após aceitação. | P0 |
| US-08 — Como OWNER/ADMIN, quero gerenciar integrantes e permissões. | OWNER e ADMIN podem executar ações autorizadas; MEMBER não pode administrar a banda; não é possível remover o último responsável sem transferência válida. | P0 |
| US-09 — Como banda, quero manter portfólio e rider próprios. | Os materiais e itens do rider pertencem à banda; mudanças no perfil individual de um integrante não sobrescrevem os dados coletivos. | P0 |

## **6.3 Casa de show, eventos e candidaturas**

| ID / história | Critérios de aceitação essenciais | Prioridade |
| :---- | :---- | :---- |
| US-10 — Como responsável por uma casa de show, quero cadastrar o estabelecimento. | A organização tem perfil próprio; o criador recebe OWNER; endereço e contatos podem ser atualizados por usuários autorizados. | P0 |
| US-11 — Como casa de show, quero publicar um evento com vagas. | A publicação inclui informações da apresentação, prazo e quantidade de vagas; somente organizações autorizadas publicam; rascunhos não aparecem publicamente. | P0 |
| US-12 — Como artista/banda, quero descobrir oportunidades de apresentação. | Consigo listar oportunidades abertas e consultar seus detalhes; publicações encerradas não aparecem como inscrições abertas. | P0 |
| US-13 — Como artista/banda, quero enviar uma candidatura. | A candidatura identifica o artista e o evento; não há duplicidade ativa; o usuário consegue acompanhar o estado e retirar a candidatura conforme a regra definida. | P0 |
| US-14 — Como casa de show, quero analisar candidaturas. | Usuários autorizados visualizam candidaturas do evento; podem aceitar ou rejeitar; a mudança de estado fica registrada. | P0 |
| US-15 — Como casa de show, quero iniciar uma negociação com um candidato selecionado. | A partir da seleção, o sistema permite iniciar Booking; a candidatura continua registrada; a contratação não é marcada como confirmada automaticamente. | P0 |

## **6.4 Marketplace, propostas e apresentações**

| ID / história | Critérios de aceitação essenciais | Prioridade |
| :---- | :---- | :---- |
| US-16 — Como casa de show, quero buscar artistas e bandas. | A busca permite critérios básicos como nome, estilo e localização; os resultados respeitam visibilidade e filtros escolhidos. | P0 |
| US-17 — Como casa de show, quero enviar proposta direta a um artista. | A proposta cria uma negociação independente de EventApplication; o destinatário é identificado; o estado inicial fica pendente. | P0 |
| US-18 — Como artista/banda, quero responder a propostas e contrapropostas. | Consigo aceitar, recusar ou enviar contraproposta; o histórico das ofertas permanece disponível; somente participantes autorizados interagem. | P0 |
| US-19 — Como participantes de uma negociação, queremos trocar mensagens. | Mensagens ficam vinculadas ao Booking; apenas participantes autorizados acessam; a ordem e autoria são preservadas. | P0 |
| US-20 — Como artista/banda, quero acompanhar apresentações confirmadas e realizadas. | O sistema distingue booking confirmado de performance realizada; o histórico não altera o estado de pagamento, que é externo. | P1 |

## **6.5 Oportunidades culturais e dashboard**

| ID / história | Critérios de aceitação essenciais | Prioridade |
| :---- | :---- | :---- |
| US-21 — Como artista, quero consultar oportunidades culturais. | Consigo visualizar descrição, instituição, prazo, localidade, requisitos e link para fonte original quando disponíveis. | P0 |
| US-22 — Como artista, quero compreender quais informações são exigidas por uma oportunidade. | Requisitos aparecem como publicados pela fonte; informações não cadastradas não são rotuladas automaticamente como não atendidas. | P0 |
| US-23 — Como artista, quero visualizar um resumo das minhas atividades. | Dashboard mostra atalhos e estados úteis, como propostas, candidaturas e oportunidades recentes, sem exigir gráficos avançados. | P1 |
| US-24 — Como artista, quero visualizar próximos compromissos. | São exibidas apresentações confirmadas; eventos apenas publicados ou candidaturas pendentes não são apresentados como compromissos confirmados. | P1 |

## **6.6 Riders e cruzamentos básicos**

As histórias desta seção descrevem as comparações simplificadas incluídas no MVP: compatibilidade entre rider e estrutura técnica, e avaliação dos requisitos estruturados de oportunidades culturais.

| ID / história | Critérios de aceitação essenciais | Prioridade |
| :---- | :---- | :---- |
| US-25 — Como casa de show, quero cadastrar os equipamentos e quantidades disponíveis no meu espaço. | Consigo incluir, editar e remover itens do inventário técnico; cada item pertence à casa de show; o inventário não altera os riders de artistas ou bandas. | P0 |
| US-26 — Como artista/banda, quero comparar meu rider com a estrutura de uma casa de show. | Ao solicitar a comparação, o sistema calcula automaticamente os resultados por item e quantidade; cada resultado indica COMPATÍVEL, PARCIALMENTE\_DISPONÍVEL ou INDISPONÍVEL; a tela explica quantidade necessária, quantidade disponível e diferenças; não são sugeridas substituições automaticamente. | P0 |
| US-27 — Como responsável autorizado pelo catálogo da plataforma, quero cadastrar requisitos de oportunidades de forma estruturada. | Cada requisito tem descrição, tipo/critério e regra de avaliação compatível com os dados disponíveis; a fonte original da oportunidade é preservada. | P0 |
| US-28 — Como artista/banda, quero comparar meu perfil com os requisitos de uma oportunidade cultural. | Ao solicitar a análise, o sistema compara automaticamente cada requisito estruturado com os dados disponíveis do perfil; cada requisito recebe ATENDIDO, NÃO\_ATENDIDO, NÃO\_INFORMADO ou VERIFICAÇÃO\_NECESSÁRIA, com justificativa; ausência de dado não é tratada como reprovação; o sistema não garante elegibilidade. | P0 |

# **7\. Fluxo de desenvolvimento recomendado**

## **7.1 Estratégia geral**

Recomenda-se desenvolver o MVP em fatias verticais pequenas, depois de uma fundação mínima comum. Cada fatia deve atravessar interface, caso de uso, domínio, persistência e autorização, evitando construir primeiro uma grande camada de telas ou um banco inteiro sem validar os fluxos.

| REGRA DE EXECUÇÃO Prototipe o fluxo, valide os dados necessários na tela, modele as entidades mínimas, implemente o caso de uso ponta a ponta e teste permissões e estados. Só então amplie o próximo fluxo. |
| :---- |

## **7.2 Sequência sugerida**

| Etapa | Entregas | Condição para avançar |
| :---- | :---- | :---- |
| 0\. Descoberta e prototipação | Mapas de navegação; protótipos das telas principais; definição dos campos obrigatórios; decisões pendentes priorizadas. | As duas personas conseguem completar seus fluxos principais no protótipo sem ambiguidades críticas. |
| 1\. Fundação técnica | Estrutura do projeto; ambientes; autenticação; migrações; tratamento de erros; estratégia de arquivos; testes básicos. | Cadastro, login, autorização básica e persistência funcionando. |
| 2\. Perfil individual | Criação/edição de MusicianProfile; visibilidade pública; portfólio básico. | Um músico consegue criar e publicar um perfil consistente. |
| 3\. Banda e memberships | Band; BandMember; convites; OWNER/ADMIN/MEMBER; perfil coletivo. | Uma pessoa consegue administrar uma banda sem compartilhar automaticamente dados individuais. |
| 4\. Organização/casa de show | Organization do tipo VENUE; OrganizationMember; perfil do estabelecimento. | Responsáveis conseguem manter o perfil e operar em nome da organização. |
| 5\. Marketplace | Listagem pública; detalhe de perfil; busca e filtros essenciais. | Visitante/contratante encontra e consulta um artista respeitando visibilidade. |
| 6\. Riders e estrutura técnica | TechnicalRider, RiderItem e VenueEquipmentItem; associação correta a artista/banda e casa de show; tela/serviço de comparação básica por item e quantidade. | Riders permanecem independentes; a comparação retorna estados explicáveis e trata itens ausentes/quantidades insuficientes. |
| 7\. Eventos e candidaturas | Publicação de evento; listagem de oportunidades; EventApplication; análise e seleção. | O ciclo de candidatura funciona com estados e permissões corretos. |
| 8\. Booking e negociação | Proposta direta; criação a partir de candidatura; ofertas; mensagens; aceitação/recusa. | Os dois caminhos de contratação convergem para o mesmo processo de negociação. |
| 9\. Oportunidades culturais e cruzamento de requisitos | Cadastro/consulta; fonte original; OpportunityRequirement estruturado; serviço de comparação básica com dados do perfil. | O artista visualiza o resultado por requisito, a justificativa e os casos que exigem conferência humana. |
| 10\. Painel e acabamento | Dashboard simples; histórico/agenda básica se couber; responsividade; acessibilidade; testes de regressão. | Fluxos P0 estão estáveis e a aplicação está pronta para demonstração. |

## **7.3 Fluxos ponta a ponta que devem ser testados**

**1\.** Artista: criar conta → criar perfil → publicar portfólio → cadastrar rider → aparecer no marketplace.

**2\.** Banda: músico cria banda → convida integrante → integrante aceita → banda atualiza perfil e rider coletivo.

**3\.** Casa: responsável cria organização → publica evento com vagas → recebe candidatura → seleciona artista → inicia Booking.

**4\.** Contratação direta: casa pesquisa marketplace → abre perfil → envia proposta → artista contrapropõe → partes confirmam contratação.

5\. Oportunidade cultural: artista abre oportunidade → consulta requisitos estruturados → compara com o perfil → verifica atendido, não atendido, não informado e itens que exigem conferência → acessa a fonte oficial.

6\. Rider: artista/banda mantém rider → casa cadastra equipamentos e quantidades → artista seleciona o espaço → sistema compara necessidades e disponibilidade → apresenta itens compatíveis, parciais ou indisponíveis.

## **7.4 Estratégia de testes**

Priorizar testes de regras que, se falharem, expõem dados, criam contratações indevidas ou produzem avaliações incorretas: autorização por membership; unicidade de candidatura; transições válidas de estado; integridade entre Artist e seus tipos concretos, caso adotado; separação entre rider individual e coletivo; comparação de itens/quantidades com limites e ausência de equipamentos; classificação de requisitos culturais, especialmente NÃO\_INFORMADO e VERIFICAÇÃO\_NECESSÁRIA; e distinção entre booking confirmado e performance realizada.

# **8\. Prioridades e entregas do MVP**

## **8.1 Matriz de prioridade**

| Prioridade | Itens | Orientação |
| :---- | :---- | :---- |
| P0 — Essencial para validar a proposta | Autenticação; perfil individual; banda e integrantes; casa de show; marketplace básico; portfólio; rider; inventário técnico da casa e comparação básica de riders; publicação de eventos; candidaturas; análise; propostas e negociação; oportunidades culturais; requisitos estruturados e comparação básica com perfis. | Implementar antes de ampliar o escopo. Os dois cruzamentos básicos fazem parte do valor central do MVP e devem funcionar com regras explícitas e resultados explicáveis. |
| P1 — Importante, mas simplificável | Dashboard com resumo; histórico de apresentações; agenda básica; notificações essenciais; filtros adicionais; refinamentos do cadastro técnico e da apresentação dos resultados de comparação. | Implementar depois de estabilizar os fluxos P0 e somente na profundidade necessária à demonstração e uso. |
| P2 — Evolução posterior | Persona de produtor/agência/festival; recomendações automáticas de artistas; substituição inteligente de equipamentos; otimização avançada de riders; extração/interpretação de PDFs; análise documental automatizada; recomendação inteligente de editais; IA; estatísticas avançadas; gestão avançada de programação; pagamentos. | Manter no backlog. Não antecipar inteligência, automação documental ou mecanismos de recomendação que não sejam necessários para as comparações básicas do MVP. |

## **8.2 Ordem de prioridade funcional**

**1\.** Primeiro, garantir a identidade profissional: usuário, perfil individual e banda.

**2\.** Em seguida, habilitar o lado contratante: organização/casa de show e seus responsáveis.

**3\.** Construir a descoberta pública: marketplace e perfis.

4\. Adicionar os materiais profissionais: portfólio, rider do artista/banda e inventário técnico da casa; implementar a comparação básica entre necessidades e disponibilidade.

**5\.** Implementar a via ativa de oportunidade: evento, candidatura e seleção.

**6\.** Implementar a via direta: proposta no marketplace e negociação.

7\. Disponibilizar catálogo de oportunidades culturais com requisitos estruturados e comparação básica com os dados do perfil.

**8\.** Finalizar com dashboard e histórico apenas na medida em que os fluxos centrais estejam estáveis.

## **8.3 Critério para cortar escopo**

Quando o prazo apertar, cortar profundidade antes de cortar a coerência do fluxo. Preservar as comparações automáticas básicas de riders e editais, reduzindo inicialmente a variedade de categorias de equipamentos e tipos de requisitos suportados, em vez de remover essas entregas. Manter regras determinísticas, resultados explicáveis e tratamento explícito de dados ausentes; deixar para depois sugestões de substituição, interpretação automática de PDFs e recomendações inteligentes.

# **9\. Cuidados arquiteturais e prevenção de retrabalho**

## **9.1 Evitar papel global em User**

Não criar User.type \= ARTIST ou VENUE como regra central. Uma pessoa pode ser músico, integrante de várias bandas e administradora de uma ou mais casas de show. Use relações explícitas com MusicianProfile, BandMember e OrganizationMember. As permissões derivam dessas relações e do papel dentro de cada entidade.

## **9.2 Não confundir entidade com tela ou persona**

Band não deve virar Organization apenas porque possui administradores; Event não deve virar Booking porque ambos envolvem apresentações; Artist não deve ser criado sem comportamento compartilhado real. Modele conceitos de domínio e seus ciclos de vida, não apenas agrupamentos visuais da interface.

## **9.3 Separar candidatura, negociação, contratação e realização**

| Conceito | O que significa | O que não significa |
| :---- | :---- | :---- |
| EventApplication aceita | A candidatura foi selecionada para avançar. | Não confirma automaticamente cachê ou contratação. |
| Booking confirmado | As partes chegaram a um acordo. | Não prova que a apresentação ocorreu nem que houve pagamento. |
| Performance realizada | A apresentação foi registrada como ocorrida. | Não prova que o pagamento foi efetuado. |
| Pagamento | Liquidação financeira entre as partes fora da plataforma. | Não é um estado operacional gerido pelo MVP. |

## **9.4 Não acoplar Event a Venue**

Mesmo que apenas casas de show publiquem eventos no MVP, manter organizerId separado de venueId. Evitar tabelas específicas como VenueEvent ou regras que obriguem que organizador e local sejam sempre a mesma organização. A interface restringe os casos atuais; a arquitetura preserva a distinção de domínio.

## **9.5 Integridade no banco, não apenas na interface**

* Criar unicidade para e-mails/identificadores aplicáveis e para memberships ativos conforme a regra do domínio.  
* Impedir duplicidade de candidatura para o mesmo artista e evento.  
* Garantir exatamente uma origem de Artist, se essa abstração for adotada.  
* Garantir que uma banda tenha responsável válido e que a remoção/transferência do último OWNER seja tratada.  
* Verificar que apenas membros autorizados editem a banda ou a organização.  
* Validar transições de estados no servidor, sem confiar em valores enviados pelo cliente.

## **9.6 Permissões simples e explícitas**

No MVP, usar OWNER, ADMIN e MEMBER para bandas; OWNER e ADMIN para casas de show. Documentar o que cada papel pode fazer. Não criar um mecanismo de permissões configurável por recurso, campo ou ação até que exista uma necessidade concreta. A autorização deve ocorrer no backend e considerar o vínculo com a entidade específica.

## **9.7 Preservar histórico de negociação**

Não sobrescrever a proposta anterior quando houver contraproposta. BookingOffer deve permitir reconstruir as condições discutidas e identificar quem enviou, quando e qual foi a resposta. Mensagens devem permanecer associadas à negociação. A confirmação deve ser uma transição explícita e auditável.

## **9.8 Tratar estados e prazos de forma consistente**

Definir claramente o que significa prazo encerrado, evento cancelado, candidatura retirada e contratação confirmada. A interface não deve apresentar evento com inscrições fechadas como oportunidade aberta. Armazenar datas de forma consistente e exibir o fuso esperado para o contexto local. Se houver alteração de data ou prazo, preservar o estado e comunicar a mudança aos envolvidos.

## **9.9 Separar informação pública e privada**

Perfil público deve mostrar apenas dados destinados à divulgação. Credenciais, contatos pessoais privados, convites pendentes e mensagens não devem ser expostos em consultas públicas. A visibilidade deve ser aplicada nas consultas e no backend, não apenas ocultada visualmente.

## **9.10 Evitar abstrações especulativas**

Não criar agora um motor universal de contratação, motor de workflow, marketplace genérico de qualquer serviço, sistema de permissões dinâmico ou arquitetura de microserviços. Criar apenas as extensões previsíveis: Organization com tipo; Event com organizador separado do local; memberships; e distinção entre Artist, Booking e Performance quando justificadas pelo fluxo.

## **9.11 Arquivos, mídia e links**

Definir cedo como imagens, documentos e materiais de portfólio serão armazenados, validados e exibidos. Não guardar arquivos grandes diretamente em campos de texto do banco. Registrar metadados e referências de armazenamento, limitar tipos e tamanhos, validar links e prever remoção ou substituição de arquivos. A escolha da infraestrutura pode variar, mas a regra de domínio não deve depender de um provedor específico.

## **9.12 Não confundir “não informado” com “não atende”**

Em oportunidades culturais, requisitos podem depender de documentos ou dados que o artista ainda não cadastrou. O cruzamento básico do MVP deve distinguir: ATENDIDO, quando os dados conhecidos satisfazem o critério; NÃO\_ATENDIDO, quando há informação conhecida que o contradiz; NÃO\_INFORMADO, quando faltam dados; e VERIFICAÇÃO\_NECESSÁRIA, quando depende de documento, interpretação ou confirmação humana. Mostrar o motivo de cada estado e manter o link para a fonte oficial. A avaliação não garante elegibilidade.

## **9.13 Evitar complexidade prematura de agenda**

Não construir calendário completo com recorrências, disponibilidade avançada, reservas de horários e conflitos antes de validar a necessidade. Para o MVP, listar candidaturas e apresentações confirmadas pode ser suficiente. Uma oportunidade publicada não é um compromisso do artista.

## **9.14 Manter as comparações básicas determinísticas e explicáveis**

Os cruzamentos automáticos básicos de riders e requisitos culturais devem ser implementados como regras de domínio específicas de cada módulo, e não como um motor genérico de compatibilidade. As comparações são executadas sob demanda e seus resultados precisam ser reproduzíveis a partir dos dados cadastrados, indicar quais campos/itens foram considerados e explicar diferenças ou ausência de informação. Não inferir equivalência entre equipamentos sem regra explícita, nem elegibilidade jurídica a partir de dados incompletos. A consulta seguinte deve refletir alterações recentes nos dados; caso seja necessário preservar uma avaliação histórica vinculada a uma contratação ou inscrição, essa necessidade deve ser modelada explicitamente depois.

# **10\. Decisões pendentes e validações**

Os itens abaixo não devem ser tratados como decisões fechadas. É recomendável resolvê-los antes de cristalizar o esquema do banco ou concluir os protótipos de maior fidelidade.

| Questão em aberto | Impacto | Recomendação para decidir |
| :---- | :---- | :---- |
| O criador de uma banda precisa ter perfil individual? | Afeta o fluxo de criação, a relação User–Band e a elegibilidade do OWNER. | Recomendação atual: exigir perfil individual, desde que isso não crie barreira desnecessária para o MVP. Validar com o fluxo de interface. |
| Todo evento do MVP precisa abrir candidaturas? | Define se Event representa sempre oportunidade ou também evento meramente informativo. | Para simplificar, começar com eventos publicados como oportunidades com vagas. Deixar eventos sem candidatura para evolução futura. |
| Adotar Artist como entidade própria? | Afeta marketplace, EventApplication, Booking, Performance e TechnicalRider. | Decidir após mapear as operações compartilhadas; se adotada, estabelecer constraint de exatamente um subtipo. |
| Uma banda pode receber candidatura/proposta enquanto está sem perfil público completo? | Afeta validação e qualidade do marketplace. | Definir um conjunto mínimo de campos obrigatórios para publicação e candidatura. |
| Como funcionam convites de integrantes? | Afeta onboarding e segurança. | Definir se convite será feito por usuário já cadastrado, e-mail ou ambos; evitar criar mecanismo amplo de convite para qualquer entidade agora. |
| Qual profundidade terá a agenda no MVP? | Pode aumentar significativamente o escopo. | Priorizar lista de apresentações confirmadas e histórico simples; não construir calendário complexo sem necessidade. |
| Qual será o nível de detalhamento do inventário técnico da casa? | Define quais equipamentos, categorias e unidades serão suportados pela comparação básica. | Cadastrar item, categoria, quantidade e observações; incluir comparação determinística no MVP e ampliar o catálogo conforme uso real. |
| Quais tipos de requisito cultural serão comparados inicialmente? | Define quais campos do perfil serão utilizados e quais critérios exigem verificação humana. | Começar por requisitos objetivos que possam ser comparados com dados existentes do perfil; classificar o restante como VERIFICAÇÃO\_NECESSÁRIA. |
| A comparação precisa manter histórico de resultados? | Pode exigir persistência de snapshots quando os dados do perfil, rider ou estrutura mudarem. | No MVP, calcular sob demanda e não persistir resultados genéricos. Preservar snapshots somente se um fluxo concreto exigir auditoria histórica. |

# **11\. Critérios de conclusão do MVP**

O MVP estará coerente com a proposta quando os fluxos abaixo puderem ser demonstrados sem depender de operações manuais fora do sistema, exceto pelo pagamento, que é explicitamente externo:

* Uma pessoa cria uma conta e constrói um perfil profissional individual.  
* Um músico consegue criar uma banda, convidar integrantes e manter perfil, portfólio e rider coletivos.  
* Uma casa de show consegue cadastrar seu estabelecimento e publicar uma oportunidade de apresentação.  
* Um artista ou banda consegue encontrar a oportunidade, candidatar-se e acompanhar o resultado.  
* A casa de show consegue analisar candidaturas e iniciar uma negociação.  
* A casa de show também consegue encontrar um artista pelo marketplace e enviar uma proposta direta.  
* Os participantes conseguem negociar por ofertas e mensagens, registrar a confirmação da contratação e manter o acesso restrito aos usuários autorizados.  
* O sistema distingue contratação confirmada de apresentação realizada e não controla pagamentos.  
* O artista consegue consultar oportunidades culturais e abrir a fonte original.  
* A casa de show consegue cadastrar os equipamentos e quantidades disponíveis, e o artista/banda consegue comparar seu rider com essa estrutura, visualizando itens compatíveis, parcialmente disponíveis ou indisponíveis.  
* O artista/banda consegue comparar seus dados com requisitos estruturados de uma oportunidade cultural, visualizar o resultado e entender quais requisitos precisam de informação adicional ou conferência humana.

| DEFINITION OF DONE Uma funcionalidade só deve ser considerada concluída quando o fluxo feliz, os estados alternativos relevantes, as permissões, a validação de dados, os estados vazios/erro e os testes essenciais estiverem cobertos. A tela isolada não é uma entrega funcional. |
| :---- |

# **12\. Glossário**

| Termo | Definição neste projeto |
| :---- | :---- |
| Artista | Identidade profissional contratável; pode ser um músico individual ou uma banda. A abstração técnica Artist ainda depende de decisão. |
| MusicianProfile | Perfil profissional individual ligado à conta de uma pessoa. |
| Band | Grupo musical com identidade, portfólio e rider próprios. |
| Organization | Organização contratante ou estabelecimento; no MVP, utilizada como casa de show/espaço cultural. |
| Event | Publicação de evento com oportunidade de apresentação no escopo inicial. |
| EventApplication | Candidatura de artista ou banda a um evento. |
| Booking | Processo de negociação ou acordo comercial entre contratante e artista. |
| Performance | Registro da apresentação efetivamente realizada. |
| TechnicalRider | Documento/estrutura de necessidades técnicas de uma identidade artística. |
| Oportunidade cultural | Edital, chamamento, residência, seleção ou oportunidade de financiamento. |
| MVP | Versão mínima capaz de validar os fluxos centrais do produto com escopo controlado. |
| VenueEquipmentItem | Item e quantidade de equipamento/recurso técnico cadastrados como disponíveis em uma casa de show. |
| RiderCompatibilityService | Serviço de domínio que compara, por regras explícitas, RiderItem com VenueEquipmentItem e retorna compatibilidade, disponibilidade parcial ou indisponibilidade. |
| OpportunityEligibilityService | Serviço de domínio que compara requisitos estruturados de uma oportunidade cultural com informações do perfil e retorna estados explicáveis, sem garantir elegibilidade. |
| Zod | Biblioteca de validação de dados recomendada para validar entradas da API no backend TypeScript. |
| Monólito modular | Uma aplicação única organizada em módulos de domínio, com fronteiras internas claras, sem implantação de serviços independentes no MVP. |

# **Encerramento**

| DIRETRIZ FINAL / Construir primeiro uma experiência útil e completa para músicos/bandas e casas de show. Adotar um backend em monólito modular, com stack simples e consistente (NestJS, TypeScript, PostgreSQL e Prisma), e incluir no MVP comparações básicas e determinísticas de riders e requisitos culturais. Manter fora do escopo a inteligência avançada, a interpretação automática de documentos, as recomendações complexas, a expansão de personas e os pagamentos. A melhor proteção contra retrabalho é separar corretamente os conceitos, preservar a integridade dos dados e validar cada decisão a partir do fluxo real da interface. |
| :---- |

