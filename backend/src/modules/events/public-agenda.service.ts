import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { mediaThumbUrl } from '../media/media.service';

const showSelect = {
  id: true,
  title: true,
  organization: { select: { type: true, name: true, slug: true, city: true, state: true, addressLine: true, neighborhood: true } },
  artist: { select: { id: true, name: true, slug: true, kind: true, photoId: true, visibility: true } },
  event: {
    select: {
      id: true,
      title: true,
      visibility: true,
      status: true,
      locationName: true,
      locationCity: true,
      locationState: true,
      venue: { select: { type: true, name: true, slug: true, city: true, state: true, addressLine: true, neighborhood: true } },
    },
  },
  offers: { where: { status: 'ACCEPTED' }, take: 1, select: { performanceAt: true, durationMinutes: true } },
} satisfies Prisma.BookingSelect;

type ShowRow = Prisma.BookingGetPayload<{ select: typeof showSelect }>;

/**
 * Show confirmado é público quando acontece em local público: evento PUBLIC (não cancelado) ou proposta
 * direta de uma casa de show. Propostas de contratante individual (ex.: festa particular) e eventos
 * privados nunca aparecem com detalhes.
 */
export function isPublicShow(b: Pick<ShowRow, 'event' | 'organization'>) {
  if (b.event) return b.event.visibility === 'PUBLIC' && b.event.status !== 'CANCELLED';
  return b.organization.type === 'VENUE';
}

function placeOf(b: ShowRow) {
  const v = b.event?.venue ?? (b.event ? null : b.organization.type === 'VENUE' ? b.organization : null);
  if (v) return { name: v.name, venueSlug: v.type === 'VENUE' ? v.slug : null, city: v.city, state: v.state, address: [v.addressLine, v.neighborhood].filter(Boolean).join(' — ') || null };
  return { name: b.event?.locationName ?? null, venueSlug: null, city: b.event?.locationCity ?? null, state: b.event?.locationState ?? null, address: null };
}

@Injectable()
export class PublicAgendaService {
  constructor(private readonly prisma: PrismaService) {}

  private async confirmedUpcoming(where: Prisma.BookingWhereInput, take: number) {
    const now = new Date();
    const rows = await this.prisma.booking.findMany({
      where: { ...where, status: 'CONFIRMED', performance: null, offers: { some: { status: 'ACCEPTED', performanceAt: { gt: now } } } },
      select: showSelect,
      take: take * 3,
    });
    return rows
      .filter((r) => r.offers[0])
      .sort((a, b) => a.offers[0].performanceAt.getTime() - b.offers[0].performanceAt.getTime());
  }

  /** Home: próximos shows confirmados em locais públicos, com local, horário e artista. */
  async upcomingPublicShows(limit = 12) {
    const rows = await this.confirmedUpcoming({ artist: { visibility: 'PUBLIC' } }, limit);
    return rows
      .filter(isPublicShow)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        title: r.event?.title ?? r.title,
        startsAt: r.offers[0].performanceAt,
        durationMinutes: r.offers[0].durationMinutes,
        place: placeOf(r),
        artist: { name: r.artist.name, slug: r.artist.slug, kind: r.artist.kind, photoUrl: mediaThumbUrl(r.artist.photoId) },
        eventId: r.event?.id ?? null,
      }));
  }

  /** Perfil público do artista: shows públicos com detalhes; privados apenas como "Evento privado". */
  async artistUpcoming(artistId: string, limit = 10) {
    const rows = await this.confirmedUpcoming({ artistId }, limit);
    return rows.slice(0, limit).map((r) =>
      isPublicShow(r)
        ? { private: false as const, startsAt: r.offers[0].performanceAt, title: r.event?.title ?? null, place: placeOf(r), eventId: r.event?.id ?? null }
        : { private: true as const, startsAt: r.offers[0].performanceAt, title: null, place: null, eventId: null },
    );
  }

  /** Página pública da casa: shows confirmados públicos nela. */
  async venueUpcoming(organizationId: string, limit = 10) {
    const rows = await this.confirmedUpcoming(
      { OR: [{ organizationId, eventId: null }, { event: { venueId: organizationId } }], artist: { visibility: 'PUBLIC' } },
      limit,
    );
    return rows
      .filter(isPublicShow)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        title: r.event?.title ?? r.title,
        startsAt: r.offers[0].performanceAt,
        artist: { name: r.artist.name, slug: r.artist.slug, photoUrl: mediaThumbUrl(r.artist.photoId) },
      }));
  }
}
