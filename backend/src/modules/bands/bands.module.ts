import { Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiZodBody, ZBody } from '../../common/zod';
import { ArtistsModule } from '../artists/artists.module';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { BandsService, ChangeBandRoleSchema, CreateBandSchema, InviteBandMemberSchema, TransferSchema } from './bands.service';

@ApiTags('bands')
@ApiCookieAuth()
@Controller('bands')
export class BandsController {
  constructor(private readonly bands: BandsService) {}

  @Post()
  @ApiZodBody(CreateBandSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(CreateBandSchema) body: z.infer<typeof CreateBandSchema>) {
    return this.bands.create(user.id, body);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.bands.listMine(user.id);
  }

  @Get(':bandId')
  detail(@CurrentUser() user: AuthUser, @Param('bandId', ParseUUIDPipe) bandId: string) {
    return this.bands.detail(user.id, bandId);
  }

  @Post(':bandId/invitations')
  @ApiZodBody(InviteBandMemberSchema)
  invite(
    @CurrentUser() user: AuthUser,
    @Param('bandId', ParseUUIDPipe) bandId: string,
    @ZBody(InviteBandMemberSchema) body: z.infer<typeof InviteBandMemberSchema>,
  ) {
    return this.bands.invite(user.id, bandId, body);
  }

  @Delete(':bandId/invitations/:memberId')
  @HttpCode(204)
  async cancelInvite(
    @CurrentUser() user: AuthUser,
    @Param('bandId', ParseUUIDPipe) bandId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.bands.cancelInvite(user.id, bandId, memberId);
  }

  @Patch(':bandId/members/:memberId')
  @ApiZodBody(ChangeBandRoleSchema)
  changeRole(
    @CurrentUser() user: AuthUser,
    @Param('bandId', ParseUUIDPipe) bandId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @ZBody(ChangeBandRoleSchema) body: z.infer<typeof ChangeBandRoleSchema>,
  ) {
    return this.bands.changeRole(user.id, bandId, memberId, body.role);
  }

  @Delete(':bandId/members/:memberId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('bandId', ParseUUIDPipe) bandId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.bands.removeMember(user.id, bandId, memberId);
  }

  @Post(':bandId/leave')
  @HttpCode(204)
  async leave(@CurrentUser() user: AuthUser, @Param('bandId', ParseUUIDPipe) bandId: string) {
    await this.bands.leave(user.id, bandId);
  }

  @Post(':bandId/transfer-ownership')
  @ApiZodBody(TransferSchema)
  transfer(
    @CurrentUser() user: AuthUser,
    @Param('bandId', ParseUUIDPipe) bandId: string,
    @ZBody(TransferSchema) body: z.infer<typeof TransferSchema>,
  ) {
    return this.bands.transferOwnership(user.id, bandId, body.memberId);
  }
}

@Module({ imports: [ArtistsModule], controllers: [BandsController], providers: [BandsService], exports: [BandsService] })
export class BandsModule {}
