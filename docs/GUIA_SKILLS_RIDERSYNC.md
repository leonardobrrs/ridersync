# RiderSync — Guia de Skills para Claude Code

**Versão:** 1.0  
**Data:** 17/11/2026  
**Objetivo:** registrar as skills e plugins recomendados para apoiar o desenvolvimento do RiderSync com Claude Code/Claude Opus.

> **Importante sobre o status:** este guia registra o conjunto recomendado e seus procedimentos de instalação. Ele não consegue verificar quais pacotes já foram instalados no computador. Portanto, os itens abaixo são identificados como incluídos neste pacote, recomendados para instalar ou pendentes de confirmação — não como instalações já concluídas.

## 1. Skill própria do RiderSync

### `ridersync-domain`

**Status:** incluída neste pacote; precisa ser copiada para o repositório.

**Caminho no projeto:**

```text
.claude/skills/ridersync-domain/SKILL.md
```

**Finalidade:** ensinar ao Claude as regras específicas de arquitetura, domínio, permissões, riders, eventos, candidaturas e contratações do RiderSync.

A skill também registra uma decisão recente de escopo: **editais/oportunidades culturais estão adiados e não devem ser implementados no MVP atual**. Não criar tabelas, telas, rotas, APIs ou testes para CulturalOpportunity/OpportunityRequirement até que o responsável reative explicitamente essa funcionalidade.

O Claude Code descobre skills de projeto dentro de `.claude/skills/`. A skill tem um arquivo `SKILL.md` com metadados YAML `name` e `description` no início.

## 2. Skills e plugins externos recomendados

### 2.1 Frontend Design — Anthropic

**Tipo:** plugin oficial que fornece uma skill de design de interface.  
**Status:** recomendado; instalação não confirmada.

**Uso no RiderSync:** orientar decisões de UI/UX, tipografia, hierarquia, identidade visual e acabamento dos componentes React. Deve respeitar a identidade já presente nos protótipos do RiderSync, sem redesenhar arbitrariamente o produto.

**Instalação:** abra o Claude Code na raiz do repositório e execute:

```text
/plugin install frontend-design@claude-plugins-official
```

Escolha o escopo de projeto quando o instalador oferecer essa opção, caso queira compartilhar a configuração com o repositório.

**Referência:** https://claude.com/marketplace/plugins/frontend-design

### 2.2 Vercel React Best Practices

**Nome atual no catálogo:** `vercel-react-best-practices`.  
**Tipo:** Agent Skill.  
**Status:** recomendado; instalação não confirmada.

**Uso no RiderSync:** orientar componentes e padrões React, composição, renderização e desempenho. É uma skill de apoio técnico; não substitui o padrão arquitetural definido pelo projeto.

**Instalação:** no terminal, dentro da raiz do repositório:

```bash
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices
```

Siga o assistente e selecione Claude Code como agente e o escopo do projeto se essa opção for apresentada.

**Referência:** https://vercel.com/docs/agent-resources/skills

### 2.3 Prisma Skills

**Tipo:** Agent Skills oficiais da Prisma.  
**Status:** instalar após fixar a versão major do Prisma usada no `package.json`.

**Uso no RiderSync:** apoiar modelagem relacional, Prisma Client, consultas, migrations e padrões compatíveis com a versão efetivamente instalada. Isso reduz o risco de o agente gerar APIs de uma versão diferente.

**Instalação condicional:**

- **Se o projeto utilizar Prisma ORM 7:**

```bash
npx skills add prisma/skills
```

- **Se o projeto utilizar Prisma ORM 8:** a skill é distribuída com os pacotes `@prisma/orm-*`. Na configuração inicial, siga o fluxo da versão 8 com `npx prisma@latest init`; em um projeto já configurado, sincronize as skills com:

```bash
npx prisma skills sync
```

Não execute `init` cegamente sobre um projeto existente; revise primeiro a documentação da versão instalada.

Não instale as duas variantes. Primeiro confirme a versão real com:

```bash
npx prisma -v
```

**Referências:**

- https://www.prisma.io/docs/ai/tools/skills
- https://www.prisma.io/docs/cli/skills

### 2.4 Playwright CLI Skill

**Tipo:** skill oficial distribuída pelo Playwright CLI.  
**Status:** pendente de confirmação no computador do desenvolvedor, pois a primeira tentativa de instalação global apresentou `EACCES`.

**Uso no RiderSync:** permitir ao agente navegar na aplicação em execução, inspecionar estados da interface, preencher formulários, clicar em controles e capturar evidências para validar fluxos e responsividade. A CLI complementa, mas não substitui, testes automatizados de integração/E2E mantidos no repositório.

**Instalação no Fedora sem sudo:** se ainda não configurou o prefixo global do npm para a pasta do usuário, execute:

```bash
mkdir -p ~/.local/bin
npm config set prefix ~/.local
```

