import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { conflict, notFound, unprocessable } from '../../common/errors';
import { resolveVideoThumbnail } from '../../common/video-thumbnail';
import { uniqueSlug } from '../../common/slug';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { MediaService, UploadedFile } from '../media/media.service';
import { managedArtistSelect, portfolioSelect, toManagedArtist, toPortfolioItem } from './artist.presenter';
import {
  CreateArtistInput,
  CreateMusicianSchema,
  MusicianDetailsSchema,
  PortfolioLinkSchema,
  PortfolioUpdateSchema,
  PortfolioUploadFieldsSchema,
  publicationIssues,
  UpdateArtistInput,
} from './artist.schemas';

const MAX_PORTFOLIO_ITEMS = 30;

@Injectable()
export class ArtistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly media: MediaService,
  ) {}

  /** Dados de perfil (sem subtipo) para criação de Artist dentro de uma transação. */
  async artistCreateData(tx: Tx, input: CreateArtistInput) {
    const slug = await uniqueSlug(input.name, async (s) => !!(await tx.artist.findUnique({ where: { slug: s }, select: { id: true } })));
    return {
      slug,
      name: input.name,
      headline: input.headline ?? '',
      bio: input.bio ?? '',
      city: input.city ?? null,
      state: input.state ?? 'AL',
      genres: input.genres ?? [],
      formats: input.formats ?? [],
      careerStartYear: input.careerStartYear ?? null,
      baseFeeCents: input.baseFeeCents ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      instagram: input.instagram ?? null,
      website: input.website ?? null,
      visibility: 'PRIVATE' as const,
      rider: { create: {} },
    };
  }

  // ─────────── Perfil individual ───────────

  async createMusicianProfile(userId: string, input: z.infer<typeof CreateMusicianSchema>) {
    await this.access.assertAccountType(userId, 'ARTIST');
    const { mainInstrument, instruments, ...artistInput } = input;
    const existing = await this.prisma.musicianProfile.findUnique({ where: { userId }, select: { id: true } });
    if (existing) throw conflict('PROFILE_EXISTS', 'Você já possui um perfil individual.');
    const artistId = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.musicianProfile.create({
        data: { userId, mainInstrument: mainInstrument ?? null, instruments: instruments ?? [] },
      });
      const artist = await tx.artist.create({
        data: { kind: 'SOLO', musicianProfileId: profile.id, ...(await this.artistCreateData(tx, artistInput)) },
        select: { id: true },
      });
      return artist.id;
    });
    return this.getManaged(userId, artistId);
  }

  async getMyMusicianProfile(userId: string) {
    const profile = await this.prisma.musicianProfile.findUnique({ where: { userId }, select: { artist: { select: { id: true } } } });
    if (!profile?.artist) return null;
    return this.getManaged(userId, profile.artist.id);
  }

  async updateMusicianDetails(userId: string, input: z.infer<typeof MusicianDetailsSchema>) {
    const profile = await this.prisma.musicianProfile.findUnique({ where: { userId }, select: { id: true, artist: { select: { id: true } } } });
    if (!profile?.artist) throw notFound('Você ainda não criou seu perfil individual.');
    await this.prisma.musicianProfile.update({ where: { id: profile.id }, data: input });
    return this.getManaged(userId, profile.artist.id);
  }

  // ─────────── Gestão comum (solo ou banda) ───────────

  async getManaged(userId: string, artistId: string) {
    const access = await this.access.assertCanViewArtist(userId, artistId);
    const artist = await this.prisma.artist.findUniqueOrThrow({ where: { id: artistId }, select: managedArtistSelect });
    return { ...toManagedArtist(artist), access: { canManage: access.canManage, bandRole: access.bandRole } };
  }

  async update(userId: string, artistId: string, input: UpdateArtistInput) {
    await this.access.assertCanManageArtist(userId, artistId);
    const current = await this.prisma.artist.findUniqueOrThrow({
      where: { id: artistId },
      select: { name: true, bio: true, city: true, genres: true, visibility: true },
    });
    const next = { ...current, ...stripUndefined(input) } as typeof current;
    if (current.visibility === 'PUBLIC') {
      const issues = publicationIssues(next);
      if (issues.length) {
        throw unprocessable(
          'PUBLICATION_REQUIREMENTS',
          `Perfil público precisa de: ${issues.join(', ')}. Torne o perfil privado antes de remover estas informações.`,
        );
      }
    }
    await this.prisma.artist.update({ where: { id: artistId }, data: input });
    return this.getManaged(userId, artistId);
  }

  async setVisibility(userId: string, artistId: string, visibility: 'PUBLIC' | 'PRIVATE') {
    await this.access.assertCanManageArtist(userId, artistId);
    const artist = await this.prisma.artist.findUniqueOrThrow({
      where: { id: artistId },
      select: { name: true, bio: true, city: true, genres: true, publishedAt: true },
    });
    if (visibility === 'PUBLIC') {
      const issues = publicationIssues(artist);
      if (issues.length) throw unprocessable('PUBLICATION_REQUIREMENTS', `Para publicar, complete: ${issues.join(', ')}.`);
    }
    await this.prisma.artist.update({
      where: { id: artistId },
      data: { visibility, publishedAt: visibility === 'PUBLIC' ? (artist.publishedAt ?? new Date()) : artist.publishedAt },
    });
    return this.getManaged(userId, artistId);
  }

  async setPhoto(userId: string, artistId: string, file: UploadedFile | undefined) {
    await this.access.assertCanManageArtist(userId, artistId);
    const previous = await this.prisma.artist.findUniqueOrThrow({ where: { id: artistId }, select: { photoId: true } });
    const asset = await this.media.store(file, userId, 'image');
    await this.prisma.artist.update({ where: { id: artistId }, data: { photoId: asset.id } });
    if (previous.photoId) await this.media.remove(previous.photoId);
    return this.getManaged(userId, artistId);
  }

  async removePhoto(userId: string, artistId: string) {
    await this.access.assertCanManageArtist(userId, artistId);
    const artist = await this.prisma.artist.findUniqueOrThrow({ where: { id: artistId }, select: { photoId: true } });
    if (artist.photoId) {
      await this.prisma.artist.update({ where: { id: artistId }, data: { photoId: null } });
      await this.media.remove(artist.photoId);
    }
    return this.getManaged(userId, artistId);
  }

  // ─────────── Portfólio ───────────

  private async nextPosition(artistId: string) {
    const count = await this.prisma.portfolioItem.count({ where: { artistId } });
    if (count >= MAX_PORTFOLIO_ITEMS) throw unprocessable('PORTFOLIO_LIMIT', `O portfólio aceita até ${MAX_PORTFOLIO_ITEMS} itens.`);
    return count;
  }

  async addPortfolioLink(userId: string, artistId: string, input: z.infer<typeof PortfolioLinkSchema>) {
    await this.access.assertCanManageArtist(userId, artistId);
    const position = await this.nextPosition(artistId);
    const thumbnailUrl = await resolveVideoThumbnail(input.url);
    const item = await this.prisma.portfolioItem.create({ data: { artistId, ...input, thumbnailUrl, position }, select: portfolioSelect });
    return toPortfolioItem(item);
  }

  async addPortfolioUpload(userId: string, artistId: string, fields: unknown, file: UploadedFile | undefined) {
    await this.access.assertCanManageArtist(userId, artistId);
    const parsed = PortfolioUploadFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      throw unprocessable('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(' '));
    }
    const position = await this.nextPosition(artistId);
    const asset = await this.media.store(file, userId, parsed.data.kind === 'PHOTO' ? 'image' : 'image-or-pdf');
    try {
      const item = await this.prisma.portfolioItem.create({
        data: { artistId, ...parsed.data, mediaId: asset.id, position },
        select: portfolioSelect,
      });
      return toPortfolioItem(item);
    } catch (e) {
      await this.media.remove(asset.id);
      throw e;
    }
  }

  private async findItem(artistId: string, itemId: string) {
    const item = await this.prisma.portfolioItem.findFirst({ where: { id: itemId, artistId }, select: { id: true, mediaId: true } });
    if (!item) throw notFound('Item de portfólio não encontrado.');
    return item;
  }

  async updatePortfolioItem(userId: string, artistId: string, itemId: string, input: z.infer<typeof PortfolioUpdateSchema>) {
    await this.access.assertCanManageArtist(userId, artistId);
    await this.findItem(artistId, itemId);
    const item = await this.prisma.portfolioItem.update({ where: { id: itemId }, data: input, select: portfolioSelect });
    return toPortfolioItem(item);
  }

  async removePortfolioItem(userId: string, artistId: string, itemId: string) {
    await this.access.assertCanManageArtist(userId, artistId);
    const item = await this.findItem(artistId, itemId);
    if (item.mediaId) await this.media.remove(item.mediaId); // cascade remove o item
    else await this.prisma.portfolioItem.delete({ where: { id: itemId } });
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export type ArtistCreateData = Prisma.ArtistCreateInput;
