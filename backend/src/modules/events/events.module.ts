import { Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod';
import { AuthUser, CurrentUser, Public } from '../auth/auth.decorators';
import {
  ApplySchema,
  CreateEventSchema,
  DecisionSchema,
  EventSearchSchema,
  EventsService,
  EventTransitionSchema,
  UpdateEventSchema,
} from './events.service';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // Público ("Oportunidades de apresentação")
  @Public()
  @Get('public/events')
  @ApiZodQuery(EventSearchSchema)
  search(@ZQuery(EventSearchSchema) q: z.infer<typeof EventSearchSchema>) {
    return this.events.searchPublic(q);
  }

  @Public()
  @Get('public/events/:eventId')
  publicDetail(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.publicDetail(eventId);
  }

  // Gestão pela casa ("Eventos / Publicações")
  @ApiCookieAuth()
  @Post('organizations/:orgId/events')
  @ApiZodBody(CreateEventSchema)
  create(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @ZBody(CreateEventSchema) body: z.infer<typeof CreateEventSchema>,
  ) {
    return this.events.create(user.id, orgId, body);
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
  update(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @ZBody(UpdateEventSchema) body: z.infer<typeof UpdateEventSchema>,
  ) {
    return this.events.update(user.id, eventId, body);
  }

  @ApiCookieAuth()
  @Post('events/:eventId/transition')
  @ApiZodBody(EventTransitionSchema)
  transition(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @ZBody(EventTransitionSchema) body: z.infer<typeof EventTransitionSchema>,
  ) {
    return this.events.transition(user.id, eventId, body.action);
  }

  // Candidaturas
  @ApiCookieAuth()
  @Post('events/:eventId/applications')
  @ApiZodBody(ApplySchema)
  apply(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @ZBody(ApplySchema) body: z.infer<typeof ApplySchema>,
  ) {
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
  accept(
    @CurrentUser() user: AuthUser,
    @Param('applicationId', ParseUUIDPipe) id: string,
    @ZBody(DecisionSchema) body: z.infer<typeof DecisionSchema>,
  ) {
    return this.events.decide(user.id, id, 'ACCEPTED', body.note);
  }

  @ApiCookieAuth()
  @Post('applications/:applicationId/reject')
  @ApiZodBody(DecisionSchema)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('applicationId', ParseUUIDPipe) id: string,
    @ZBody(DecisionSchema) body: z.infer<typeof DecisionSchema>,
  ) {
    return this.events.decide(user.id, id, 'REJECTED', body.note);
  }
}

@Module({ controllers: [EventsController], providers: [EventsService], exports: [EventsService] })
export class EventsModule {}
