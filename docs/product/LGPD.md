# RiderSync — Proteção de dados pessoais (LGPD)

Documento técnico de conformidade. O texto exibido aos titulares está em `/privacidade` e `/termos`
(`frontend/src/features/legal/LegalPages.tsx`). **Versão vigente:** `2026-11-18` (constante `PRIVACY_POLICY_VERSION`
no backend e `POLICY_VERSION` no frontend — mudar as duas exige novo aceite de todos no próximo acesso).

> Revisão jurídica recomendada antes de abrir a Production ao público (controlador, encarregado e prazos).

## Inventário de dados (finalidade e base legal)

| Dado | Finalidade | Base legal | Retenção |
|---|---|---|---|
| Nome, e-mail, hash de senha, tipo de conta | Conta e autenticação | Execução de contrato (art. 7º, V) | Enquanto a conta existir |
| `googleSub` | Login com Google | Execução de contrato | Enquanto vinculado |
| Perfil profissional, foto, portfólio, rider, contatos públicos | Divulgação no marketplace (escolha do titular) | Execução de contrato | Enquanto o perfil existir |
| Casas, eventos, candidaturas, propostas, mensagens | Contratação entre as partes | Execução de contrato; exercício regular de direitos (art. 7º, VI) | Mantidos para a contraparte (anonimizados após exclusão da conta) |
| Sessões (data, navegador) e tentativas de login | Segurança | Legítimo interesse (art. 7º, IX) | Sessão: até 7 dias; tokens: 7 dias após uso/expiração |
| Notificações | Avisos de funcionamento | Execução de contrato | Lidas: 180 dias; demais: 1 ano |
| Registros de e-mail (outbox) | Entrega e reenvio | Execução de contrato | Enviados/ignorados: 30 dias; falhas: 90 dias |
| Consentimento (`termsAcceptedAt`, `termsVersion`) | Prova de aceite | Obrigação de demonstrar conformidade (art. 8º §2º) | Enquanto a conta existir |

Não há dados sensíveis, publicidade comportamental, venda de dados nem cookies de rastreamento (apenas o cookie de
sessão e o cookie temporário do OAuth).

## Direitos do titular (art. 18) — como são atendidos

| Direito | Implementação |
|---|---|
| Confirmação e acesso; portabilidade | "Conta e privacidade" → **Baixar cópia** (`GET /api/account/export`, JSON, sem hashes/tokens). |
| Correção | Edição de nome, avatar, perfil, banda e casa no painel. |
| Eliminação | "Conta e privacidade" → **Excluir conta** (`POST /api/account/delete`, senha + digitar EXCLUIR + 3 s). |
| Revogação do consentimento a e-mails | Preferências de notificação ou link assinado em cada e-mail (`/notificacoes/descadastrar`). |
| Informação sobre compartilhamento | Política de Privacidade, seção 3 (operadores: Vercel, Neon, Resend, Google). |
| Demais pedidos / ANPD | E-mail do encarregado (`PRIVACY_CONTACT_EMAIL`), resposta em até 15 dias. |

## Exclusão de conta (sem soft delete indiscriminado)

Implementação: `backend/src/modules/account/account-deletion.service.ts`, em uma transação:

1. Bloqueia se a pessoa é a **única proprietária** de banda/casa que ainda tem outros integrantes (transferir antes).
2. Banda/perfil individual **sem negociações** → apagados (com portfólio, rider e arquivos).
   **Com negociações** → anonimizados ("Artista removido", sem bio/contatos/foto/portfólio/rider, privados);
   negociações em andamento são encerradas com registro de auditoria e aviso à contraparte.
3. Casa/contratante individual sem negociações → apagados; com histórico → contatos removidos, eventos futuros cancelados,
   contratante individual renomeado "Contratante removido".
4. Conta: sessões, tokens, notificações e preferências apagados; nome "Usuário removido", e-mail substituído por um
   endereço inválido único (libera o e-mail para novo cadastro), sem senha nem Google, `anonymizedAt` preenchido.
5. Arquivos (avatar, fotos, portfólio) removidos do storage após o commit.

Mensagens de negociação permanecem para a contraparte com autor "Usuário removido" (art. 16, II — exercício regular de direitos).

## Medidas de segurança (art. 46)

Argon2id; bloqueio por tentativas; sessão server-side com cookie HttpOnly/Secure/SameSite; CSRF; CORS restrito; rate limit;
autorização por vínculo no servidor; UUIDs; seleção explícita de campos públicos; e-mail da conta nunca exibido em
páginas públicas; eventos privados nunca expostos a visitantes; imagens reencodadas sem EXIF/GPS; tokens de e-mail
armazenados apenas como hash e de uso único; erros sem detalhes internos.

## Retenção automatizada

`MaintenanceService` (`backend/src/modules/maintenance/maintenance.module.ts`, constante `RETENTION`), executado pelo
Cron diário da Vercel (somente em Production; ver `docs/operations/PROVEDORES_EXTERNOS.md`).
