import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Env } from '../../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult = { status: 'sent'; providerId?: string } | { status: 'skipped'; reason: string };

export interface MailTransport {
  readonly name: string;
  send(message: MailMessage): Promise<SendResult>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Envio real via API HTTP do Resend (https://resend.com). Exige domínio remetente verificado no provedor. */
export class ResendTransport implements MailTransport {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<SendResult> {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend respondeu ${res.status}: ${detail.slice(0, 300)}`);
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: 'sent', providerId: body.id };
  }
}

/**
 * Somente desenvolvimento/testes: não envia e-mail. Registra no log que o envio foi
 * suprimido e, se MAIL_DEV_OUTBOX_DIR estiver definido, grava a mensagem em JSON para inspeção local.
 */
export class DevLogTransport implements MailTransport {
  readonly name = 'log';
  private readonly logger = new Logger('Mail(dev)');

  constructor(private readonly outboxDir?: string) {}

  async send(message: MailMessage): Promise<SendResult> {
    this.logger.log(`E-mail NÃO enviado (driver de desenvolvimento) para ${message.to}: "${message.subject}"`);
    if (this.outboxDir) {
      const dir = path.resolve(this.outboxDir);
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${Date.now()}-${randomUUID()}.json`);
      await writeFile(file, JSON.stringify({ ...message, createdAt: new Date().toISOString() }));
    }
    return { status: 'skipped', reason: 'driver de desenvolvimento' };
  }
}

/** Provedor não configurado: nenhuma mensagem sai e o registro fica como SKIPPED. */
export class DisabledTransport implements MailTransport {
  readonly name = 'disabled';
  async send(): Promise<SendResult> {
    return { status: 'skipped', reason: 'envio de e-mail desativado (provedor não configurado)' };
  }
}

export function createMailTransport(env: Env): MailTransport {
  if (env.MAIL_DRIVER === 'resend') return new ResendTransport(env.RESEND_API_KEY!, env.MAIL_FROM);
  if (env.MAIL_DRIVER === 'log') return new DevLogTransport(env.MAIL_DEV_OUTBOX_DIR);
  return new DisabledTransport();
}
