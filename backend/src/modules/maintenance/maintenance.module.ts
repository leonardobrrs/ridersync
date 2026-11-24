import { Controller, Get, Headers, Injectable, Logger, Module } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { loadEnv } from '../../config/env';
import { notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../auth/auth.decorators';
import { EventLifecycleService } from '../events/event-lifecycle.service';
import { EventsModule } from '../events/events.module';
import { NotificationsService } from '../notifications/notifications.service';

const DAY = 24 * 3600 * 1000;

/** Prazos de retenção (documentados em docs/product/LGPD.md — Política de retenção). */
export const RETENTION = {
  usedOrExpiredTokensDays: 7,
  readNotificationsDays: 180,
  unreadNotificationsDays: 365,
  deliveredEmailsDays: 30,
  failedEmailsDays: 90,
} as const;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: EventLifecycleService,
    private readonly notifications: NotificationsService,
  ) {}

  async run(now = new Date()) {
    const ago = (days: number) => new Date(now.getTime() - days * DAY);
    const events = await this.lifecycle.sweep(now);
    const emailsDispatched = await this.notifications.flush(100);
    const [sessions, tokens, readNotifications, oldNotifications, delivered, failed] = await Promise.all([
      this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.userToken.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(RETENTION.usedOrExpiredTokensDays) } }, { usedAt: { lt: ago(RETENTION.usedOrExpiredTokensDays) } }] } }),
      this.prisma.notification.deleteMany({ where: { readAt: { lt: ago(RETENTION.readNotificationsDays) } } }),
      this.prisma.notification.deleteMany({ where: { createdAt: { lt: ago(RETENTION.unreadNotificationsDays) } } }),
      this.prisma.emailOutbox.deleteMany({ where: { status: { in: ['SENT', 'SKIPPED'] }, updatedAt: { lt: ago(RETENTION.deliveredEmailsDays) } } }),
      this.prisma.emailOutbox.deleteMany({ where: { status: 'FAILED', updatedAt: { lt: ago(RETENTION.failedEmailsDays) } } }),
    ]);
    const summary = {
      events,
      emailsDispatched,
      purged: {
        sessions: sessions.count,
        tokens: tokens.count,
        notifications: readNotifications.count + oldNotifications.count,
        emails: delivered.count + failed.count,
      },
    };
    this.logger.log(`Manutenção concluída: ${JSON.stringify(summary)}`);
    return summary;
  }
}

/** Disparado pelo Cron da Vercel (Authorization: Bearer CRON_SECRET). Sem segredo configurado, a rota não existe. */
@ApiExcludeController()
@Controller('internal')
export class MaintenanceController {
  private readonly secret = loadEnv().CRON_SECRET;

  constructor(private readonly maintenance: MaintenanceService) {}

  @Public()
  @Get('maintenance')
  run(@Headers('authorization') authorization?: string) {
    const expected = this.secret ? Buffer.from(`Bearer ${this.secret}`) : null;
    const given = Buffer.from(authorization ?? '');
    if (!expected || expected.length !== given.length || !timingSafeEqual(expected, given)) throw notFound();
    return this.maintenance.run();
  }
}

@Module({ imports: [EventsModule], controllers: [MaintenanceController], providers: [MaintenanceService] })
export class MaintenanceModule {}
