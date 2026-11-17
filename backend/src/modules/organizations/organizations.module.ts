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
import { uploadInterceptor } from '../artists/artists.controller';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { BandsModule } from '../bands/bands.module';
import { BandsService, TransferSchema } from '../bands/bands.service';
import type { UploadedFile as File } from '../media/media.service';
import { PrismaService } from '../../prisma/prisma.service';
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
    return this.orgs.transferOwnership(user.id, orgId, body.memberId);
  }
}

/** Convites recebidos pelo usuário logado (bandas e casas). */
@ApiTags('invitations')
@ApiCookieAuth()
@Controller('me/invitations')
export class InvitationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bands: BandsService,
    private readonly orgs: OrganizationsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const [bandInvites, orgInvites] = await Promise.all([
      this.prisma.bandMember.findMany({
        where: { userId: user.id, status: 'INVITED' },
        orderBy: { invitedAt: 'desc' },
        select: {
          id: true,
          role: true,
          instrument: true,
          invitedAt: true,
          invitedBy: { select: { name: true } },
          band: { select: { id: true, artist: { select: { name: true, slug: true, city: true } } } },
        },
      }),
      this.prisma.organizationMember.findMany({
        where: { userId: user.id, status: 'INVITED' },
        orderBy: { invitedAt: 'desc' },
        select: {
          id: true,
          role: true,
          invitedAt: true,
          invitedBy: { select: { name: true } },
          organization: { select: { id: true, name: true, slug: true, city: true } },
        },
      }),
    ]);
    return {
      bands: bandInvites.map((i) => ({
        id: i.id,
        role: i.role,
        instrument: i.instrument,
        invitedAt: i.invitedAt,
        invitedBy: i.invitedBy?.name ?? null,
        bandId: i.band.id,
        bandName: i.band.artist?.name ?? 'Banda',
        city: i.band.artist?.city ?? null,
      })),
      organizations: orgInvites.map((i) => ({
        id: i.id,
        role: i.role,
        invitedAt: i.invitedAt,
        invitedBy: i.invitedBy?.name ?? null,
        organizationId: i.organization.id,
        organizationName: i.organization.name,
        city: i.organization.city,
      })),
    };
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
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
