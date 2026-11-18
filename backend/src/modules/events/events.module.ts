import { Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { UploadedFile as File } from '../media/media.service';
import { uploadInterceptor } from '../media/upload';
import { z } from 'zod';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod';
import { AuthUser, CurrentUser, OptionalUser, Public } from '../auth/auth.decorators';
import { EventLifecycleService } from './event-lifecycle.service';
import {
  ApplySchema,
  CreateEventSchema,
  DecisionSchema,
  EventSearchSchema,
  EventsService,
  EventTransitionSchema,
  IndependentEventSchema,
  RescheduleSchema,
  UpdateEventSchema,
} from './events.service';
import { PublicAgendaService } from './public-agenda.service';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly agenda: PublicAgendaService,
  ) {}

  /** Oportunidades abertas. Visitantes/contratantes: só públicas; contas de artista: públicas e privadas. */
  @Public()
  @Get('public/events')
  @ApiZodQuery(EventSearchSchema)
  search(@ZQuery(EventSearchSchema) q: z.infer<typeof EventSearchSchema>, @OptionalUser() user: AuthUser | null) {
    return this.events.search(q, user?.id ?? null);
  }

  @Public()
  @Get('public/events/:eventId')
  publicDetail(@Param('eventId', ParseUUIDPipe) eventId: string, @OptionalUser() user: AuthUser | null) {
    return this.events.detail(eventId, user?.id ?? null);
  }

  @Public()
  @Get('public/shows')
  shows() {
    return this.agenda.upcomingPublicShows(24);
  }

  @ApiCookieAuth()
  @Post('organizations/:orgId/events')
  @ApiZodBody(CreateEventSchema)
  create(@CurrentUser() user: AuthUser, @Param('orgId', ParseUUIDPipe) orgId: string, @ZBody(CreateEventSchema) body: z.infer<typeof CreateEventSchema>) {
    return this.events.create(user.id, orgId, body);
  }

  @ApiCookieAuth()
  @Post('me/independent-events')
  @ApiZodBody(IndependentEventSchema)
  createIndependent(@CurrentUser() user: AuthUser, @ZBody(IndependentEventSchema) body: z.infer<typeof IndependentEventSchema>) {
    return this.events.createIndependent(user.id, body);
  }

  @ApiCookieAuth()
  @Get('organizations/:orgId/events')
  listForOrg(@CurrentUser() user: AuthUser, @Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.events.listForOrg(user.id, orgId);
  }

  @ApiCookieAuth()
  @Get('events/:eventId/manage')
  manage(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.manageDetail(user.id, eventId);
  }

  @ApiCookieAuth()
  @Patch('events/:eventId')
  @ApiZodBody(UpdateEventSchema)
  update(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZBody(UpdateEventSchema) body: z.infer<typeof UpdateEventSchema>) {
    return this.events.update(user.id, eventId, body);
  }

  @ApiCookieAuth()
  @Put('events/:eventId/image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor())
  setImage(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @UploadedFile() file: File) {
    return this.events.setImage(user.id, eventId, file);
  }

  @ApiCookieAuth()
  @Delete('events/:eventId/image')
  removeImage(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.removeImage(user.id, eventId);
  }

  @ApiCookieAuth()
  @Post('events/:eventId/transition')
  @ApiZodBody(EventTransitionSchema)
  transition(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @ZBody(EventTransitionSchema) body: z.infer<typeof EventTransitionSchema>,
  ) {
    return this.events.transition(user.id, eventId, body);
  }

  @ApiCookieAuth()
  @Post('events/:eventId/reschedule')
  @ApiZodBody(RescheduleSchema)
  reschedule(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZBody(RescheduleSchema) body: z.infer<typeof RescheduleSchema>) {
    return this.events.reschedule(user.id, eventId, body);
  }

  @ApiCookieAuth()
  @Post('events/:eventId/applications')
  @ApiZodBody(ApplySchema)
  apply(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string, @ZBody(ApplySchema) body: z.infer<typeof ApplySchema>) {
    return this.events.apply(user.id, eventId, body);
  }

  @ApiCookieAuth()
  @Get('events/:eventId/my-applications')
  myForEvent(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.myApplicationsForEvent(user.id, eventId);
  }

  @ApiCookieAuth()
  @Get('me/applications')
  mine(@CurrentUser() user: AuthUser) {
    return this.events.myApplications(user.id);
  }

  @ApiCookieAuth()
  @Post('applications/:applicationId/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('applicationId', ParseUUIDPipe) id: string) {
    return this.events.withdraw(user.id, id);
  }

  @ApiCookieAuth()
  @Post('applications/:applicationId/accept')
  @ApiZodBody(DecisionSchema)
  accept(@CurrentUser() user: AuthUser, @Param('applicationId', ParseUUIDPipe) id: string, @ZBody(DecisionSchema) body: z.infer<typeof DecisionSchema>) {
    return this.events.decide(user.id, id, 'ACCEPTED', body.note);
  }

  @ApiCookieAuth()
  @Post('applications/:applicationId/reject')
  @ApiZodBody(DecisionSchema)
  reject(@CurrentUser() user: AuthUser, @Param('applicationId', ParseUUIDPipe) id: string, @ZBody(DecisionSchema) body: z.infer<typeof DecisionSchema>) {
    return this.events.decide(user.id, id, 'REJECTED', body.note);
  }
}

@Module({
  controllers: [EventsController],
  providers: [EventsService, EventLifecycleService, PublicAgendaService],
  exports: [EventsService, EventLifecycleService, PublicAgendaService],
})
export class EventsModule {}
