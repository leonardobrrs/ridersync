import { Controller, Get, Global, HttpCode, Module, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod';
import { AuthUser, CurrentUser, Public } from '../auth/auth.decorators';
import { ListNotificationsSchema, NotificationsService, PreferencesSchema, UnsubscribeSchema } from './notifications.service';

@ApiTags('notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiCookieAuth()
  @Get('me/notifications')
  @ApiZodQuery(ListNotificationsSchema)
  list(@CurrentUser() user: AuthUser, @ZQuery(ListNotificationsSchema) q: z.infer<typeof ListNotificationsSchema>) {
    return this.notifications.list(user.id, q);
  }

  @ApiCookieAuth()
  @Get('me/notifications/unread-count')
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @ApiCookieAuth()
  @Post('me/notifications/read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @ApiCookieAuth()
  @Post('me/notifications/:id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @ApiCookieAuth()
  @Get('me/notification-preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferences(user.id);
  }

  @ApiCookieAuth()
  @Put('me/notification-preferences')
  @ApiZodBody(PreferencesSchema)
  updatePreferences(@CurrentUser() user: AuthUser, @ZBody(PreferencesSchema) body: z.infer<typeof PreferencesSchema>) {
    return this.notifications.updatePreferences(user.id, body);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('notifications/unsubscribe')
  @HttpCode(200)
  @ApiZodBody(UnsubscribeSchema)
  unsubscribe(@ZBody(UnsubscribeSchema) body: z.infer<typeof UnsubscribeSchema>) {
    return this.notifications.unsubscribe(body);
  }
}

@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
