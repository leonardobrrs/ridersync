import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiZodBody, ZBody } from '../../common/zod';
import { uploadInterceptor } from '../media/upload';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { BandsModule } from '../bands/bands.module';
import { BandsService, TransferSchema } from '../bands/bands.service';
import { InvitationsService } from './invitations.service';
import type { UploadedFile as File } from '../media/media.service';
import {
  ChangeOrgRoleSchema,
  CreateOrganizationSchema,
  InviteOrgMemberSchema,
  OrganizationsService,
  UpdateOrganizationSchema,
} from './organizations.service';

@ApiTags('organizations')
@ApiCookieAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  @ApiZodBody(CreateOrganizationSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(CreateOrganizationSchema) body: z.infer<typeof CreateOrganizationSchema>) {
    return this.orgs.create(user.id, body);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.orgs.listMine(user.id);
  }

  @Get(':orgId/manage')
  detail(@CurrentUser() user: AuthUser, @Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgs.detail(user.id, orgId);
  }

  @Patch(':orgId')
  @ApiZodBody(UpdateOrganizationSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @ZBody(UpdateOrganizationSchema) body: z.infer<typeof UpdateOrganizationSchema>,
  ) {
    return this.orgs.update(user.id, orgId, body);
  }

  @Put(':orgId/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor())
  photo(@CurrentUser() user: AuthUser, @Param('orgId', ParseUUIDPipe) orgId: string, @UploadedFile() file: File) {
    return this.orgs.setPhoto(user.id, orgId, file);
  }

  @Delete(':orgId/photo')
  removePhoto(@CurrentUser() user: AuthUser, @Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.orgs.removePhoto(user.id, orgId);
  }

  @Post(':orgId/invitations')
  @ApiZodBody(InviteOrgMemberSchema)
  invite(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @ZBody(InviteOrgMemberSchema) body: z.infer<typeof InviteOrgMemberSchema>,
  ) {
    return this.orgs.invite(user.id, orgId, body);
  }

  @Delete(':orgId/invitations/:memberId')
  @HttpCode(204)
  async cancelInvite(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.orgs.cancelInvite(user.id, orgId, memberId);
  }

  @Patch(':orgId/members/:memberId')
  @ApiZodBody(ChangeOrgRoleSchema)
  changeRole(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @ZBody(ChangeOrgRoleSchema) body: z.infer<typeof ChangeOrgRoleSchema>,
  ) {
    return this.orgs.changeRole(user.id, orgId, memberId, body.role);
  }

  @Delete(':orgId/members/:memberId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.orgs.removeMember(user.id, orgId, memberId);
  }

  @Post(':orgId/leave')
  @HttpCode(204)
  async leave(@CurrentUser() user: AuthUser, @Param('orgId', ParseUUIDPipe) orgId: string) {
    await this.orgs.leave(user.id, orgId);
  }

  @Post(':orgId/transfer-ownership')
  @ApiZodBody(TransferSchema)
  transfer(
    @CurrentUser() user: AuthUser,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @ZBody(TransferSchema) body: z.infer<typeof TransferSchema>,
  ) {
    return this.orgs.transferOwnership(user.id, orgId, body);
  }
}

/** Convites recebidos pelo usuário logado (bandas e casas). */
@ApiTags('invitations')
@ApiCookieAuth()
@Controller('me/invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly bands: BandsService,
    private readonly orgs: OrganizationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.invitations.listForUser(user.id);
  }

  @Post('band/:memberId/accept')
  acceptBand(@CurrentUser() user: AuthUser, @Param('memberId', ParseUUIDPipe) id: string) {
    return this.bands.respondInvite(user.id, id, true);
  }

  @Post('band/:memberId/decline')
  declineBand(@CurrentUser() user: AuthUser, @Param('memberId', ParseUUIDPipe) id: string) {
    return this.bands.respondInvite(user.id, id, false);
  }

  @Post('organization/:memberId/accept')
  acceptOrg(@CurrentUser() user: AuthUser, @Param('memberId', ParseUUIDPipe) id: string) {
    return this.orgs.respondInvite(user.id, id, true);
  }

  @Post('organization/:memberId/decline')
  declineOrg(@CurrentUser() user: AuthUser, @Param('memberId', ParseUUIDPipe) id: string) {
    return this.orgs.respondInvite(user.id, id, false);
  }
}

@Module({
  imports: [BandsModule],
  controllers: [OrganizationsController, InvitationsController],
  providers: [OrganizationsService, InvitationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
