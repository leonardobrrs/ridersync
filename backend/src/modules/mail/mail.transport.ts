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

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/** Converte `Nome <email@dominio>` (ou só o e-mail) no formato de remetente da Brevo. */
export function parseMailFrom(from: string): { name?: string; email: string } {
  const m = from.trim().match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (m) return { ...(m[1].trim() ? { name: m[1].trim().replace(/^"|"$/g, '') } : {}), email: m[2] };
  if (/^[^<>\s]+@[^<>\s]+$/.test(from.trim())) return { email: from.trim() };
  throw new Error('MAIL_FROM inválido: use "Nome <email@dominio>" ou apenas o e-mail');
}

/**
 * Envio real via API transacional da Brevo (https://developers.brevo.com/reference/sendtransacemail).
 * O remetente (MAIL_FROM) precisa ser um remetente ou domínio verificado na conta Brevo.
 */
export class BrevoTransport implements MailTransport {
  readonly name = 'brevo';
  private readonly sender: { name?: string; email: string };

  constructor(
    private readonly apiKey: string,
    from: string,
  ) {
    this.sender = parseMailFrom(from);
  }

  async send(message: MailMessage): Promise<SendResult> {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: this.sender,
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // A resposta de erro da Brevo não contém a chave; limitada para não poluir os logs.
      const detail = await res.text().catch(() => '');
      throw new Error(`Brevo respondeu ${res.status}: ${detail.slice(0, 300)}`);
    }
    const body = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { status: 'sent', providerId: body.messageId };
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
  if (env.MAIL_DRIVER === 'brevo') return new BrevoTransport(env.BREVO_API_KEY!, env.MAIL_FROM);
  if (env.MAIL_DRIVER === 'resend') return new ResendTransport(env.RESEND_API_KEY!, env.MAIL_FROM);
  if (env.MAIL_DRIVER === 'log') return new DevLogTransport(env.MAIL_DEV_OUTBOX_DIR);
  return new DisabledTransport();
}
