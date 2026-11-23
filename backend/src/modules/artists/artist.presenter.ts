import { Prisma } from '@prisma/client';
import { mediaThumbUrl, mediaUrl } from '../media/media.service';
import { publicationIssues } from './artist.schemas';

/** Seleção explícita de campos públicos — nunca serializar o registro Prisma inteiro. */
export const publicArtistCardSelect = {
  id: true,
  slug: true,
  kind: true,
  name: true,
  headline: true,
  city: true,
  state: true,
  genres: true,
  formats: true,
  careerStartYear: true,
  baseFeeCents: true,
  photoId: true,
  musicianProfile: { select: { mainInstrument: true, instruments: true } },
} satisfies Prisma.ArtistSelect;

export type PublicArtistCardRow = Prisma.ArtistGetPayload<{ select: typeof publicArtistCardSelect }>;

export function toArtistCard(a: PublicArtistCardRow) {
  return {
    id: a.id,
    slug: a.slug,
    kind: a.kind,
    name: a.name,
    headline: a.headline,
    city: a.city,
    state: a.state,
    genres: a.genres,
    formats: a.formats,
    careerStartYear: a.careerStartYear,
    baseFeeCents: a.baseFeeCents,
    photoUrl: mediaThumbUrl(a.photoId),
    photoLargeUrl: mediaUrl(a.photoId),
    mainInstrument: a.musicianProfile?.mainInstrument ?? null,
    instruments: a.musicianProfile?.instruments ?? [],
  };
}

export const portfolioSelect = {
  id: true,
  kind: true,
  title: true,
  description: true,
  url: true,
  thumbnailUrl: true,
  mediaId: true,
  position: true,
  media: { select: { mimeType: true, originalName: true, sizeBytes: true } },
} satisfies Prisma.PortfolioItemSelect;

export function toPortfolioItem(p: Prisma.PortfolioItemGetPayload<{ select: typeof portfolioSelect }>) {
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    description: p.description,
    url: p.url ?? mediaUrl(p.mediaId),
    thumbnailUrl: p.thumbnailUrl ?? (p.media?.mimeType.startsWith('image/') ? mediaThumbUrl(p.mediaId) : null),
    isUpload: !!p.mediaId,
    file: p.media ? { mimeType: p.media.mimeType, name: p.media.originalName, sizeBytes: p.media.sizeBytes } : null,
    position: p.position,
  };
}

export const managedArtistSelect = {
  id: true,
  kind: true,
  slug: true,
  name: true,
  headline: true,
  bio: true,
  city: true,
  state: true,
  genres: true,
  formats: true,
  careerStartYear: true,
  baseFeeCents: true,
  contactEmail: true,
  showContactEmail: true,
  contactPhone: true,
  instagram: true,
  website: true,
  photoId: true,
  visibility: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  bandId: true,
  musicianProfile: { select: { mainInstrument: true, instruments: true } },
  portfolioItems: { select: portfolioSelect, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.ArtistSelect;

export type ManagedArtistRow = Prisma.ArtistGetPayload<{ select: typeof managedArtistSelect }>;

/** Visão privada (para quem administra/participa): inclui pendências de publicação. */
export function toManagedArtist(a: ManagedArtistRow) {
  const { photoId, portfolioItems, musicianProfile, ...rest } = a;
  return {
    ...rest,
    photoUrl: mediaUrl(photoId),
    mainInstrument: musicianProfile?.mainInstrument ?? null,
    instruments: musicianProfile?.instruments ?? [],
    portfolio: portfolioItems.map(toPortfolioItem),
    publicationIssues: publicationIssues(a),
  };
}
