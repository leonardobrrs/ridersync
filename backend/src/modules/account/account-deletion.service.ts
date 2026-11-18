import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { conflict, unauthorized } from '../../common/errors';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { verifyPassword } from '../auth/password';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

export const DeleteAccountSchema = z
  .object({
    password: z.string().max(128).optional(),
    confirmation: z.literal('EXCLUIR', { error: 'Digite EXCLUIR para confirmar.' }),
  })
  .strict();

const OPEN_BOOKING = ['NEGOTIATING', 'AGREED', 'CONFIRMED'] as const;

/**
 * Exclusão de conta a pedido do titular (LGPD art. 18, VI).
 *  - Dados pessoais da conta são removidos/anonimizados; sessões, tokens e notificações são apagados.
 *  - Perfis sem histórico com terceiros são apagados. Perfis com negociações registradas são anonimizados
 *    (o registro da negociação é mantido para a contraparte — LGPD art. 16, II e art. 7º, V/IX).
 *  - Bloqueia se a pessoa é a única proprietária de banda/casa com outros integrantes (transferir antes).
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
  ) {}

  async delete(userId: string, input: z.infer<typeof DeleteAccountSchema>) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    if (user.passwordHash) {
      const { ok } = await verifyPassword(input.password ?? '', user.passwordHash);
      if (!ok) throw unauthorized('INVALID_CREDENTIALS', 'Senha incorreta.');
    }
    const storageKeys: string[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        await this.assertNoOrphanedGroups(tx, userId);
        await this.handleBands(tx, userId, storageKeys);
        await this.handleOrganizations(tx, userId, storageKeys);
        await this.handleSoloProfile(tx, userId, storageKeys);
        await this.anonymizeUser(tx, userId, storageKeys);
      },
      { timeout: 30_000 },
    );
    await Promise.all(storageKeys.map((k) => this.media.removeObject(k)));
    await this.notifications.flush();
  }

  private async assertNoOrphanedGroups(tx: Tx, userId: string) {
    const ownedBands = await tx.bandMember.findMany({
      where: { userId, status: 'ACTIVE', role: 'OWNER' },
      select: { band: { select: { artist: { select: { name: true } }, members: { where: { status: 'ACTIVE' }, select: { userId: true, role: true } } } } },
    });
    const ownedOrgs = await tx.organizationMember.findMany({
      where: { userId, status: 'ACTIVE', role: 'OWNER' },
      select: { organization: { select: { name: true, members: { where: { status: 'ACTIVE' }, select: { userId: true, role: true } } } } },
    });
    const blocked = [
      ...ownedBands.filter((b) => soleOwnerWithOthers(b.band.members, userId)).map((b) => b.band.artist?.name ?? 'banda'),
      ...ownedOrgs.filter((o) => soleOwnerWithOthers(o.organization.members, userId)).map((o) => o.organization.name),
    ];
    if (blocked.length) {
      throw conflict(
        'TRANSFER_OWNERSHIP_FIRST',
        `Transfira a propriedade antes de excluir a conta: ${blocked.join(', ')}. Outros integrantes continuam ativos.`,
      );
    }
  }

  private async handleBands(tx: Tx, userId: string, storageKeys: string[]) {
    const memberships = await tx.bandMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { id: true, bandId: true, band: { select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } }, artist: { select: { id: true } } } } },
    });
    for (const m of memberships) {
      const alone = m.band.members.every((x) => x.userId === userId);
      if (alone && m.band.artist) await this.retireArtist(tx, m.band.artist.id, userId, storageKeys, () => tx.band.delete({ where: { id: m.bandId } }));
      await tx.bandMember.updateMany({ where: { id: m.id }, data: { status: 'LEFT', endedAt: new Date() } });
    }
    await tx.bandMember.updateMany({ where: { userId, status: 'INVITED' }, data: { status: 'DECLINED', respondedAt: new Date() } });
  }

  private async handleOrganizations(tx: Tx, userId: string, storageKeys: string[]) {
    const memberships = await tx.organizationMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { id: true, organizationId: true, organization: { select: { type: true, photo: { select: { id: true, storageKey: true, thumbKey: true } }, members: { where: { status: 'ACTIVE' }, select: { userId: true } } } } },
    });
    for (const m of memberships) {
      const org = m.organization;
      if (org.members.every((x) => x.userId === userId)) {
        const bookings = await tx.booking.count({ where: { organizationId: m.organizationId } });
        if (bookings === 0) {
          await tx.organization.delete({ where: { id: m.organizationId } });
          if (org.photo) {
            pushKeys(storageKeys, org.photo);
            await tx.mediaAsset.delete({ where: { id: org.photo.id } });
          }
          continue;
        }
        await this.closeOpenBookings(tx, { organizationId: m.organizationId }, userId, 'VENUE');
        await tx.event.updateMany({
          where: { organizerId: m.organizationId, status: { in: ['DRAFT', 'OPEN', 'FILLED', 'CLOSED', 'POSTPONED'] } },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        if (org.photo) pushKeys(storageKeys, org.photo);
        await tx.organization.update({
          where: { id: m.organizationId },
          data: {
            photoId: null,
            contactEmail: null,
            contactPhone: null,
            instagram: null,
            website: null,
            ...(org.type === 'INDIVIDUAL' ? { name: 'Contratante removido', description: '', addressLine: null, neighborhood: null } : {}),
          },
        });
        if (org.photo) await tx.mediaAsset.delete({ where: { id: org.photo.id } });
      }
      await tx.organizationMember.updateMany({ where: { id: m.id }, data: { status: 'LEFT', endedAt: new Date() } });
    }
    await tx.organizationMember.updateMany({ where: { userId, status: 'INVITED' }, data: { status: 'DECLINED', respondedAt: new Date() } });
  }

  private async handleSoloProfile(tx: Tx, userId: string, storageKeys: string[]) {
    const profile = await tx.musicianProfile.findUnique({ where: { userId }, select: { id: true, artist: { select: { id: true } } } });
    if (!profile) return;
    if (!profile.artist) {
      await tx.musicianProfile.delete({ where: { id: profile.id } });
      return;
    }
    await this.retireArtist(tx, profile.artist.id, userId, storageKeys, () => tx.musicianProfile.delete({ where: { id: profile.id } }));
  }

  /** Apaga a identidade artística sem histórico; com histórico, encerra pendências e anonimiza. */
  private async retireArtist(tx: Tx, artistId: string, userId: string, storageKeys: string[], deleteOwner: () => Promise<unknown>) {
    const artist = await tx.artist.findUniqueOrThrow({
      where: { id: artistId },
      select: {
        photo: { select: { id: true, storageKey: true, thumbKey: true } },
        portfolioItems: { select: { media: { select: { id: true, storageKey: true, thumbKey: true } } } },
        _count: { select: { bookings: true } },
      },
    });
    if (artist.photo) pushKeys(storageKeys, artist.photo);
    for (const p of artist.portfolioItems) if (p.media) pushKeys(storageKeys, p.media);
    const mediaIds = [artist.photo?.id, ...artist.portfolioItems.map((p) => p.media?.id)].filter((x): x is string => !!x);
    if (artist._count.bookings === 0) {
      await deleteOwner();
      if (mediaIds.length) await tx.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
      return;
    }
    await this.closeOpenBookings(tx, { artistId }, userId, 'ARTIST');
    await tx.eventApplication.updateMany({ where: { artistId, status: { in: ['PENDING', 'ACCEPTED'] }, booking: null }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
    await tx.portfolioItem.deleteMany({ where: { artistId } });
    await tx.riderItem.deleteMany({ where: { rider: { artistId } } });
    await tx.artist.update({
      where: { id: artistId },
      data: {
        name: 'Artista removido',
        slug: `removido-${randomBytes(6).toString('hex')}`,
        headline: '',
        bio: '',
        city: null,
        contactEmail: null,
        contactPhone: null,
        instagram: null,
        website: null,
        photoId: null,
        visibility: 'PRIVATE',
      },
    });
    if (mediaIds.length) await tx.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
  }

  private async closeOpenBookings(tx: Tx, where: { artistId?: string; organizationId?: string }, userId: string, side: 'ARTIST' | 'VENUE') {
    const open = await tx.booking.findMany({
      where: { ...where, status: { in: [...OPEN_BOOKING] } },
      select: { id: true, status: true, title: true, organizationId: true, artistId: true, applicationId: true },
    });
    for (const b of open) {
      await tx.bookingOffer.updateMany({ where: { bookingId: b.id, status: 'PENDING' }, data: { status: 'WITHDRAWN', respondedAt: new Date() } });
      await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED' } });
      await tx.bookingStatusChange.create({
        data: { bookingId: b.id, fromStatus: b.status, toStatus: 'CANCELLED', actorId: userId, actorSide: side, note: 'Conta excluída pelo titular' },
      });
      if (b.applicationId) await tx.eventApplication.updateMany({ where: { id: b.applicationId, status: 'ACCEPTED' }, data: { status: 'CANCELLED' } });
      const counterpart =
        side === 'ARTIST'
          ? await tx.organizationMember.findMany({ where: { organizationId: b.organizationId, status: 'ACTIVE' }, select: { userId: true } })
          : await tx.artist
              .findUnique({
                where: { id: b.artistId },
                select: { musicianProfile: { select: { userId: true } }, band: { select: { members: { where: { status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } }, select: { userId: true } } } } },
              })
              .then((a) => (a?.musicianProfile ? [a.musicianProfile] : (a?.band?.members ?? [])));
      await this.notifications.notify(
        tx,
        counterpart.map((c) => c.userId).filter((id) => id !== userId),
        {
          category: 'BOOKINGS',
          type: 'BOOKING_CANCELLED',
          title: 'Negociação encerrada',
          body: `"${b.title}" foi encerrada porque a outra parte excluiu a conta.`,
          link: `/painel/negociacoes/${b.id}`,
          dedupeKey: `booking-cancelled:${b.id}`,
        },
      );
    }
  }

  private async anonymizeUser(tx: Tx, userId: string, storageKeys: string[]) {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { avatar: { select: { id: true, storageKey: true, thumbKey: true } } } });
    if (u.avatar) pushKeys(storageKeys, u.avatar);
    await tx.session.deleteMany({ where: { userId } });
    await tx.userToken.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Usuário removido',
        email: `removido-${userId}@anonimizado.invalid`,
        passwordHash: null,
        googleSub: null,
        avatarId: null,
        emailVerifiedAt: null,
        termsVersion: null,
        failedLoginCount: 0,
        lockedUntil: null,
        anonymizedAt: new Date(),
      },
    });
    if (u.avatar) await tx.mediaAsset.delete({ where: { id: u.avatar.id } });
  }
}

function soleOwnerWithOthers(members: { userId: string; role: string }[], userId: string) {
  const owners = members.filter((m) => m.role === 'OWNER');
  return owners.length === 1 && owners[0].userId === userId && members.some((m) => m.userId !== userId);
}

function pushKeys(keys: string[], media: { storageKey: string; thumbKey: string | null }) {
  keys.push(media.storageKey);
  if (media.thumbKey) keys.push(media.thumbKey);
}
