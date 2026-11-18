import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.factory';

export async function bootApp(): Promise<INestApplication> {
  const app = await createApp();
  await app.init();
  return app;
}

/** Cliente HTTP com cookie de sessão próprio e cabeçalho anti-CSRF. */
export class Client {
  readonly agent: ReturnType<typeof request.agent>;
  user?: { id: string; email: string; name: string };

  constructor(app: INestApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  get(url: string) {
    return this.agent.get(`/api${url}`);
  }
  post(url: string, body?: object) {
    return this.agent.post(`/api${url}`).set('X-Requested-With', 'RiderSync').send(body ?? {});
  }
  put(url: string, body?: object) {
    return this.agent.put(`/api${url}`).set('X-Requested-With', 'RiderSync').send(body ?? {});
  }
  patch(url: string, body?: object) {
    return this.agent.patch(`/api${url}`).set('X-Requested-With', 'RiderSync').send(body ?? {});
  }
  delete(url: string) {
    return this.agent.delete(`/api${url}`).set('X-Requested-With', 'RiderSync');
  }
}

export const uniqueEmail = (prefix: string) =>
  `${prefix.normalize('NFD').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'u'}-${randomUUID().slice(0, 8)}@teste.ridersync.dev`;

export const TEST_PASSWORD = 'Senha@Segura123';

export async function registerUser(app: INestApplication, name = 'Pessoa Teste', accountType: 'ARTIST' | 'CONTRACTOR' = 'ARTIST'): Promise<Client> {
  const c = new Client(app);
  const email = uniqueEmail(name.split(' ')[0].toLowerCase());
  const res = await c.post('/auth/register', { accountType, name, email, password: TEST_PASSWORD, passwordConfirmation: TEST_PASSWORD, acceptTerms: true });
  if (res.status !== 201) throw new Error(`register falhou: ${res.status} ${JSON.stringify(res.body)}`);
  c.user = { id: res.body.session.user.id, email, name };
  return c;
}

export const registerContractor = (app: INestApplication, name = 'Contratante Teste') => registerUser(app, name, 'CONTRACTOR');

export const PUBLISHABLE_PROFILE = {
  city: 'Maceió',
  genres: ['MPB', 'Forró'],
  bio: 'Cantora e violonista com repertório autoral e releituras de clássicos nordestinos.',
};

export async function createPublicMusician(c: Client, name: string) {
  const res = await c.post('/me/musician-profile', { name, ...PUBLISHABLE_PROFILE, mainInstrument: 'Voz' });
  if (res.status !== 201) throw new Error(`perfil falhou: ${res.status} ${JSON.stringify(res.body)}`);
  const pub = await c.put(`/artists/${res.body.id}/visibility`, { visibility: 'PUBLIC' });
  if (pub.status !== 200) throw new Error(`publicar falhou: ${pub.status} ${JSON.stringify(pub.body)}`);
  return pub.body as { id: string; slug: string };
}

export async function createVenue(c: Client, name = 'Casa Teste') {
  const res = await c.post('/organizations', { name, city: 'Maceió', venueKind: 'Casa de show', capacity: 300 });
  if (res.status !== 201) throw new Error(`casa falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; slug: string };
}

export const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

/** Último e-mail capturado pelo driver de desenvolvimento (MAIL_DRIVER=log + MAIL_DEV_OUTBOX_DIR) para o destinatário. */
export function lastMailTo(to: string): { to: string; subject: string; html: string; text: string } | null {
  const dir = path.resolve(__dirname, '..', process.env.MAIL_DEV_OUTBOX_DIR ?? './test-storage/mail');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const msg = JSON.parse(readFileSync(path.join(dir, files[i]), 'utf8'));
    if (msg.to === to) return msg;
  }
  return null;
}

export const tokenFrom = (mail: { text: string } | null) => mail?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? null;
