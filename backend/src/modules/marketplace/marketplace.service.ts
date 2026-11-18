import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { FORMATS, GENRES, INSTRUMENTS, VENUE_KINDS } from '../../common/domain-lists';
import { notFound } from '../../common/errors';
import { pagination } from '../../common/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { portfolioSelect, publicArtistCardSelect, toArtistCard, toPortfolioItem } from '../artists/artist.presenter';
import { EventLifecycleService } from '../events/event-lifecycle.service';
import { EventsService } from '../events/events.service';
import { PublicAgendaService } from '../events/public-agenda.service';
import { mediaThumbUrl, mediaUrl } from '../media/media.service';
import { orgManageSelect } from '../organizations/organizations.service';
import { RidersService } from '../riders/riders.service';

const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);

export const ArtistSearchSchema = z.object({
  q: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  genre: z.preprocess(emptyToUndef, z.enum(GENRES).optional()),
  city: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  kind: z.preprocess(emptyToUndef, z.enum(['SOLO', 'BAND']).optional()),
  format: z.preprocess(emptyToUndef, z.enum(FORMATS).optional()),
  instrument: z.preprocess(emptyToUndef, z.enum(INSTRUMENTS).optional()),
  sort: z.preprocess(emptyToUndef, z.enum(['recent', 'name']).default('recent')),
  ...pagination,
});

export const VenueSearchSchema = z.object({
  q: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  city: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  kind: z.preprocess(emptyToUndef, z.enum(VENUE_KINDS).optional()),
});

const venueCardSelect = {
  id: true,
  slug: true,
  name: true,
  venueKind: true,
  city: true,
  state: true,
  neighborhood: true,
  capacity: true,
  photoId: true,
} satisfies Prisma.OrganizationSelect;

/** Eventos que aparecem para visitantes: públicos, com inscrições abertas e prazo vigente. */
const openPublicEvents = (): Prisma.EventWhereInput => ({ status: 'OPEN', visibility: 'PUBLIC', applicationDeadline: { gte: new Date() } });

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riders: RidersService,
    private readonly agenda: PublicAgendaService,
    private readonly events: EventsService,
    private readonly lifecycle: EventLifecycleService,
  ) {}

  /** Página inicial (modelo de classificados): shows confirmados, oportunidades públicas, artistas e casas. */
  async home() {
    await this.lifecycle.sweepIfStale();
    const [shows, opportunities, artists, venues, totals] = await Promise.all([
      this.agenda.upcomingPublicShows(8),
      this.events.search({}, null).then((rows) => rows.slice(0, 6)),
      this.prisma.artist.findMany({ where: { visibility: 'PUBLIC' }, select: publicArtistCardSelect, orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }], take: 8 }),
      this.prisma.organization.findMany({ where: { type: 'VENUE' }, select: venueCardSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 6 }),
      Promise.all([
        this.prisma.artist.count({ where: { visibility: 'PUBLIC' } }),
        this.prisma.organization.count({ where: { type: 'VENUE' } }),
        this.prisma.event.count({ where: openPublicEvents() }),
      ]),
    ]);
    return {
      shows,
      opportunities,
      artists: artists.map(toArtistCard),
      venues: venues.map(({ photoId, ...v }) => ({ ...v, photoUrl: mediaThumbUrl(photoId) })),
      totals: { artists: totals[0], venues: totals[1], openOpportunities: totals[2] },
    };
  }

  /** Apenas perfis PUBLIC. Seleção explícita de campos públicos. */
  async searchArtists(f: z.infer<typeof ArtistSearchSchema>) {
    const where: Prisma.ArtistWhereInput = {
      visibility: 'PUBLIC',
      ...(f.kind ? { kind: f.kind } : {}),
      ...(f.genre ? { genres: { has: f.genre } } : {}),
      ...(f.format ? { formats: { has: f.format } } : {}),
      ...(f.instrument
        ? { kind: 'SOLO', musicianProfile: { OR: [{ mainInstrument: f.instrument }, { instruments: { has: f.instrument } }] } }
        : {}),
      ...(f.city ? { city: { equals: f.city, mode: 'insensitive' } } : {}),
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: 'insensitive' } },
              { slug: { contains: f.q.replace(/^@/, ''), mode: 'insensitive' } },
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
    const [rider, upcoming] = await Promise.all([this.riders.getRider(a.id), this.agenda.artistUpcoming(a.id)]);
    const { band, musicianProfile, portfolioItems, bio, contactEmail, contactPhone, instagram, website, publishedAt } = a;
    const members = band?.members ?? [];
    return {
      ...toArtistCard(a),
      bio,
      publishedAt,
      contacts: { email: contactEmail, phone: contactPhone, instagram, website },
      portfolio: portfolioItems.map(toPortfolioItem),
      rider: { notes: rider.notes, items: rider.items },
      upcomingEvents: upcoming,
      // Banda: só integrantes com perfil individual público aparecem nominalmente.
      members: band
        ? {
            total: members.length,
            public: members
              .map((m) => ({ instrument: m.instrument, artist: m.user.musicianProfile?.artist }))
              .filter((m) => m.artist?.visibility === 'PUBLIC')
              .map((m) => ({ slug: m.artist!.slug, name: m.artist!.name, instrument: m.instrument, photoUrl: mediaThumbUrl(m.artist!.photoId) })),
          }
        : null,
      bands: musicianProfile ? musicianProfile.user.bandMemberships.map((m) => m.band.artist!).filter(Boolean) : [],
    };
  }

  async searchVenues(f: z.infer<typeof VenueSearchSchema>) {
    const rows = await this.prisma.organization.findMany({
      where: {
        type: 'VENUE',
        ...(f.kind ? { venueKind: f.kind } : {}),
        ...(f.city ? { city: { equals: f.city, mode: 'insensitive' } } : {}),
        ...(f.q
          ? {
              OR: [
                { name: { contains: f.q, mode: 'insensitive' } },
                { slug: { contains: f.q.replace(/^@/, ''), mode: 'insensitive' } },
                { neighborhood: { contains: f.q, mode: 'insensitive' } },
                { description: { contains: f.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
      select: { ...venueCardSelect, _count: { select: { organizedEvents: { where: openPublicEvents() }, equipment: true } } },
    });
    return rows.map(({ photoId, _count, ...r }) => ({
      ...r,
      photoUrl: mediaThumbUrl(photoId),
      openEvents: _count.organizedEvents,
      equipmentItems: _count.equipment,
    }));
  }

  async publicVenue(slug: string) {
    const org = await this.prisma.organization.findFirst({ where: { slug, type: 'VENUE' }, select: orgManageSelect });
    if (!org) throw notFound('Casa de show não encontrada.');
    const [equipment, events, upcomingShows] = await Promise.all([
      this.riders.getEquipment(org.id),
      this.prisma.event.findMany({
        where: { organizerId: org.id, ...openPublicEvents() },
        orderBy: { startsAt: 'asc' },
        select: { id: true, title: true, startsAt: true, applicationDeadline: true, slots: true, genres: true },
      }),
      this.agenda.venueUpcoming(org.id),
    ]);
    const { photoId, createdAt: _c, updatedAt: _u, type: _t, ...rest } = org;
    return { ...rest, photoUrl: mediaUrl(photoId), photoThumbUrl: mediaThumbUrl(photoId), equipment: equipment.items, openEvents: events, upcomingShows };
  }
}
