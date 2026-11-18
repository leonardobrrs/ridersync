# Recuperação da migration 20261118120000_evolucao_contas_eventos_notificacoes

A migration é aditiva (colunas novas anuláveis/com default, tabelas novas, valores de enum novos) e não remove dados.
Prisma não gera "down migrations"; a estratégia de recuperação é:

1. **Antes de aplicar em staging/produção:** criar uma branch Neon a partir do estado atual
   (`neon branches create --name pre-evolucao --parent <branch>`), que serve de ponto de restauração instantâneo.
2. **Reverter o código** (deploy anterior) é seguro enquanto nenhum registro usar os novos valores de enum
   (`FILLED`, `POSTPONED`, `CANCELLED`, `INDIVIDUAL`); o client antigo ignora as colunas novas.
3. **Reversão manual do schema** (somente se necessário, após avaliar perda dos dados novos):
   - `DROP TABLE "EmailOutbox", "NotificationPreference", "Notification", "UserToken";`
   - remover os CHECKs `Event_has_location`, `User_failed_login_non_negative`, `User_has_credential`,
     `Notification_internal_link`, `EmailOutbox_attempts_non_negative`, `MediaAsset_dimensions_positive`;
   - remover as colunas novas de `User`, `Event`, `MediaAsset`, `PortfolioItem`, `EquipmentCatalogItem`;
   - `passwordHash` só volta a NOT NULL se não houver contas somente-Google;
   - valores de enum não podem ser removidos no PostgreSQL sem recriar o tipo — preferir restaurar a branch.
   - apagar a linha correspondente em `_prisma_migrations`.
