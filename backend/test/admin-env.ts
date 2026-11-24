// Credenciais do painel de administração SÓ para os testes (importado antes da aplicação, que lê o ambiente uma vez).
// Senha de teste: Painel@Teste2026 — o hash abaixo não vale em nenhum ambiente real.
export const ADMIN_TEST_USER = 'adm-teste';
export const ADMIN_TEST_PASSWORD = 'Painel@Teste2026';
process.env.ADMIN_USERNAME = ADMIN_TEST_USER;
process.env.ADMIN_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$DXKH9VPyMJLQUhYrJg6lgg$cyLAiJGIP2apReM8msuHupDAudgOMqB1pbUjQJTD2/Q';
