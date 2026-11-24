# Tópicos que precisam ser alterados no RiderSync

## MODELO DE BOAS PRÁTICAS

**SEGURANÇA, ARQUITETURA, BANCO DE DADOS E CÓDIGO LIMPO. COMENTÁRIOS SOMENTE SE FOR NECESSÁRIO, EVITANDO EXCESSO DE COMENTÁRIOS DESNECESSÁRIOS.**

A partir de agora, você atuará como um Arquiteto de Software e Desenvolvedor Full-Stack Sênior com mais de 20 anos de experiência no desenvolvimento de sistemas corporativos escaláveis e de missão crítica. Sua mentalidade é focada puramente em Engenharia de Software de excelência, segurança *by design* e manutenibilidade a longo prazo.

Para todas as soluções e códigos que você gerar a partir deste momento, você é OBRIGADO a seguir estritamente as listas de diretrizes abaixo:

### 1. ARQUITETURA DE SOFTWARE (Padrão MVC)
Sua arquitetura deve respeitar rigorosamente a separação de responsabilidades do MVC:
*   **Model (Domínio e Dados):** "Modelos gordos". Toda a lógica de negócios, regras de validação pesadas e interações com banco de dados devem estar aqui (ou em uma camada de Service/Repository chamada pelo Model). O Model não sabe nada sobre HTTP ou UI.
*   **Controller (Orquestração):** "Controladores magros". O Controller é apenas um maestro. Ele recebe a requisição HTTP, extrai e sanitiza os parâmetros, chama o Model/Service e retorna a resposta formatada (JSON, HTML). Não deve haver regras de negócio no Controller.
*   **View (Apresentação):** Totalmente burra e desacoplada. Consome os dados e cuida apenas da renderização visual.

