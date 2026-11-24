# Referências (históricas)

Materiais que serviram de ponto de partida para o RiderSync. **Não descrevem a implementação atual** — quando houver
conflito, valem o código, [`../decisions/DECISOES_TECNICAS.md`](../decisions/DECISOES_TECNICAS.md) e o
[`../development/GUIA_DE_DESENVOLVIMENTO.md`](../development/GUIA_DE_DESENVOLVIMENTO.md).

| Arquivo | O que é | Uso hoje |
|---|---|---|
| `Arquitetura_Plataforma_Profissionalizacao_Artistica_v1.2.md` | Documento de arquitetura original (v1.2), anterior ao MVP | Referência conceitual; inclui editais/oportunidades culturais, que estão **adiados** |
| `RiderSync_desktop.html` | Protótipo navegável (desktop) | Só identidade visual e interação — a SPA em `frontend/` substitui |
| `RiderSync_celular.html` | Protótipo navegável (celular) | Idem |
| `riderSync_entidades.txt` | Esboço inicial de entidades | Substituído por `backend/prisma/schema.prisma` e [`../architecture/MODELO_DE_DADOS.md`](../architecture/MODELO_DE_DADOS.md) |

Nomes originais (citados na especificação v1.1 e no material histórico): `RiderSyncpc.html` → `RiderSync_desktop.html`,
`RiderSync celular.html` → `RiderSync_celular.html`, `riderSync entidades.txt` → `riderSync_entidades.txt`. As cópias que
ficavam na raiz do repositório eram idênticas a estas e foram removidas em 2026-11-24.

Os protótipos HTML não são enviados no deploy (`.vercelignore`).
