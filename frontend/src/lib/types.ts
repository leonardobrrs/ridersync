/** Tipos das respostas da API REST (espelham os presenters do backend). */

export type ArtistKind = 'SOLO' | 'BAND';
export type Visibility = 'PUBLIC' | 'PRIVATE';
export type BandRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type OrgRole = 'OWNER' | 'ADMIN';
export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'DECLINED' | 'CANCELLED' | 'REMOVED' | 'LEFT';
export type EventStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
export type BookingStatus = 'NEGOTIATING' | 'AGREED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'SUPERSEDED' | 'WITHDRAWN';
export type Side = 'VENUE' | 'ARTIST';
export type CompatStatus = 'COMPATIBLE' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'NEEDS_CHECK';
export type PortfolioKind = 'AUDIO' | 'VIDEO' | 'PHOTO' | 'DOCUMENT' | 'LINK';

export interface ArtistRef {
  id: string;
  slug: string;
  name: string;
  visibility: Visibility;
}

export interface Me {
  user: { id: string; name: string; email: string; createdAt: string };
  musician: ArtistRef | null;
  bands: { bandId: string; role: BandRole; artist: ArtistRef }[];
  organizations: { id: string; slug: string; name: string; role: OrgRole }[];
  pendingInvitations: number;
}

export interface Meta {
  genres: string[];
  formats: string[];
  instruments: string[];
  venueKinds: string[];
  paymentTypes: string[];
  cities: string[];
  states: string[];
}

export interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  category: string;
}

export interface ArtistCard {
  id: string;
  slug: string;
  kind: ArtistKind;
  name: string;
  headline: string;
  city: string | null;
  state: string;
  genres: string[];
  formats: string[];
  careerStartYear: number | null;
  baseFeeCents: number | null;
  photoUrl: string | null;
  mainInstrument: string | null;
  instruments: string[];
}

export interface PortfolioItem {
  id: string;
  kind: PortfolioKind;
  title: string;
  description: string;
  url: string | null;
  isUpload: boolean;
  file: { mimeType: string; name: string; sizeBytes: number } | null;
  position: number;
}

export interface RiderItem {
  id: string;
  catalogItemId: string | null;
  customName: string | null;
  name: string;
  unit: string;
  category: string | null;
  isCustom: boolean;
  quantity: number;
  notes: string;
}

export interface Rider {
  notes: string;
  updatedAt?: string;
  items: RiderItem[];
}

export interface PublicArtist extends ArtistCard {
  bio: string;
  publishedAt: string | null;
  contacts: { email: string | null; phone: string | null; instagram: string | null; website: string | null };
  portfolio: PortfolioItem[];
  rider: Rider;
  members: { total: number; public: { slug: string; name: string; instrument: string | null; photoUrl: string | null }[] } | null;
  bands: { slug: string; name: string }[];
}

