# Reunião com o Professor (19-11)

## Correções Gerais

### Rider
> **Revisto em 23/11:** esta leitura foi desfeita — o rider é o que o artista **precisa** para tocar (ver `DECISOES_TECNICAS.md`, "Correção do conceito de rider"). Texto original mantido abaixo como histórico.

* O *rider* cadastrado na plataforma pelo artista passa a representar os equipamentos que ele já possui.
* No momento da candidatura, o artista informa o que precisa que a casa de show disponibilize (podendo selecionar manualmente ou marcar automaticamente de acordo com o que já tem cadastrado no perfil).

### Home
* Remover o botão de redirecionamento para a tela "Casas de Show", pois já existe o filtro para essa finalidade na própria *Home*.
* O campo de texto de busca deve filtrar os resultados automaticamente na tela conforme o usuário digita a pesquisa.

### Redirecionamento Geral
* Sempre que necessário, redirecionar o usuário para a nova página correspondente à ação realizada (por exemplo: ao se candidatar, redirecionar automaticamente).
* Corrigir o problema em que os eventos não são clicáveis nas telas (especialmente os eventos já fechados).

### Eventos
* Após fechar o evento, a tela dele deve exibir o evento como fechado com todas as suas informações, e deve existir um local específico no sistema para acessá-lo.
* **Evento particular no perfil:** Unificar para a criação de um evento genérico (e não apenas particular). Tanto ao criar pela aba de "Casa de Show" quanto pela de "Eventos Particulares", deve aparecer a mesma tela de criação (permitindo definir se é público ou privado).
* **Campos na criação de eventos:** Entre os campos "Requisitos" e "Condições de Apresentação", manter apenas um deles e substituir o outro por "Observações".
* **Níveis de visibilidade:** Além de "Público" e "Privado", criar a opção de **Evento Oculto**, que só poderá ser visualizado pelo próprio publicante e por quem ele convidar para tocar. Deve ser possível selecionar os artistas de interesse e enviar os convites já no momento da criação, além de permitir o envio de novos convites posteriormente.

### Negociação
* Quando a casa de show selecionar um artista para negociar, disponibilizar um botão para aceitar as exigências iniciais e já fechar o acordo diretamente, mantendo também a opção de seguir para uma negociação mais extensa (fluxo já existente).

### Avaliação
* Corrigir o fluxo de avaliação pós-evento, que atualmente não está ocorrendo.
* Quando o show for registrado como concluído, exibir um modal de avaliação e comentário para a casa de show ou contratante, e enviar a mesma solicitação para que o artista avalie a casa/contratante.
* Incluir um sistema de notas (de 0 a 5 estrelas).

### Responsividade
* Corrigir a quebra de palavras na tela de "Negociando".
