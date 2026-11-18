import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra servidores dedicados e banco isolado (ridersync_e2e):
 *  - API NestJS em :3100 (migrations aplicadas antes de subir)
 *  - SPA Vite em :5174 com proxy de /api para :3100
 * Pré-requisito: PostgreSQL do docker compose rodando (npm run db:up na raiz).
 * Projetos: desktop (todos os fluxos), tablet e celular (responsividade e navegação móvel).
 * E-mails: driver de desenvolvimento (não envia) grava em backend/test-storage/e2e-mail, lido pelos testes.
 */
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://ridersync:ridersync_dev_only@localhost:5432/ridersync_e2e?schema=public';
const apiEnv = {
  NODE_ENV: 'test',
  PORT: '3100',
  DATABASE_URL: DB,
  CORS_ORIGINS: 'http://127.0.0.1:5174',
  COOKIE_SECURE: 'false',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: './test-storage/e2e',
  THROTTLE_AUTH_LIMIT: '10000',
  MAIL_DRIVER: 'log',
  MAIL_DEV_OUTBOX_DIR: './test-storage/e2e-mail',
  PUBLIC_APP_URL: 'http://127.0.0.1:5174',
  LOGIN_MAX_ATTEMPTS: '50',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'pt-BR', timezoneId: 'America/Maceio' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: false }, testMatch: /responsive\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /(mobile|responsive)\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'npx prisma migrate deploy && npx nest build && node dist/main.js',
      cwd: '../backend',
      url: 'http://127.0.0.1:3100/api/health',
      env: apiEnv,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      env: { VITE_API_PROXY: 'http://127.0.0.1:3100' },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