export interface ManagedArtist {
  id: string;
  kind: ArtistKind;
  slug: string;
  name: string;
  headline: string;
  bio: string;
  city: string | null;
  state: string;
  genres: string[];
  formats: string[];
  careerStartYear: number | null;
  baseFeeCents: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  instagram: string | null;
  website: string | null;
  photoUrl: string | null;
  visibility: Visibility;
  publishedAt: string | null;
  bandId: string | null;
  mainInstrument: string | null;
  instruments: string[];
  portfolio: PortfolioItem[];
  publicationIssues: string[];
  access: { canManage: boolean; bandRole: BandRole | null };
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface BandSummary {
  bandId: string;
  role: BandRole;
  memberCount: number;
  artist: { id: string; slug: string; name: string; city: string | null; genres: string[]; visibility: Visibility; photoUrl: string | null };
}

export interface BandMemberRow {
  id: string;
  role: BandRole;
  status: MembershipStatus;
  instrument: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  isMe: boolean;
  name: string;
  email?: string;
  musicianProfile: { slug: string; name: string } | null;
}

export interface BandDetail {
  bandId: string;
  myRole: BandRole;
  artist: ManagedArtist;
  members: BandMemberRow[];
}

export interface Organization {
  id: string;
  type: 'VENUE';
  slug: string;
  name: string;
  venueKind: string | null;
  description: string;
  addressLine: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  instagram: string | null;
  website: string | null;
  photoUrl: string | null;
}

export interface OrgSummary extends Organization {
  role: OrgRole;
  openEvents: number;
  equipmentItems: number;
}

export interface OrgDetail extends Organization {
  myRole: OrgRole;
  members: { id: string; role: OrgRole; status: MembershipStatus; name: string; email?: string; isMe: boolean; joinedAt: string | null }[];
}

export interface OrgPublicRef {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  neighborhood: string | null;
  venueKind: string | null;
  photoUrl: string | null;
}

export interface VenueCard {
  id: string;
  slug: string;
  name: string;
  venueKind: string | null;
  city: string;
  state: string;
  neighborhood: string | null;
  capacity: number | null;
  photoUrl: string | null;
  openEvents: number;
  equipmentItems: number;
}

export interface PublicVenue extends Organization {
  equipment: RiderItem[];
  openEvents: { id: string; title: string; startsAt: string; applicationDeadline: string; slots: number; genres: string[] }[];
}

export interface EventPublic {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number | null;
  applicationDeadline: string;
  slots: number;
  genres: string[];
  paymentType: string | null;
  feeCents: number | null;
  conditions: string;
  requirements: string;
  status: EventStatus;
  publishedAt: string | null;
  organizer: OrgPublicRef;
  venue: OrgPublicRef | null;
  acceptingApplications: boolean;
}

export interface EventManage extends EventPublic {
  organizerId: string;
  venueId: string | null;
  applications: {
    id: string;
    status: ApplicationStatus;
    message: string;
    createdAt: string;
    decidedAt: string | null;
    decisionNote: string | null;
    artist: ArtistCard;
    booking: { id: string; status: BookingStatus } | null;
  }[];
}

export interface OrgEventRow {
  id: string;
  title: string;
  status: EventStatus;
  startsAt: string;
  applicationDeadline: string;
  slots: number;
  applicationCounts: { total: number; pending: number; accepted: number };
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  message: string;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  withdrawnAt: string | null;
  artist: { id: string; name: string; slug: string; kind: ArtistKind };
  event: { id: string; title: string; startsAt: string; applicationDeadline: string; status: EventStatus; organizer: OrgPublicRef };
  booking: { id: string; status: BookingStatus } | null;
}

export interface Offer {
  id: string;
  authorSide: Side;
  performanceAt: string;
  durationMinutes: number;
  feeCents: number;
  terms: string;
  status: OfferStatus;
  createdAt: string;
  respondedAt: string | null;
  previousOfferId: string | null;
  author: { name: string } | null;
  respondedBy: { name: string } | null;
}

export interface BookingRow {
  id: string;
  title: string;
  status: BookingStatus;
  origin: 'DIRECT' | 'APPLICATION';
  createdAt: string;
  updatedAt: string;
  organization: { id: string; name: string; slug: string; city: string };
  artist: { id: string; name: string; slug: string; kind: ArtistKind };
  event: { id: string; title: string } | null;
  latestOffer: { id: string; status: OfferStatus; authorSide: Side; performanceAt: string; feeCents: number } | null;
  performance: { id: string; performedAt: string } | null;
  mySides: Side[];
  awaitingMe: boolean;
}

export interface BookingDetail {
  id: string;
  title: string;
  status: BookingStatus;
  origin: 'DIRECT' | 'APPLICATION';
  createdAt: string;
  confirmedAt: string | null;
  confirmedBy: { name: string } | null;
  applicationId: string | null;
  organization: { id: string; name: string; slug: string; city: string; addressLine: string | null; photoUrl: string | null };
  artist: ArtistCard;
  event: { id: string; title: string; startsAt: string } | null;
  offers: Offer[];
  messages: { id: string; authorSide: Side; body: string; createdAt: string; author: { name: string; isMe: boolean } | null }[];
  statusChanges: { id: string; fromStatus: BookingStatus | null; toStatus: BookingStatus; actorSide: Side | null; note: string | null; createdAt: string; actor: { name: string } | null }[];
  performance: { id: string; performedAt: string; notes: string; createdAt: string; registeredBy: { name: string } | null } | null;
  mySide: Side | null;
  bothSides: boolean;
  pendingOffer: Offer | null;
  agreedOffer: Offer | null;
  allowed: { respond: boolean; confirm: boolean; cancel: boolean; message: boolean; registerPerformance: boolean };
}

export interface CompatibilityResult {
  organization: { id: string; name: string; slug: string };
  riderNotes: string;
  inventoryRegistered: boolean;
  venueCustomItems: { name: string | null; unit: string; quantity: number; notes: string }[];
  items: {
    riderItemId: string;
    catalogItemId: string | null;
    name: string;
    category: string | null;
    unit: string;
    required: number;
    available: number | null;
    missing: number | null;
    status: CompatStatus;
    reason: string;
    riderNotes: string;
    venueNotes: string | null;
  }[];
  summary: Record<CompatStatus, number> & { total: number };
  fullyCompatible: boolean;
}

export interface Invitations {
  bands: { id: string; role: BandRole; instrument: string | null; invitedAt: string; invitedBy: string | null; bandId: string; bandName: string; city: string | null }[];
  organizations: { id: string; role: OrgRole; invitedAt: string; invitedBy: string | null; organizationId: string; organizationName: string; city: string }[];
}

export interface ScheduleItem {
  id: string;
  title: string;
  confirmedAt: string | null;
  performanceAt: string;
  durationMinutes: number;
  feeCents: number;
  artist: { name: string; slug: string };
  organization: { name: string; slug: string; city: string };
}

export interface Schedule {
  upcoming: ScheduleItem[];
  awaitingRegistration: ScheduleItem[];
  history: { id: string; performedAt: string; notes: string; bookingId: string; artist: { name: string; slug: string }; organization: { name: string; slug: string; city: string } }[];
}

export interface Dashboard {
  invitations: number;
  myPendingApplications: number;
  applicationsToReview: { id: string; createdAt: string; artist: { name: string }; event: { id: string; title: string } }[];
  awaitingMe: BookingRow[];
  activeNegotiations: number;
  upcoming: ScheduleItem[];
  profileCompleteness: { artistId: string; percent: number; checks: { label: string; done: boolean }[] } | null;
  hasMusicianProfile: boolean;
  managesBands: boolean;
  managesVenues: boolean;
}
