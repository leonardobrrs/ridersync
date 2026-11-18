import { Controller, Get, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiZodBody, ZBody } from '../../common/zod';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { EventsModule } from '../events/events.module';
import {
  BookingsService,
  CancelSchema,
  DirectProposalSchema,
  FromApplicationSchema,
  MessageSchema,
  OfferSchema,
  PerformanceSchema,
} from './bookings.service';

@ApiTags('bookings')
@ApiCookieAuth()
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('bookings')
  @ApiZodBody(DirectProposalSchema)
  createDirect(@CurrentUser() user: AuthUser, @ZBody(DirectProposalSchema) body: z.infer<typeof DirectProposalSchema>) {
    return this.bookings.createDirect(user.id, body);
  }

  @Post('applications/:applicationId/booking')
  @ApiZodBody(FromApplicationSchema)
  createFromApplication(
    @CurrentUser() user: AuthUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @ZBody(FromApplicationSchema) body: z.infer<typeof FromApplicationSchema>,
  ) {
    return this.bookings.createFromApplication(user.id, applicationId, body);
  }

  @Get('bookings')
  list(@CurrentUser() user: AuthUser) {
    return this.bookings.list(user.id);
  }

  @Get('bookings/:bookingId')
  detail(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) id: string) {
    return this.bookings.detail(user.id, id);
  }

  @Post('bookings/:bookingId/offers/:offerId/accept')
  accept(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) id: string, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.bookings.respond(user.id, id, offerId, 'accept');
  }

  @Post('bookings/:bookingId/offers/:offerId/decline')
  decline(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) id: string, @Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.bookings.respond(user.id, id, offerId, 'decline');
  }

  @Post('bookings/:bookingId/offers/:offerId/counter')
  @ApiZodBody(OfferSchema)
  counter(
    @CurrentUser() user: AuthUser,
    @Param('bookingId', ParseUUIDPipe) id: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @ZBody(OfferSchema) body: z.infer<typeof OfferSchema>,
  ) {
    return this.bookings.respond(user.id, id, offerId, 'counter', body);
  }

  @Post('bookings/:bookingId/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) id: string) {
    return this.bookings.confirm(user.id, id);
  }

  @Post('bookings/:bookingId/cancel')
  @ApiZodBody(CancelSchema)
  cancel(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) id: string, @ZBody(CancelSchema) body: z.infer<typeof CancelSchema>) {
    return this.bookings.cancel(user.id, id, body.reason);
  }

  @Post('bookings/:bookingId/messages')
  @ApiZodBody(MessageSchema)
  message(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) id: string, @ZBody(MessageSchema) body: z.infer<typeof MessageSchema>) {
    return this.bookings.message(user.id, id, body.body);
  }

  @Post('bookings/:bookingId/performance')
  @ApiZodBody(PerformanceSchema)
  performance(
    @CurrentUser() user: AuthUser,
    @Param('bookingId', ParseUUIDPipe) id: string,
    @ZBody(PerformanceSchema) body: z.infer<typeof PerformanceSchema>,
  ) {
    return this.bookings.registerPerformance(user.id, id, body.notes);
  }
}

@Module({ imports: [EventsModule], controllers: [BookingsController], providers: [BookingsService], exports: [BookingsService] })
export class BookingsModule {}
