import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { appSecret, loadEnv } from '../../config/env';
import { badRequest, notFound } from '../../common/errors';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.module';
import { notificationEmail } from '../mail/mail.templates';
import { DEFAULT_PREFERENCES, NotificationInput, shouldEmail } from './notification.types';

export const PreferencesSchema = z
  .object({
    emailEnabled: z.boolean(),
    emailInvitations: z.boolean(),
    emailApplications: z.boolean(),
    emailBookings: z.boolean(),
    emailEvents: z.boolean(),
  })
  .partial()
  .strict();

export const ListNotificationsSchema = z.object({
  unread: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const UnsubscribeSchema = z.object({ u: z.uuid(), t: z.string().min(10).max(100) }).strict();

const MAX_ATTEMPTS = 5;

interface ClaimedRow {
  id: string;
  toEmail: string;
  subject: string;
  html: string;
  text: string;
  attempts: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  unsubscribeSignature(userId: string) {
    return createHmac('sha256', appSecret(this.env)).update(`email-unsubscribe:${userId}`).digest('base64url').slice(0, 32);
  }

  private appUrl(path: string) {
    return new URL(path, this.env.PUBLIC_APP_URL).toString();
  }

  /**
   * Cria as notificações (e os e-mails no outbox) dentro da transação do chamador.
   * Destinatários repetidos e ocorrências já registradas (mesma dedupeKey) são ignorados.
   * O chamador deve executar `flush()` após o commit.
   */
  async notify(tx: Tx, userIds: Iterable<string>, input: NotificationInput) {
    const recipients = [...new Set(userIds)];
    if (!recipients.length) return;
    const created = await tx.notification.createManyAndReturn({
      data: recipients.map((userId) => ({
        userId,
        category: input.category,
        type: input.type,
        title: input.title.slice(0, 160),
        body: (input.body ?? '').slice(0, 1000),
        link: input.link ?? null,
        dedupeKey: input.dedupeKey.slice(0, 200),
      })),
      skipDuplicates: true,
      select: { id: true, userId: true },
    });
    if (!created.length) return;
    const users = await tx.user.findMany({
      where: { id: { in: created.map((c) => c.userId) }, anonymizedAt: null },
      select: { id: true, email: true, notificationPreference: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const outbox: Prisma.EmailOutboxCreateManyInput[] = [];
    for (const n of created) {
      const user = byId.get(n.userId);
      if (!user || !shouldEmail(input.category, user.notificationPreference)) continue;
      const mandatory = input.category === 'ACCOUNT';
      const msg = notificationEmail({
        to: user.email,
        title: input.title,
        body: input.body ?? '',
        url: input.link ? this.appUrl(input.link) : null,
        preferencesUrl: this.appUrl('/painel/notificacoes/preferencias'),
        unsubscribeUrl: mandatory ? null : this.appUrl(`/notificacoes/descadastrar?u=${user.id}&t=${this.unsubscribeSignature(user.id)}`),
      });
      outbox.push({ notificationId: n.id, toEmail: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    }
    if (outbox.length) await tx.emailOutbox.createMany({ data: outbox });
  }

  /**
   * Despacha e-mails pendentes. O "claim" é atômico (FOR UPDATE SKIP LOCKED): execuções concorrentes
   * (requisições simultâneas ou cron) nunca enviam a mesma linha duas vezes.
   */
  async flush(limit = 20) {
    try {
      // Instantes calculados na aplicação (UTC), coerentes com as colunas gravadas pelo Prisma.
      const now = new Date();
      const staleBefore = new Date(now.getTime() - 10 * 60_000);
      const rows = await this.prisma.$queryRaw<ClaimedRow[]>`
        UPDATE "EmailOutbox" SET "status" = 'SENDING', "attempts" = "attempts" + 1, "updatedAt" = (${now}::timestamptz AT TIME ZONE 'UTC')
        WHERE "id" IN (
          SELECT "id" FROM "EmailOutbox"
          WHERE "status" = 'PENDING'
             OR ("status" = 'FAILED' AND "attempts" < ${MAX_ATTEMPTS})
             OR ("status" = 'SENDING' AND "updatedAt" < (${staleBefore}::timestamptz AT TIME ZONE 'UTC') AND "attempts" < ${MAX_ATTEMPTS})
          ORDER BY "createdAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "toEmail", "subject", "html", "text", "attempts"`;
      for (const row of rows) await this.deliver(row);
      return rows.length;
    } catch (e) {
      this.logger.error(`Falha ao despachar outbox: ${e instanceof Error ? e.message : String(e)}`);
      return 0;
    }
  }

  private async deliver(row: ClaimedRow) {
    try {
      const result = await this.mail.send({ to: row.toEmail, subject: row.subject, html: row.html, text: row.text });
      await this.prisma.emailOutbox.update({
        where: { id: row.id },
        data: result.status === 'sent' ? { status: 'SENT', sentAt: new Date(), lastError: null } : { status: 'SKIPPED', lastError: result.reason },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.prisma.emailOutbox.update({ where: { id: row.id }, data: { status: 'FAILED', lastError: message.slice(0, 500) } });
    }
  }

  // ─────────── Central de notificações ───────────

  async list(userId: string, q: z.infer<typeof ListNotificationsSchema>) {
    const items = await this.prisma.notification.findMany({
      where: { userId, ...(q.unread ? { readAt: null } : {}), ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      select: { id: true, category: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    });
    const hasMore = items.length > q.limit;
    const page = items.slice(0, q.limit);
    return { items: page, nextBefore: hasMore ? page[page.length - 1].createdAt.toISOString() : null };
  }

  async unreadCount(userId: string) {
    return { unread: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    const res = await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    if (res.count === 0 && !(await this.prisma.notification.findFirst({ where: { id, userId }, select: { id: true } }))) {
      throw notFound('Notificação não encontrada.');
    }
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return this.unreadCount(userId);
  }

  // ─────────── Preferências ───────────

  async preferences(userId: string) {
    const p = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    const { emailEnabled, emailInvitations, emailApplications, emailBookings, emailEvents } = p ?? DEFAULT_PREFERENCES;
    return { emailEnabled, emailInvitations, emailApplications, emailBookings, emailEvents };
  }

  async updatePreferences(userId: string, input: z.infer<typeof PreferencesSchema>) {
    await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...input }, update: input });
    return this.preferences(userId);
  }

  /** Descadastro com um clique (link assinado no rodapé dos e-mails), sem exigir login. */
  async unsubscribe(input: z.infer<typeof UnsubscribeSchema>) {
    const expected = Buffer.from(this.unsubscribeSignature(input.u));
    const given = Buffer.from(input.t);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw badRequest('INVALID_LINK', 'Link de descadastro inválido.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: input.u }, select: { id: true } });
    if (!user) throw badRequest('INVALID_LINK', 'Link de descadastro inválido.');
    await this.prisma.notificationPreference.upsert({
      where: { userId: input.u },
      create: { userId: input.u, emailEnabled: false },
      update: { emailEnabled: false },
    });
    return { emailEnabled: false };
  }
}
