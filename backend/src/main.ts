import 'reflect-metadata';
import { existsSync } from 'node:fs';

// Carrega backend/.env em desenvolvimento (variáveis já definidas no ambiente têm prioridade).
if (existsSync('.env')) process.loadEnvFile('.env');

import { Logger } from '@nestjs/common';
import { createApp } from './app.factory';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await createApp();
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  Logger.log(`RiderSync API em http://localhost:${env.PORT}/api (docs: /api/docs)`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
