# Documentação do RiderSync

Mapa da documentação. **Vigente** = descreve o sistema como ele é hoje. **Histórico** = registro de um momento
(relatórios, reuniões, instruções substituídas) — útil para entender decisões, mas não descreve o estado atual.

## Comece por aqui

| Preciso… | Leia |
|---|---|
| entender o produto e rodar localmente | [`../README.md`](../README.md) |
| desenvolver (regras, convenções, comandos, fluxo) | [`development/GUIA_DE_DESENVOLVIMENTO.md`](development/GUIA_DE_DESENVOLVIMENTO.md) |
| saber **por que** algo é como é | [`decisions/DECISOES_TECNICAS.md`](decisions/DECISOES_TECNICAS.md) |

## Vigente

### `architecture/` — como o sistema é construído
| Documento | Conteúdo |
|---|---|
| [`ARQUITETURA.md`](architecture/ARQUITETURA.md) | Módulos, camadas, máquinas de estado, visibilidade, notificações e segurança |
| [`MODELO_DE_DADOS.md`](architecture/MODELO_DE_DADOS.md) | Entidades, migrations, índices e exclusão de dados |

### `decisions/` — decisões técnicas
| Documento | Conteúdo |
|---|---|
| [`DECISOES_TECNICAS.md`](decisions/DECISOES_TECNICAS.md) | Decisões vigentes e o histórico de cada evolução (seções datadas; a mais recente prevalece) |

### `product/` — escopo e requisitos
| Documento | Conteúdo |
|---|---|
| [`INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt`](product/INSTRUCOES_IMPLEMENTACAO_RIDERSYNC_v1.1.txt) | Especificação base do MVP v1.1 (partes foram substituídas pelas evoluções abaixo e pelas decisões técnicas) |
| [`REQUISITOS_EVOLUCAO_2026-11-18.md`](product/REQUISITOS_EVOLUCAO_2026-11-18.md) | Requisitos da evolução de 18/11 (contas separadas, eventos sem casa, notificações, LGPD…) |
| [`reunioes/`](product/reunioes/) | Atas das reuniões que originaram mudanças de escopo (18/11 e 19/11) |
| [`LGPD.md`](product/LGPD.md) | Proteção de dados pessoais: inventário, bases legais, direitos e retenção |

### `development/` — desenvolvimento e testes
| Documento | Conteúdo |
|---|---|
| [`GUIA_DE_DESENVOLVIMENTO.md`](development/GUIA_DE_DESENVOLVIMENTO.md) | Escopo vigente, regras críticas de domínio, convenções, comandos e fluxo de trabalho |
| [`TESTES.md`](development/TESTES.md) | Suítes automatizadas, pré-requisitos, comandos e o que cada uma cobre |
| [`CHECKLIST_TESTES_MANUAIS.md`](development/CHECKLIST_TESTES_MANUAIS.md) | Roteiro de testes manuais no Preview |
| [`SEEDERS.md`](development/SEEDERS.md) | Seeds de demonstração, vitrine e enriquecimento (dados fictícios) |
| [`DEMO.md`](development/DEMO.md) | Roteiro de demonstração com as contas do seed |

### `operations/` — deploy e infraestrutura
| Documento | Conteúdo |
|---|---|
| [`VERCEL_SETUP.md`](operations/VERCEL_SETUP.md) | Projetos da Vercel (API e SPA), Preview, Production, Blob e Cron |
| [`NEON_SETUP.md`](operations/NEON_SETUP.md) | Banco Neon (branch de staging) e scripts de migration remota |
| [`VARIAVEIS_DE_AMBIENTE.md`](operations/VARIAVEIS_DE_AMBIENTE.md) | Todas as variáveis do backend e onde estão configuradas |
| [`PROVEDORES_EXTERNOS.md`](operations/PROVEDORES_EXTERNOS.md) | E-mail (Brevo/Resend), Google OAuth e Cron |

### `images/` e `videos/`
Imagens usadas no README principal (`images/readme/`) e o vídeo de demonstração
([`videos/RiderSync-demonstracao-v2.mp4`](videos/RiderSync-demonstracao-v2.mp4)).

## Histórico e referência

| Pasta | Conteúdo |
|---|---|
| [`reports/`](reports/) | Relatórios de implementação e auditorias — **retratos de quando foram escritos** |
| [`references/`](references/) | Documento de arquitetura original (v1.2) e protótipos HTML — **referência visual e histórica** |
| [`history/`](history/) | Instruções substituídas (v1.0) |
