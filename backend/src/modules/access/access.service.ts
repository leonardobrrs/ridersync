import { Global, Injectable, Module } from '@nestjs/common';
import { BandRole, OrgRole } from '@prisma/client';
import { forbidden, notFound } from '../../common/errors';
import { PrismaService, Tx } from '../../prisma/prisma.service';

export interface ArtistAccess {
  artistId: string;
  kind: 'SOLO' | 'BAND';
  /** pode administrar (perfil, portfólio, rider, candidaturas, negociações) */
  canManage: boolean;
  /** pode visualizar dados internos (ex.: integrante MEMBER vê rider privado da banda) */
  canView: boolean;
  bandRole: BandRole | null;
  bandId: string | null;
}

const MANAGER_ROLES: BandRole[] = ['OWNER', 'ADMIN'];

/**
 * Autorização baseada em vínculo — nunca em papéis enviados pelo cliente.
 *  - SOLO: somente o dono do MusicianProfile administra.
 *  - BAND: integrantes ACTIVE com OWNER/ADMIN administram; MEMBER apenas visualiza.
 *  - Organização: integrantes ACTIVE (OWNER/ADMIN) administram; gestão de responsáveis exige OWNER.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async artistAccess(userId: string | null, artistId: string, db: Tx | PrismaService = this.prisma): Promise<ArtistAccess | null> {
    const artist = await db.artist.findUnique({
      where: { id: artistId },
      select: {
        id: true,
        kind: true,
        bandId: true,
        musicianProfile: { select: { userId: true } },
        band: userId ? { select: { members: { where: { userId, status: 'ACTIVE' }, select: { role: true } } } } : false,
      },
    });
    if (!artist) return null;
    if (!userId) return { artistId, kind: artist.kind, canManage: false, canView: false, bandRole: null, bandId: artist.bandId };
    if (artist.kind === 'SOLO') {
      const own = artist.musicianProfile?.userId === userId;
      return { artistId, kind: 'SOLO', canManage: own, canView: own, bandRole: null, bandId: null };
    }
    const role = (artist.band as { members: { role: BandRole }[] } | null)?.members[0]?.role ?? null;
    return {
      artistId,
      kind: 'BAND',
      canManage: !!role && MANAGER_ROLES.includes(role),
      canView: !!role,
      bandRole: role,
      bandId: artist.bandId,
    };
  }

  async assertCanManageArtist(userId: string, artistId: string, db?: Tx): Promise<ArtistAccess> {
    const access = await this.artistAccess(userId, artistId, db);
    if (!access) throw notFound('Perfil artístico não encontrado.');
    if (!access.canManage) throw forbidden('Você não administra este perfil artístico.');
    return access;
  }

  async assertCanViewArtist(userId: string, artistId: string): Promise<ArtistAccess> {
    const access = await this.artistAccess(userId, artistId);
    if (!access) throw notFound('Perfil artístico não encontrado.');
    if (!access.canView) throw forbidden('Você não participa deste perfil artístico.');
    return access;
  }

  /** IDs de identidades artísticas que o usuário administra (perfil individual + bandas OWNER/ADMIN). */
  async managedArtistIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.artist.findMany({
      where: {
        OR: [
          { musicianProfile: { userId } },
          { band: { members: { some: { userId, status: 'ACTIVE', role: { in: MANAGER_ROLES } } } } },
        ],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async orgRole(userId: string, organizationId: string, db: Tx | PrismaService = this.prisma): Promise<OrgRole | null> {
    const m = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true, status: true },
    });
    return m?.status === 'ACTIVE' ? m.role : null;
  }

  async assertOrgMember(userId: string, organizationId: string, roles: OrgRole[] = ['OWNER', 'ADMIN'], db?: Tx): Promise<OrgRole> {
    const exists = await (db ?? this.prisma).organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!exists) throw notFound('Casa de show não encontrada.');
    const role = await this.orgRole(userId, organizationId, db);
    if (!role || !roles.includes(role)) {
      throw forbidden(role ? 'Apenas o proprietário (OWNER) pode realizar esta ação.' : 'Você não é responsável por esta casa de show.');
    }
    return role;
  }

  async managedOrganizationIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.organizationMember.findMany({ where: { userId, status: 'ACTIVE' }, select: { organizationId: true } });
    return rows.map((r) => r.organizationId);
  }
}

@Global()
@Module({ providers: [AccessService], exports: [AccessService] })
export class AccessModule {}
