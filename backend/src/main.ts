import 'reflect-metadata';
import { existsSync } from 'node:fs';

// Carrega backend/.env em desenvolvimento (variáveis já definidas no ambiente têm prioridade).
if (existsSync('.env')) process.loadEnvFile('.env');

import { Logger } from '@nestjs/common';
// Import direto de @nestjs/core: é o que a detecção nativa de NestJS da Vercel (@vercel/nestjs)
// procura no entrypoint src/main.ts. Não mover esta criação para outro arquivo.
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { appOptions, configureApp } from './app.factory';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule, appOptions()));
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  Logger.log(`RiderSync API em http://localhost:${env.PORT}/api (docs: /api/docs)`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
