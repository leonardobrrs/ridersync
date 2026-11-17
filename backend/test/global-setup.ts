import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Prepara o banco de TESTE (ridersync_test): aplica migrations (não destrutivo) e limpa
 * apenas os dados das tabelas de domínio. Recusa-se a rodar contra um banco que não seja de teste.
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, '..');
  process.loadEnvFile(path.join(root, '.env.test'));
  const url = process.env.DATABASE_URL ?? '';
  if (!/\/ridersync_test(\?|$)/.test(url)) {
    throw new Error(`Testes de integração exigem o banco ridersync_test. DATABASE_URL atual não é de teste.`);
  }
  execSync('npx prisma migrate deploy', { cwd: root, stdio: 'pipe', env: process.env });
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'EquipmentCatalogItem')`;
    if (tables.length) {
      await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
