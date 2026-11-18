# RiderSync — Testes

## Pré-requisitos

PostgreSQL local com os bancos `ridersync_test` (integração) e `ridersync_e2e` (Playwright):

```bash
npm run db:up                       # docker compose; ou um PostgreSQL local equivalente
cp backend/.env.example backend/.env.test   # e ajuste: DATABASE_URL=.../ridersync_test, NODE_ENV=test,
                                            # THROTTLE_AUTH_LIMIT=10000, MAIL_DRIVER=log, MAIL_DEV_OUTBOX_DIR=./test-storage/mail
npx playwright install chromium     # uma vez (frontend)
```

O `globalSetup` da integração recusa qualquer banco que não seja `ridersync_test` e só limpa tabelas de domínio.

## Comandos

```bash
npm run lint && npm run typecheck
npm test -w backend                  # unitários + integração (Jest + Supertest)
npm run test:unit -w backend         # só unitários
npm test -w frontend                 # Vitest + Testing Library
npm run test:e2e                     # Playwright: desktop, tablet (820 px) e celular (Pixel 7)
# banco diferente para o e2e: E2E_DATABASE_URL=postgresql://.../ridersync_e2e npm run test:e2e
npm run build
```

E-mails nos testes: o driver `log` **não envia nada**; grava as mensagens em JSON (`MAIL_DEV_OUTBOX_DIR`), lidas pelos
testes para obter links de confirmação/redefinição.

## Cobertura (resultado da execução de 2026-11-18)

| Suíte | Arquivos | Resultado |
|---|---|---|
| Backend — unitários | `src/**/*.spec.ts` (13 arquivos) | **passando** |
| Backend — integração | `test/*.e2e-spec.ts` (8 arquivos) | **passando** — total backend: 201 testes |
| Frontend — unitários | `src/**/*.test.tsx?` (3 arquivos) | **13 passando** |
| Playwright | `e2e/*.spec.ts` (4 arquivos) | **17 passando** (desktop 10, tablet 3, celular 4) |

### O que é testado

- **Regras puras**: máquina de estados de eventos (manuais, por vagas e por data), candidaturas, negociação,
  compatibilidade de rider, regras de membros, política de senha, Argon2id e migração do scrypt, preferências de e-mail,
  miniaturas de vídeo, validação do `id_token` do Google e anti open-redirect, cidades de Alagoas, processamento de imagem
  (remoção de EXIF, sem ampliação, rejeição de arquivo corrompido), configuração de ambiente, publicidade da agenda.
- **Integração (API + PostgreSQL)**: cadastro com validações, confirmação de e-mail (token único), recuperação de senha,
  bloqueio por tentativas, sessão/cookie, troca e definição de senha, tipos de conta, aceite de termos, Google desativado
  sem credencial; notificações (interna + outbox, dedupe, preferências, descadastro assinado, isolamento); LGPD (exportação,
  bloqueio de exclusão, anonimização preservando a contraparte, exclusão real sem histórico); eventos independentes e
  privados (sem vazamento em busca/detalhe/home/agenda), **aceites concorrentes**, vaga cancelada reabrindo o evento,
  convites que ocupam vaga, adiar/remarcar/cancelar em cascata, transições por data idempotentes, agenda pública;
  segurança (IDOR entre organizações, permissões de banda, CSRF, CORS, cabeçalhos, arquivos maliciosos, avatar privado,
  rota de manutenção protegida); fluxos já existentes (perfil, portfólio, bandas, casas, inventário, comparação, bookings).
- **Ponta a ponta (navegador)**: cadastro (tipo obrigatório, requisitos de senha, olho, confirmação), confirmação de e-mail
  por link, login/logout, recuperação de senha, exclusão de conta com contagem regressiva, documentação e rodapé sem API,
  busca de casas por visitante; fluxo MVP completo com contas separadas, rider sem exigências do local, miniatura do
  YouTube, convite com função, sino de notificações, **transferência de propriedade com senha e 3 s**, evento que muda
  sozinho para "Vagas preenchidas", comparação na negociação, aceite e confirmação por **modal do sistema** (o teste falha
  se surgir qualquer diálogo nativo do navegador), agenda, perfil público com abas e próximos eventos, show confirmado na
  página inicial e evento particular privado visível só para artistas; responsividade sem rolagem horizontal nas páginas
  públicas e do painel nos três tamanhos de tela.

### Não coberto automaticamente

- Login com Google real e entrega real de e-mail (dependem de credenciais externas — ver `docs/PROVEDORES_EXTERNOS.md`).
- Upload contra o Vercel Blob real (o driver foi validado manualmente em 2026-11-17; os testes usam storage local).
