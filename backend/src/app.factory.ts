import { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { corsOrigins, loadEnv, originMatcher } from './config/env';

/** Configuração HTTP compartilhada por main.ts e pelos testes de integração. */
export function configureApp(app: INestApplication) {
  const env = loadEnv();
  const express = app as NestExpressApplication;
  express.set('trust proxy', 1);
  express.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  const isAllowedOrigin = originMatcher(corsOrigins(env));
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) =>
      callback(null, !origin || isAllowedOrigin(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  });
  express.useBodyParser('json', { limit: '256kb' });

  if (env.NODE_ENV !== 'production' || process.env.SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('RiderSync API')
      .setDescription(
        'API REST do monólito modular RiderSync (MVP). Autenticação por cookie HttpOnly `rs_session`. ' +
          'Requisições que alteram estado exigem o cabeçalho `X-Requested-With: RiderSync`.',
      )
      .setVersion('0.1.0')
      .addCookieAuth('rs_session')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }
  return app;
}

/** Opções do NestFactory compartilhadas por main.ts e pelos testes. */
export function appOptions(): NestApplicationOptions {
  return {
    bodyParser: false,
    logger: loadEnv().NODE_ENV === 'test' ? ['error'] : ['error', 'warn', 'log'],
  };
}

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, appOptions());
  return configureApp(app);
}
