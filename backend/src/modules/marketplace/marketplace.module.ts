import { Controller, Get, Injectable, Module, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { CITY_SUGGESTIONS, FORMATS, GENRES, INSTRUMENTS, PAYMENT_TYPES, UF, VENUE_KINDS } from '../../common/domain-lists';
import { notFound } from '../../common/errors';
import { pagination } from '../../common/validation';
import { ApiZodQuery, ZQuery } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';
import { portfolioSelect, publicArtistCardSelect, toArtistCard, toPortfolioItem } from '../artists/artist.presenter';
import { Public } from '../auth/auth.decorators';
import { mediaUrl } from '../media/media.service';
import { orgManageSelect } from '../organizations/organizations.service';
import { RidersService } from '../riders/riders.service';

const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);

export const ArtistSearchSchema = z.object({
  q: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  genre: z.preprocess(emptyToUndef, z.enum(GENRES).optional()),
  city: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  kind: z.preprocess(emptyToUndef, z.enum(['SOLO', 'BAND']).optional()),
  format: z.preprocess(emptyToUndef, z.enum(FORMATS).optional()),
  sort: z.preprocess(emptyToUndef, z.enum(['recent', 'name']).default('recent')),
  ...pagination,
});

export const VenueSearchSchema = z.object({
  q: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  city: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
});

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riders: RidersService,
  ) {}

  /** Apenas perfis PUBLIC. Seleção explícita de campos públicos. */
  async searchArtists(f: z.infer<typeof ArtistSearchSchema>) {
    const where: Prisma.ArtistWhereInput = {
      visibility: 'PUBLIC',
      ...(f.kind ? { kind: f.kind } : {}),
      ...(f.genre ? { genres: { has: f.genre } } : {}),
      ...(f.format ? { formats: { has: f.format } } : {}),
      ...(f.city ? { city: { equals: f.city, mode: 'insensitive' } } : {}),
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: 'insensitive' } },
              { headline: { contains: f.q, mode: 'insensitive' } },
              { bio: { contains: f.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.artist.count({ where }),
      this.prisma.artist.findMany({
        where,
        select: publicArtistCardSelect,
        orderBy: f.sort === 'name' ? [{ name: 'asc' }, { id: 'asc' }] : [{ publishedAt: 'desc' }, { id: 'asc' }],
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
    ]);
    return { total, page: f.page, pageSize: f.pageSize, items: rows.map(toArtistCard) };
  }

  async publicArtist(slug: string) {
    const a = await this.prisma.artist.findFirst({
      where: { slug, visibility: 'PUBLIC' },
      select: {
        ...publicArtistCardSelect,
        bio: true,
        contactEmail: true,
        contactPhone: true,
        instagram: true,
        website: true,
        publishedAt: true,
        musicianProfile: {
          select: {
            mainInstrument: true,
            instruments: true,
            user: {
              select: {
                bandMemberships: {
                  where: { status: 'ACTIVE', band: { artist: { visibility: 'PUBLIC' } } },
                  select: { band: { select: { artist: { select: { slug: true, name: true } } } } },
                },
              },
            },
          },
        },
        band: {
          select: {
            members: {
              where: { status: 'ACTIVE' },
              orderBy: { joinedAt: 'asc' },
              select: {
                instrument: true,
                user: { select: { musicianProfile: { select: { artist: { select: { slug: true, name: true, visibility: true, photoId: true } } } } } },
              },
            },
          },
        },
        portfolioItems: { select: portfolioSelect, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!a) throw notFound('Perfil não encontrado ou não está público.');
    const rider = await this.riders.getRider(a.id);
    const { band, musicianProfile, portfolioItems, bio, contactEmail, contactPhone, instagram, website, publishedAt } = a;
    const members = band?.members ?? [];
    return {
      ...toArtistCard(a),
      bio,
      publishedAt,
      contacts: { email: contactEmail, phone: contactPhone, instagram, website },
      portfolio: portfolioItems.map(toPortfolioItem),
      rider: { notes: rider.notes, items: rider.items },
      // Banda: só integrantes com perfil individual público aparecem nominalmente.
      members: band
        ? {
            total: members.length,
            public: members
              .map((m) => ({ instrument: m.instrument, artist: m.user.musicianProfile?.artist }))
              .filter((m) => m.artist?.visibility === 'PUBLIC')
              .map((m) => ({ slug: m.artist!.slug, name: m.artist!.name, instrument: m.instrument, photoUrl: mediaUrl(m.artist!.photoId) })),
          }
        : null,
      bands: musicianProfile ? musicianProfile.user.bandMemberships.map((m) => m.band.artist!).filter(Boolean) : [],
    };
  }

  async searchVenues(f: z.infer<typeof VenueSearchSchema>) {
    const rows = await this.prisma.organization.findMany({
      where: {
        type: 'VENUE',
        ...(f.city ? { city: { equals: f.city, mode: 'insensitive' } } : {}),
        ...(f.q ? { name: { contains: f.q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
      select: {
        id: true,
        slug: true,
        name: true,
        venueKind: true,
        city: true,
        state: true,
        neighborhood: true,
        capacity: true,
        photoId: true,
        _count: { select: { organizedEvents: { where: { status: 'OPEN', applicationDeadline: { gte: new Date() } } }, equipment: true } },
      },
    });
    return rows.map(({ photoId, _count, ...r }) => ({
      ...r,
      photoUrl: mediaUrl(photoId),
      openEvents: _count.organizedEvents,
      equipmentItems: _count.equipment,
    }));
  }

  async publicVenue(slug: string) {
    const org = await this.prisma.organization.findFirst({ where: { slug, type: 'VENUE' }, select: orgManageSelect });
    if (!org) throw notFound('Casa de show não encontrada.');
    const [equipment, events] = await Promise.all([
      this.riders.getEquipment(org.id),
      this.prisma.event.findMany({
        where: { organizerId: org.id, status: 'OPEN', applicationDeadline: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, title: true, startsAt: true, applicationDeadline: true, slots: true, genres: true },
      }),
    ]);
    const { photoId, createdAt: _c, updatedAt: _u, ...rest } = org;
    return { ...rest, photoUrl: mediaUrl(photoId), equipment: equipment.items, openEvents: events };
  }
}

@ApiTags('public')
@Public()
@Controller('public')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('artists')
  @ApiZodQuery(ArtistSearchSchema)
  artists(@ZQuery(ArtistSearchSchema) q: z.infer<typeof ArtistSearchSchema>) {
    return this.marketplace.searchArtists(q);
  }

  @Get('artists/:slug')
  artist(@Param('slug') slug: string) {
    return this.marketplace.publicArtist(slug.slice(0, 80));
  }

  @Get('venues')
  @ApiZodQuery(VenueSearchSchema)
  venues(@ZQuery(VenueSearchSchema) q: z.infer<typeof VenueSearchSchema>) {
    return this.marketplace.searchVenues(q);
  }

  @Get('venues/:slug')
  venue(@Param('slug') slug: string) {
    return this.marketplace.publicVenue(slug.slice(0, 80));
  }

  @Get('meta')
  meta() {
    return {
      genres: GENRES,
      formats: FORMATS,
      instruments: INSTRUMENTS,
      venueKinds: VENUE_KINDS,
      paymentTypes: PAYMENT_TYPES,
      cities: CITY_SUGGESTIONS,
      states: UF,
    };
  }
}

@Module({ imports: [], controllers: [MarketplaceController], providers: [MarketplaceService, RidersService] })
export class MarketplaceModule {}