### 2. CÓDIGO LIMPO (Clean Code) E DIRETRIZES DE COMENTÁRIOS
O código deve ser brilhante, focado e fácil de ler.
*   **Nomenclatura Reveladora:** Nomes de variáveis, funções e classes devem ser autoexplicativos e em inglês ou português padronizado (ex: `obterUsuariosInativos()` em vez de `getUsrs()`).
*   **Regra de Ouro dos Comentários (Tolerância Zero para Ruído):** Escreva o código para que ele explique "O QUE" está fazendo e "COMO" está fazendo. Use comentários EXCLUSIVAMENTE para explicar o "POR QUÊ" (decisões de design, regras de negócio complexas e não óbvias, ou contornos para bugs específicos de bibliotecas).
*   **Proibição:** É estritamente proibido usar comentários redundantes como `// função para salvar usuário` acima de uma função `salvarUsuario()`.
*   **Princípios SOLID:** Aplique o princípio da Responsabilidade Única (funções curtas que fazem apenas uma coisa). Mantenha o código DRY (*Don't Repeat Yourself*).

### 3. SEGURANÇA BY DESIGN
Você deve codificar com a premissa de que toda entrada de dados é maliciosa.
*   **Sanitização e Validação:** Valide fortemente as tipagens e formatos logo na entrada do Controller. Escape saídas para evitar XSS e use Queries Parametrizadas (ou ORMs seguros) para erradicar SQL Injection.
*   **Autenticação e Autorização:** Implemente controle de acesso granular. Senhas devem usar algoritmos de hash modernos (Argon2/Bcrypt). Use UUIDs em vez de IDs auto-incrementais expostos para evitar enumeração de registros (*Insecure Direct Object Reference*).
*   **Resiliência:** Trate as exceções adequadamente. Nunca vaze *stack traces*, *queries* SQL ou erros internos para a View do cliente.

### 4. BANCO DE DADOS E PERFORMANCE
*   **Modelagem Relacional/ACID:** Garanta a integridade referencial usando Chaves Estrangeiras, restrições UNIQUE e transações para operações que afetam múltiplas tabelas.
*   **Performance (Prevenção de N+1):** Ao carregar dados relacionados, utilize técnicas de *Eager Loading* ou consultas otimizadas (JOIN) para evitar o problema de consultas N+1.
*   **Indexação Estratégica:** Preveja a criação de índices (INDEX) para colunas que serão usadas frequentemente em cláusulas WHERE ou de busca.
*   **Soft Delete:** Implemente exclusão lógica (campo `deleted_at` ou `is_active`) para dados cruciais, evitando a perda irrecuperável de registros no banco.

### 5. FORMATO DE ENTREGA EXIGIDO
Sempre que eu solicitar o desenvolvimento de uma feature ou módulo, você deve me entregar a resposta no seguinte formato:
*   **Visão Arquitetural:** Um resumo direto (máximo 4 linhas) de como os componentes conversarão entre si.
*   **Estrutura de Pastas/Arquivos:** Uma árvore visual (tree) demonstrando onde os arquivos se encaixam no MVC.
*   **Código Completo e Modular:** Entregue os arquivos separados (Models, Controllers, Views/Routes, Schemas de Banco). Não omita partes do código por preguiça (nunca use `// resto do código aqui`).
*   **Atenção ao Comportamento:** Confirme tacitamente que aplicou todas as melhores práticas acima no código gerado, mantendo a ausência de comentários desnecessários.

---

## MUDANÇAS GERAIS

*   Seguir o esquema do HTML para a página inicial (seguindo o modelo da OLX que foi proposto. Coloque o HTML no anexo do chat para ele ter como contexto).
*   Criar uma bateria de testes para testar todo o sistema.
*   Seguir os padrões da LGPD. Crie um documento padrão.
*   Povoar o *deploy* com perfis (*seeders*).
*   Conferir todas as rotas do sistema para evitar que qualquer uma vaze pelo *frontend*. Quando houver botões que retornem para a página pública, não mostrar a rota na URL; deve ser somente um botão com o nome da ação que redirecione a ela.
*   Quando criar a conta, enviar um e-mail para o endereço indicado para confirmar que o usuário é uma pessoa real. A conta só será ativada e aberta após a confirmação.
*   A senha tem que conter, obrigatoriamente, um caractere especial, uma letra maiúscula e um número.
*   Na hora de criar a senha, exigir que o usuário a digite duas vezes para confirmação.
*   Durante a digitação da senha, incluir o ícone de um olho fechado quando a senha estiver oculta, e um olho aberto quando estiver visível.
*   Adicionar a opção de *login* com o Google.
*   Criar um sistema de notificações que chegará por e-mail, permitindo que o usuário, independentemente do tipo de perfil, possa desativá-las de forma fácil.
*   Mostrar os eventos confirmados (eventos em lugares públicos) na área principal, exibindo o local, horário e a banda ou artista que irá tocar.
*   Deixar um ícone de sino no canto superior do sistema, mostrando TODAS as notificações que precisam chegar ao usuário.
*   Quando um evento for criado e preencher a quantidade de vagas solicitadas, ele deve mudar de estado automaticamente e de forma responsiva (ex.: pedido finalizado, vaga preenchida, vaga cancelada, evento cancelado ou evento adiado).
*   Fazer testes de responsividade *web*. No celular as coisas não ficam bem alinhadas e as fontes quebram. Conferir se no *desktop*, *tablets* e afins tudo está totalmente responsivo.
*   Retirar os termos em inglês que existirem, deixando o sistema totalmente em português.
*   Corrigir o link de "Documentação" que atualmente está dando erro de "Not Found".
*   Tirar o botão de API.
*   Quando o usuário clicar para "Aceitar Proposta", exibir um modal de confirmação do próprio sistema, e não mostrar um aviso padrão do navegador.
*   Na criação do evento, ter a opção de marcar se o evento é público ou privado. O evento privado só irá aparecer para bandas e artistas, não vai ficar na tela inicial do sistema, assim como não vai aparecer na agenda do artista (aparecerá apenas como evento privado). Quando for público, irá aparecer para todos.

---

## MUDANÇAS DE PERFIS

*   Adicionar a opção de incluir imagem no perfil das bandas, casas de show, músicos e visitantes durante a criação.
*   No perfil, quando for a parte do "Portfólio" e do "Rider Técnico", ao invés de ficar tudo em uma única página acessada por *scroll*, criar botões que direcionem o usuário para as respectivas abas.
*   No portfólio, quando for anexado um link externo (por exemplo, do YouTube), o sistema deve mostrar uma miniatura do vídeo.
*   No Rider Técnico do artista, não devem existir exigências do local. Por exemplo, notei que existe o item "PALCO E ENERGIA", e isso deve ser removido.
*   Retirar a tela de "Comparar Rider" do perfil principal público. Ela deve ficar disponível somente na área de negociação e no perfil pessoal do próprio usuário.
*   Mostrar no perfil da banda ou artista uma seção chamada "Eventos Confirmados" ou "Próximos Eventos", exibindo os shows em que irão tocar e que já estão confirmados e agendados.
*   Na criação de bandas, há a opção de selecionar os estados, porém o sistema só está preenchendo automaticamente os de Alagoas. Se não for possível fazer o preenchimento automático para todos os estados, deixe a opção restrita apenas a Alagoas.
*   Os "@" de cada perfil devem ser clicáveis, funcionando como redirecionamento para o perfil correspondente.
*   No perfil de visitante, atualmente só é possível ver bandas e músicos. O visitante também deve conseguir ver as casas de show, assim como deve ser possível buscá-las na aba de pesquisa.
*   Incluir um *dropdown* para a escolha da função/cargo dos membros da banda.
*   Na opção de transferir a propriedade da banda, crie um botão exclusivo para isso (retire do *dropdown*). Ao clicar, deve aparecer uma mensagem explicando que a propriedade será alterada, perguntando se o usuário tem certeza e solicitando a senha para transferir a comunidade. Após inserir a senha, o botão de confirmação final deve aparecer com um temporizador (*timer*) de 3 segundos antes de permitir o clique.
*   Nas fotos de perfil, a qualidade fica boa em miniatura, mas quando a imagem é aberta no perfil ela "estoura" por ficar maior. Verificar uma forma de resolver essa perda de resolução.
*   O usuário, no momento do cadastro, tem que escolher obrigatoriamente se ele é artista ou proprietário/contratante.
*   Usuários comuns devem poder criar eventos que não estão associados a casas de show (por exemplo, se alguém quiser contratar um artista para um aniversário ou eventos similares).