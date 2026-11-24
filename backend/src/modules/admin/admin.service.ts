import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { notFound } from '../../common/errors';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';

const TAKE = 50;
const ACTIVE = 'ACTIVE' as const;
const contains = (q?: string) => (q?.trim() ? { contains: q.trim(), mode: Prisma.QueryMode.insensitive } : undefined);

type MediaRef = { id: string; storageKey: string; thumbKey: string | null } | null | undefined;
const mediaSel = { select: { id: true, storageKey: true, thumbKey: true } } as const;

/**
 * Administração para limpeza de dados (ex.: depois de testes), sem resetar o banco.
 * Exclusões são DEFINITIVAS (hard delete) e em transação; os arquivos de mídia saem do storage depois do commit.
 * O banco já apaga em cascata o que depende de cada registro (candidaturas, negociações, contratos, mensagens…).
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  // ─────────────── Leitura ───────────────

  async overview() {
    const [users, solo, bands, venues, individuals, events, bookings, contracts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.artist.count({ where: { kind: 'SOLO' } }),
      this.prisma.artist.count({ where: { kind: 'BAND' } }),
      this.prisma.organization.count({ where: { type: 'VENUE' } }),
      this.prisma.organization.count({ where: { type: 'INDIVIDUAL' } }),
      this.prisma.event.count(),
      this.prisma.booking.count(),
      this.prisma.contract.count(),
    ]);
    return { users, solo, bands, venues, individuals, events, bookings, contracts };
  }

  async users(q?: string) {
    const c = contains(q);
    const rows = await this.prisma.user.findMany({
      where: c ? { OR: [{ name: c }, { email: c }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: TAKE,
      select: {
        id: true,
        name: true,
        email: true,
        accountType: true,
        createdAt: true,
        anonymizedAt: true,
        musicianProfile: { select: { artist: { select: { name: true } } } },
        bandMemberships: { where: { status: ACTIVE }, select: { role: true, band: { select: { artist: { select: { name: true } } } } } },
        orgMemberships: { where: { status: ACTIVE }, select: { role: true, organization: { select: { name: true, type: true } } } },
      },
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      accountType: u.accountType,
      createdAt: u.createdAt,
      anonymized: !!u.anonymizedAt,
      profile: u.musicianProfile?.artist?.name ?? null,
      bands: u.bandMemberships.map((m) => ({ name: m.band.artist?.name ?? 'Banda', role: m.role })),
      organizations: u.orgMemberships.map((m) => ({ name: m.organization.name, type: m.organization.type, role: m.role })),
    }));
  }

  async artists(q?: string) {
    const c = contains(q);
    const rows = await this.prisma.artist.findMany({
      where: c ? { OR: [{ name: c }, { slug: c }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: TAKE,
      select: {
        id: true,
        kind: true,
        name: true,
        slug: true,
        city: true,
        visibility: true,
        createdAt: true,
        musicianProfile: { select: { user: { select: { name: true, email: true } } } },
        band: { select: { members: { where: { status: ACTIVE }, select: { role: true, user: { select: { name: true } } } } } },
        _count: { select: { applications: true, bookings: true } },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      slug: a.slug,
      city: a.city,
      visibility: a.visibility,
      createdAt: a.createdAt,
      owner: a.musicianProfile?.user ?? null,
      members: a.band?.members.map((m) => ({ name: m.user.name, role: m.role })) ?? [],
      applications: a._count.applications,
      bookings: a._count.bookings,
    }));
  }

  async organizations(q?: string) {
    const c = contains(q);
    const rows = await this.prisma.organization.findMany({
      where: c ? { OR: [{ name: c }, { slug: c }, { city: c }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: TAKE,
      select: {
        id: true,
        type: true,
        name: true,
        slug: true,
        city: true,
        createdAt: true,
        members: { where: { status: ACTIVE }, select: { role: true, user: { select: { name: true, email: true } } } },
        _count: { select: { organizedEvents: true, bookings: true } },
      },
    });
    return rows.map((o) => ({
      id: o.id,
      type: o.type,
      name: o.name,
      slug: o.slug,
      city: o.city,
      createdAt: o.createdAt,
      members: o.members.map((m) => ({ name: m.user.name, email: m.user.email, role: m.role })),
      events: o._count.organizedEvents,
      bookings: o._count.bookings,
    }));
  }

  async events(q?: string) {
    const c = contains(q);
    const rows = await this.prisma.event.findMany({
      where: c ? { OR: [{ title: c }, { organizer: { name: c } }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: TAKE,
      select: {
        id: true,
        title: true,
        status: true,
        visibility: true,
        startsAt: true,
        createdAt: true,
        organizer: { select: { name: true, type: true } },
        _count: { select: { applications: true, bookings: true } },
      },
    });
    return rows.map((e) => ({ ...e, organizer: e.organizer.name, organizerType: e.organizer.type, applications: e._count.applications, bookings: e._count.bookings, _count: undefined }));
  }

  async bookings(q?: string) {
    const c = contains(q);
    const rows = await this.prisma.booking.findMany({
      where: c ? { OR: [{ title: c }, { artist: { name: c } }, { organization: { name: c } }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: TAKE,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        artist: { select: { name: true } },
        organization: { select: { name: true } },
        event: { select: { title: true } },
        contract: { select: { id: true } },
        _count: { select: { messages: true, offers: true } },
      },
    });
    return rows.map((b) => ({
      id: b.id,
      title: b.title,
      status: b.status,
      createdAt: b.createdAt,
      artist: b.artist.name,
      organization: b.organization.name,
      event: b.event?.title ?? null,
      hasContract: !!b.contract,
      messages: b._count.messages,
      offers: b._count.offers,
    }));
  }

  // ─────────────── Exclusão ───────────────

  async deleteBooking(id: string) {
    await this.run(async (tx) => {
      await this.mustExist(tx.booking.count({ where: { id } }));
      await tx.booking.delete({ where: { id } });
    });
    return { deleted: 'booking', id };
  }

  async deleteEvent(id: string) {
    await this.run(async (tx, keys) => this.purgeEvent(tx, id, keys));
    return { deleted: 'event', id };
  }

  async deleteArtist(id: string) {
    await this.run(async (tx, keys) => this.purgeArtist(tx, id, keys));
    return { deleted: 'artist', id };
  }

  async deleteOrganization(id: string) {
    await this.run(async (tx, keys) => this.purgeOrganization(tx, id, keys));
    return { deleted: 'organization', id };
  }

  /**
   * Conta: apaga também bandas e casas em que ela é a única integrante ativa. Onde há outras pessoas, o grupo
   * continua; se a conta era a proprietária, a propriedade passa para quem está há mais tempo (administradores primeiro).
   */
  async deleteUser(id: string) {
    await this.run(async (tx, keys) => {
      const user = await tx.user.findUnique({ where: { id }, select: { email: true } });
      if (!user) throw notFound('Conta não encontrada.');

      const bands = await tx.bandMember.findMany({ where: { userId: id, status: ACTIVE }, select: { bandId: true, role: true } });
      for (const m of bands) {
        const others = await tx.bandMember.findMany({
          where: { bandId: m.bandId, status: ACTIVE, userId: { not: id } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true },
        });
        if (others.length === 0) {
          const artist = await tx.artist.findUnique({ where: { bandId: m.bandId }, select: { id: true } });
          if (artist) await this.purgeArtist(tx, artist.id, keys);
          else await tx.band.delete({ where: { id: m.bandId } });
        } else if (m.role === 'OWNER' && !others.some((o) => o.role === 'OWNER')) {
          const heir = others.find((o) => o.role === 'ADMIN') ?? others[0];
          await tx.bandMember.update({ where: { id: heir.id }, data: { role: 'OWNER' } });
        }
      }

      const orgs = await tx.organizationMember.findMany({ where: { userId: id, status: ACTIVE }, select: { organizationId: true, role: true } });
      for (const m of orgs) {
        const others = await tx.organizationMember.findMany({
          where: { organizationId: m.organizationId, status: ACTIVE, userId: { not: id } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true },
        });
        if (others.length === 0) await this.purgeOrganization(tx, m.organizationId, keys);
        else if (m.role === 'OWNER' && !others.some((o) => o.role === 'OWNER')) {
          await tx.organizationMember.update({ where: { id: (others.find((o) => o.role === 'ADMIN') ?? others[0]).id }, data: { role: 'OWNER' } });
        }
      }

      // Perfil individual: a cascata do usuário apaga o perfil, mas a mídia do artista é removida aqui.
      const solo = await tx.musicianProfile.findUnique({ where: { userId: id }, select: { artist: { select: { id: true } } } });
      if (solo?.artist) await this.purgeArtist(tx, solo.artist.id, keys);

      // Tudo que a conta enviou (avatar, fotos, portfólio) sai junto com ela (cascade); guardamos as chaves antes.
      const uploads = await tx.mediaAsset.findMany({ where: { uploadedById: id }, select: { storageKey: true, thumbKey: true } });
      for (const u of uploads) keys.push(u.storageKey, ...(u.thumbKey ? [u.thumbKey] : []));
      await tx.emailOutbox.deleteMany({ where: { toEmail: user.email } });
      await tx.user.delete({ where: { id } });
    });
    return { deleted: 'user', id };
  }

  // ─────────────── internos ───────────────

  private async run(fn: (tx: Tx, keys: string[]) => Promise<unknown>) {
    const keys: string[] = [];
    await this.prisma.$transaction((tx) => fn(tx, keys), { timeout: 60_000 });
    await Promise.all([...new Set(keys)].map((k) => this.media.removeObject(k)));
    return keys;
  }

  private async mustExist(count: Promise<number>) {
    if ((await count) === 0) throw notFound();
  }

  /** Apaga as mídias (registro agora; arquivo depois do commit). */
  private async dropMedia(tx: Tx, refs: MediaRef[], keys: string[]) {
    const ids = [...new Set(refs.filter((r): r is NonNullable<MediaRef> => !!r).map((r) => r.id))];
    for (const r of refs) if (r) keys.push(r.storageKey, ...(r.thumbKey ? [r.thumbKey] : []));
    if (ids.length) await tx.mediaAsset.deleteMany({ where: { id: { in: ids } } });
  }

  /** Evento + negociações ligadas a ele (que, sem o evento, ficariam soltas). Candidaturas saem em cascata. */
  private async purgeEvent(tx: Tx, id: string, keys: string[]) {
    const ev = await tx.event.findUnique({ where: { id }, select: { image: mediaSel } });
    if (!ev) throw notFound('Evento não encontrado.');
    await tx.booking.deleteMany({ where: { eventId: id } });
    await tx.event.delete({ where: { id } });
    await this.dropMedia(tx, [ev.image], keys);
  }

  /** Perfil individual ou banda (a identidade artística sai em cascata, com rider, portfólio, candidaturas e negociações). */
  private async purgeArtist(tx: Tx, id: string, keys: string[]) {
    const a = await tx.artist.findUnique({
      where: { id },
      select: { kind: true, bandId: true, musicianProfileId: true, photo: mediaSel, portfolioItems: { select: { media: mediaSel } } },
    });
    if (!a) throw notFound('Artista não encontrado.');
    const media = [a.photo, ...a.portfolioItems.map((p) => p.media)];
    if (a.bandId) await tx.band.delete({ where: { id: a.bandId } });
    else if (a.musicianProfileId) await tx.musicianProfile.delete({ where: { id: a.musicianProfileId } });
    else await tx.artist.delete({ where: { id } });
    await this.dropMedia(tx, media, keys);
  }

  /** Casa ou contratante: eventos organizados, negociações, inventário e vínculos saem em cascata. */
  private async purgeOrganization(tx: Tx, id: string, keys: string[]) {
    const org = await tx.organization.findUnique({ where: { id }, select: { photo: mediaSel, organizedEvents: { select: { image: mediaSel } } } });
    if (!org) throw notFound('Organização não encontrada.');
    await tx.organization.delete({ where: { id } });
    await this.dropMedia(tx, [org.photo, ...org.organizedEvents.map((e) => e.image)], keys);
  }
}