Adicione ao `~/.bashrc` e recarregue o shell:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Instale a CLI e a skill global:

```bash
npm install -g @playwright/cli@latest
playwright-cli --help
playwright-cli install --skills -g
```

A opção `-g` instala a skill em `~/.claude/skills/playwright-cli`, disponível para projetos do usuário. Não use `sudo npm install -g` como correção padrão.

**Referências:**

- https://playwright.dev/docs/getting-started-cli
- https://playwright.dev/agent-cli/skills

### 2.5 Superpowers — opcional

**Tipo:** plugin de workflow de desenvolvimento.  
**Status:** opcional; não é necessário para iniciar.

**Uso no RiderSync:** oferece práticas de planejamento, TDD, depuração sistemática e revisão. Pode ajudar em tarefas grandes, mas pode adicionar etapas a mudanças pequenas. Instale apenas se o fluxo adicional estiver sendo útil.

**Instalação dentro do Claude Code:**

```text
/plugin install superpowers@claude-plugins-official
```

**Referência:** https://github.com/obra/superpowers

## 3. Conjunto recomendado para o RiderSync

| Skill/plugin | Papel | Prioridade | Status registrado neste guia |
|---|---|---|---|
| `ridersync-domain` | Regras de negócio e arquitetura do produto | Essencial | Incluída no pacote; copiar para o repositório |
| Frontend Design | Qualidade visual e UX | Alta | Recomendada; instalação não confirmada |
| Vercel React Best Practices | Boas práticas React | Alta | Recomendada; instalação não confirmada |
| Prisma Skills | Banco, ORM e migrations | Alta | Aguardar versão major do Prisma |
| Playwright CLI | Navegação e validação no navegador | Alta | Pendente de confirmar instalação após corrigir EACCES |
| Superpowers | Workflow, TDD e depuração | Opcional | Não necessário inicialmente |

## 4. Como instalar a skill própria no RiderSync

A pasta da skill já está incluída neste pacote. Extraia o pacote na raiz do repositório RiderSync, preservando a estrutura de diretórios:

```text
RiderSync/
├── .claude/
│   └── skills/
│       └── ridersync-domain/
│           └── SKILL.md
└── docs/
    └── GUIA_SKILLS_RIDERSYNC.md
```

Se preferir copiar somente a skill, crie o diretório e coloque o arquivo `SKILL.md` nele:

```bash
mkdir -p .claude/skills/ridersync-domain
cp /caminho/para/SKILL.md .claude/skills/ridersync-domain/SKILL.md
```

Depois, reinicie o Claude Code ou recarregue as skills se a versão do seu cliente oferecer esse comando. As skills de projeto devem ser versionadas no Git para que os colaboradores tenham as mesmas regras.

## 5. Como pedir ao Claude para usar a skill

A skill é descoberta pelo Claude Code a partir do seu nome e descrição. Em tarefas do domínio RiderSync, pode-se também citá-la explicitamente no pedido:

```text
Use a skill ridersync-domain. Antes de implementar, leia as instruções do projeto,
inspecione o código existente e implemente esta tarefa como uma fatia vertical.
Preserve o escopo atual: editais estão adiados. Execute os testes pertinentes e
informe os resultados reais.
```

Exemplos de tarefas que devem acionar a skill:

- Criar/alterar permissões de bandas ou casas de show.
- Alterar rider, inventário ou comparação técnica.
- Implementar candidatura, proposta, contraproposta ou booking.
- Modificar entidades Prisma ou migrations relacionadas ao domínio.
- Alterar telas ou endpoints de artistas, bandas e casas.

## 6. Regras de manutenção

- Revise qualquer skill externa antes de instalá-la; não instale extensões de origem desconhecida.
- Não mantenha cópias conflitantes da mesma skill em escopo global e de projeto sem motivo.
- Atualize este guia quando uma skill for efetivamente instalada, removida ou substituída.
- Atualize `ridersync-domain/SKILL.md` quando houver uma decisão de produto/arquitetura aprovada.
- Se uma skill externa contradizer as decisões do RiderSync, prevalecem as decisões explícitas do projeto.
- Não instalar muitas skills redundantes: manter o conjunto pequeno para reduzir instruções duplicadas e contexto desnecessário.

## 7. Fontes oficiais consultadas

- Anthropic — criação e estrutura de skills: https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
- Claude Code — marketplace de plugins oficiais: https://github.com/anthropics/claude-plugins-official
- Anthropic — Frontend Design: https://claude.com/marketplace/plugins/frontend-design
- Vercel — Agent Skills: https://vercel.com/docs/agent-resources/skills
- Prisma — Agent Skills: https://www.prisma.io/docs/ai/tools/skills
- Playwright — CLI e instalação de skills: https://playwright.dev/docs/getting-started-cli
- obra — Superpowers: https://github.com/obra/superpowers
