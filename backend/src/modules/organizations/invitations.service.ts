import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Convites pendentes recebidos pela conta (bandas e casas). */
@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const [bandInvites, orgInvites] = await Promise.all([
      this.prisma.bandMember.findMany({
        where: { userId, status: 'INVITED' },
        orderBy: { invitedAt: 'desc' },
        select: {
          id: true,
          role: true,
          instrument: true,
          invitedAt: true,
          invitedBy: { select: { name: true } },
          band: { select: { id: true, artist: { select: { name: true, slug: true, city: true } } } },
        },
      }),
      this.prisma.organizationMember.findMany({
        where: { userId, status: 'INVITED' },
        orderBy: { invitedAt: 'desc' },
        select: {
          id: true,
          role: true,
          invitedAt: true,
          invitedBy: { select: { name: true } },
          organization: { select: { id: true, name: true, slug: true, city: true } },
        },
      }),
    ]);
    return {
      bands: bandInvites.map((i) => ({
        id: i.id,
        role: i.role,
        instrument: i.instrument,
        invitedAt: i.invitedAt,
        invitedBy: i.invitedBy?.name ?? null,
        bandId: i.band.id,
        bandName: i.band.artist?.name ?? 'Banda',
        city: i.band.artist?.city ?? null,
      })),
      organizations: orgInvites.map((i) => ({
        id: i.id,
        role: i.role,
        invitedAt: i.invitedAt,
        invitedBy: i.invitedBy?.name ?? null,
        organizationId: i.organization.id,
        organizationName: i.organization.name,
        city: i.organization.city,
      })),
    };
  }
}
