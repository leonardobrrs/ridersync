import { Controller, Get, Module, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiZodBody, ZBody } from '../../common/zod';
import { AuthUser, CurrentUser, Public } from '../auth/auth.decorators';
import { PutEquipmentSchema, PutRiderSchema, RidersService } from './riders.service';

@ApiTags('riders')
@Controller()
export class RidersController {
  constructor(private readonly riders: RidersService) {}

  @Public()
  @Get('catalog/equipment')
  catalog() {
    return this.riders.catalog();
  }

  @ApiCookieAuth()
  @Get('artists/:artistId/rider')
  rider(@CurrentUser() user: AuthUser, @Param('artistId', ParseUUIDPipe) artistId: string) {
    return this.riders.getRiderForMember(user.id, artistId);
  }

  @ApiCookieAuth()
  @Put('artists/:artistId/rider')
  @ApiZodBody(PutRiderSchema)
  putRider(
    @CurrentUser() user: AuthUser,
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @ZBody(PutRiderSchema) body: z.infer<typeof PutRiderSchema>,
  ) {
    return this.riders.putRider(user.id, artistId, body);
  }

  @ApiCookieAuth()
  @Get('organizations/:orgId/equipment')
  equipment(@CurrentUser() user: AuthUser, @Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.riders.getEquipmentForMember(user.id, orgId);
  }

  @ApiCookieAuth()
  @Put('organizations/:orgId/equipment')
  @ApiZodBody(PutEquipmentSchema)
  putEquipment(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @ZBody(PutEquipmentSchema) body: z.infer<typeof PutEquipmentSchema>,
  ) {
    return this.riders.putEquipment(user.id, orgId, body);
  }

  @ApiCookieAuth()
  @Get('artists/:artistId/compatibility/:orgId')
  compare(
    @CurrentUser() user: AuthUser,
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ) {
    return this.riders.compare(user.id, artistId, orgId);
  }

  /** Rider do artista da candidatura × inventário da casa do evento. */
  @ApiCookieAuth()
  @Get('applications/:applicationId/compatibility')
  compareApplication(@CurrentUser() user: AuthUser, @Param('applicationId', ParseUUIDPipe) applicationId: string) {
    return this.riders.compareApplication(user.id, applicationId);
  }
}

@Module({ controllers: [RidersController], providers: [RidersService], exports: [RidersService] })
export class RidersModule {}
