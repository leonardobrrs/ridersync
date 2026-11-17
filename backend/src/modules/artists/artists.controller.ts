import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiZodBody, ZBody } from '../../common/zod';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { MAX_DOCUMENT_BYTES } from '../media/file-types';
import type { UploadedFile as File } from '../media/media.service';
import {
  CreateMusicianSchema,
  MusicianDetailsSchema,
  PortfolioLinkSchema,
  PortfolioUpdateSchema,
  UpdateArtistSchema,
  VisibilitySchema,
} from './artist.schemas';
import { ArtistsService } from './artists.service';

export const uploadInterceptor = () => FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } });

@ApiTags('musician-profile')
@ApiCookieAuth()
@Controller('me/musician-profile')
export class MusicianProfileController {
  constructor(private readonly artists: ArtistsService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    return { profile: await this.artists.getMyMusicianProfile(user.id) };
  }

  @Post()
  @ApiZodBody(CreateMusicianSchema)
  create(@CurrentUser() user: AuthUser, @ZBody(CreateMusicianSchema) body: z.infer<typeof CreateMusicianSchema>) {
    return this.artists.createMusicianProfile(user.id, body);
  }

  @Patch()
  @ApiZodBody(MusicianDetailsSchema)
  update(@CurrentUser() user: AuthUser, @ZBody(MusicianDetailsSchema) body: z.infer<typeof MusicianDetailsSchema>) {
    return this.artists.updateMusicianDetails(user.id, body);
  }
}

/** Gestão de uma identidade artística (músico individual ou banda), autorizada por vínculo. */
@ApiTags('artists')
@ApiCookieAuth()
@Controller('artists/:artistId')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Get('manage')
  get(@CurrentUser() user: AuthUser, @Param('artistId', ParseUUIDPipe) artistId: string) {
    return this.artists.getManaged(user.id, artistId);
  }

  @Patch()
  @ApiZodBody(UpdateArtistSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @ZBody(UpdateArtistSchema) body: z.infer<typeof UpdateArtistSchema>,
  ) {
    return this.artists.update(user.id, artistId, body);
  }

  @Put('visibility')
  @ApiZodBody(VisibilitySchema)
  visibility(
    @CurrentUser() user: AuthUser,
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @ZBody(VisibilitySchema) body: z.infer<typeof VisibilitySchema>,
  ) {
    return this.artists.setVisibility(user.id, artistId, body.visibility);
  }

  @Put('photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor())
  photo(@CurrentUser() user: AuthUser, @Param('artistId', ParseUUIDPipe) artistId: string, @UploadedFile() file: File) {
    return this.artists.setPhoto(user.id, artistId, file);
  }

  @Delete('photo')
  removePhoto(@CurrentUser() user: AuthUser, @Param('artistId', ParseUUIDPipe) artistId: string) {
    return this.artists.removePhoto(user.id, artistId);
  }

  @Post('portfolio')
  @ApiZodBody(PortfolioLinkSchema)
  addLink(
    @CurrentUser() user: AuthUser,
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @ZBody(PortfolioLinkSchema) body: z.infer<typeof PortfolioLinkSchema>,
  ) {
    return this.artists.addPortfolioLink(user.id, artistId, body);
  }

  @Post('portfolio/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor())
  addUpload(
    @CurrentUser() user: AuthUser,
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @Body() fields: Record<string, string>,
    @UploadedFile() file: File,
  ) {
    return this.artists.addPortfolioUpload(user.id, artistId, fields, file);
  }

  @Patch('portfolio/:itemId')
  @ApiZodBody(PortfolioUpdateSchema)
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @ZBody(PortfolioUpdateSchema) body: z.infer<typeof PortfolioUpdateSchema>,
  ) {
    return this.artists.updatePortfolioItem(user.id, artistId, itemId, body);
  }

  @Delete('portfolio/:itemId')
  @HttpCode(204)
  async removeItem(
    @CurrentUser() user: AuthUser,
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.artists.removePortfolioItem(user.id, artistId, itemId);
  }
}
