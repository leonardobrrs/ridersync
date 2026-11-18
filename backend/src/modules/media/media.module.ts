import { Controller, Get, Global, Injectable, Module, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { loadEnv } from '../../config/env';
import { notFound } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuthUser, OptionalUser, Public } from '../auth/auth.decorators';
import { MediaService } from './media.service';
import { createStorageDriver, STORAGE_DRIVER } from './storage';

/**
 * Regras de visualização de arquivos:
 *  - quem enviou sempre vê;
 *  - foto/portfólio de artista: público se o perfil é PUBLIC; senão apenas quem participa;
 *  - foto de casa de show (VENUE): pública; foto de contratante individual (e avatares legados de conta, ainda servidos): apenas usuários autenticados.
 */
@Injectable()
export class MediaAccessPolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async findViewable(mediaId: string, userId: string | null) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      include: {
        userAvatar: { select: { id: true } },
        artistPhoto: { select: { id: true, visibility: true } },
        orgPhoto: { select: { id: true, type: true } },
        portfolioItem: { select: { artist: { select: { id: true, visibility: true } } } },
      },
    });
    if (!asset) return null;
    if (userId && asset.uploadedById === userId) return asset;
    if (asset.userAvatar) return userId ? asset : null;
    if (asset.orgPhoto) return asset.orgPhoto.type === 'VENUE' || userId ? asset : null;
    const artist = asset.artistPhoto ?? asset.portfolioItem?.artist;
    if (!artist) return null;
    if (artist.visibility === 'PUBLIC') return asset;
    if (userId) {
      const acc = await this.access.artistAccess(userId, artist.id);
      if (acc?.canView) return asset;
    }
    return null;
  }
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    private readonly policy: MediaAccessPolicy,
    private readonly media: MediaService,
  ) {}

  @Public()
  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('v') variant: string | undefined,
    @OptionalUser() user: AuthUser | null,
    @Res() res: Response,
  ) {
    const asset = await this.policy.findViewable(id, user?.id ?? null);
    if (!asset) throw notFound('Arquivo não encontrado.');
    const useThumb = variant === 'thumb' && !!asset.thumbKey;
    const stream = await this.media.openStream(useThumb ? asset.thumbKey! : asset.storageKey).catch(() => {
      throw notFound('Arquivo não encontrado.');
    });
    res.setHeader('Content-Type', asset.mimeType);
    if (!useThumb) res.setHeader('Content-Length', String(asset.sizeBytes));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    const safeName = encodeURIComponent(asset.originalName);
    res.setHeader('Content-Disposition', `${asset.kind === 'IMAGE' ? 'inline' : 'attachment'}; filename*=UTF-8''${safeName}`);
    stream.pipe(res);
  }
}

@Global()
@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaAccessPolicy, { provide: STORAGE_DRIVER, useFactory: () => createStorageDriver(loadEnv()) }],
  exports: [MediaService],
})
export class MediaModule {}
