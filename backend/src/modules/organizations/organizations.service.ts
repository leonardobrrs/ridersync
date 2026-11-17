import { Injectable } from '@nestjs/common';
import { OrgRole, Prisma } from '@prisma/client';
import { z } from 'zod';
import { VENUE_KINDS } from '../../common/domain-lists';
import { conflict, notFound, unprocessable } from '../../common/errors';
import { assertKeepsAnOwner } from '../../common/membership.rules';
import { uniqueSlug } from '../../common/slug';
import {
  email,
  optionalEmail,
  optionalExternalUrl,
  optionalInstagram,
  optionalPhone,
  optionalText,
  text,
  uf,
} from '../../common/validation';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { mediaUrl, MediaService, UploadedFile } from '../media/media.service';

const OrgFields = {
  name: text(2, 100, 'Nome do estabelecimento'),
  venueKind: z.enum(VENUE_KINDS, { error: 'Tipo de espaço inválido.' }).nullable(),
  description: z.string().trim().max(3000),
  addressLine: optionalText(160, 'Endereço'),
  neighborhood: optionalText(80, 'Bairro'),
  city: text(2, 80, 'Cidade'),
  state: uf,
  capacity: z.number().int().min(1, 'Capacidade inválida.').max(200_000).nullable(),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
  instagram: optionalInstagram,
  website: optionalExternalUrl,
};
export const CreateOrganizationSchema = z
  .object(OrgFields)
  .partial()
  .extend({ name: OrgFields.name, city: OrgFields.city })
  .strict();
export const UpdateOrganizationSchema = z.object(OrgFields).partial().strict();
export const InviteOrgMemberSchema = z.object({ email, role: z.enum(['ADMIN']).default('ADMIN') }).strict();
export const ChangeOrgRoleSchema = z.object({ role: z.enum(['OWNER', 'ADMIN']) }).strict();

export const orgManageSelect = {
  id: true,
  type: true,
  slug: true,
  name: true,
  venueKind: true,
  description: true,
  addressLine: true,
  neighborhood: true,
  city: true,
  state: true,
  capacity: true,
  contactEmail: true,
  contactPhone: true,
  instagram: true,
  website: true,
  photoId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

export function toOrg(o: Prisma.OrganizationGetPayload<{ select: typeof orgManageSelect }>) {
  const { photoId, ...rest } = o;
  return { ...rest, photoUrl: mediaUrl(photoId) };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly media: MediaService,
  ) {}

  private async lockOrg(tx: Tx, organizationId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
    if (!rows.length) throw notFound('Casa de show não encontrada.');
  }

  private activeOwners(tx: Tx, organizationId: string) {
    return tx.organizationMember.count({ where: { organizationId, status: 'ACTIVE', role: 'OWNER' } });
  }

  /** Cria a casa (Organization VENUE) e o vínculo OWNER do criador. */
  async create(userId: string, input: z.infer<typeof CreateOrganizationSchema>) {
    const orgId = await this.prisma.$transaction(async (tx) => {
      const slug = await uniqueSlug(input.name, async (s) => !!(await tx.organization.findUnique({ where: { slug: s }, select: { id: true } })));
      const org = await tx.organization.create({ data: { ...input, type: 'VENUE', slug, description: input.description ?? '' } });
      await tx.organizationMember.create({ data: { organizationId: org.id, userId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() } });
      return org.id;
    });
    return this.detail(userId, orgId);
  }

  async listMine(userId: string) {
    const rows = await this.prisma.organizationMember.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        organization: {
          select: {
            ...orgManageSelect,
            _count: { select: { organizedEvents: { where: { status: 'OPEN' } }, equipment: true } },
          },
        },
      },
    });
    return rows.map((r) => {
      const { _count, ...org } = r.organization;
      return { role: r.role, openEvents: _count.organizedEvents, equipmentItems: _count.equipment, ...toOrg(org) };
    });
  }

  async detail(userId: string, organizationId: string) {
    const myRole = await this.access.assertOrgMember(userId, organizationId, ['OWNER', 'ADMIN']);
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        ...orgManageSelect,
        members: {
          where: { status: { in: ['ACTIVE', 'INVITED'] } },
          orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
          select: { id: true, role: true, status: true, invitedAt: true, joinedAt: true, user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    const { members, ...rest } = org;
    return {
      ...toOrg(rest),
      myRole,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        invitedAt: m.invitedAt,
        joinedAt: m.joinedAt,
        name: m.user.name,
        email: m.status === 'INVITED' ? m.user.email : undefined,
        isMe: m.user.id === userId,
      })),
    };
  }

  async update(userId: string, organizationId: string, input: z.infer<typeof UpdateOrganizationSchema>) {
    await this.access.assertOrgMember(userId, organizationId);
    await this.prisma.organization.update({ where: { id: organizationId }, data: input });
    return this.detail(userId, organizationId);
  }

  async setPhoto(userId: string, organizationId: string, file: UploadedFile | undefined) {
    await this.access.assertOrgMember(userId, organizationId);
    const prev = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { photoId: true } });
    const asset = await this.media.store(file, userId, 'image');
    await this.prisma.organization.update({ where: { id: organizationId }, data: { photoId: asset.id } });
    if (prev.photoId) await this.media.remove(prev.photoId);
    return this.detail(userId, organizationId);
  }

  async removePhoto(userId: string, organizationId: string) {
    await this.access.assertOrgMember(userId, organizationId);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { photoId: true } });
    if (org.photoId) {
      await this.prisma.organization.update({ where: { id: organizationId }, data: { photoId: null } });
      await this.media.remove(org.photoId);
    }
    return this.detail(userId, organizationId);
  }

  /** OWNER/ADMIN convidam novos ADMIN (usuário já cadastrado). Vínculo só ativa após aceite. */
  async invite(userId: string, organizationId: string, input: z.infer<typeof InviteOrgMemberSchema>) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, organizationId);
      await this.access.assertOrgMember(userId, organizationId, ['OWNER', 'ADMIN'], tx);
      const invitee = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (!invitee) throw notFound('Nenhuma conta RiderSync usa este e-mail. Peça para a pessoa se cadastrar e tente novamente.');
      if (invitee.id === userId) throw unprocessable('SELF_INVITE', 'Você já é responsável por esta casa.');
      const existing = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: invitee.id } } });
      if (existing?.status === 'ACTIVE') throw conflict('ALREADY_MEMBER', 'Esta pessoa já é responsável pela casa.');
      if (existing?.status === 'INVITED') throw conflict('ALREADY_INVITED', 'Já existe um convite pendente para esta pessoa.');
      const data = { role: input.role, status: 'INVITED' as const, invitedById: userId, invitedAt: new Date(), respondedAt: null, joinedAt: null, endedAt: null };
      const row = existing
        ? await tx.organizationMember.update({ where: { id: existing.id }, data, select: { id: true } })
        : await tx.organizationMember.create({ data: { organizationId, userId: invitee.id, ...data }, select: { id: true } });
      return { id: row.id, status: 'INVITED' };
    });
  }

  async cancelInvite(userId: string, organizationId: string, memberId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, organizationId);
      await this.access.assertOrgMember(userId, organizationId, ['OWNER', 'ADMIN'], tx);
      const row = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId, status: 'INVITED' } });
      if (!row) throw notFound('Convite pendente não encontrado.');
      await tx.organizationMember.update({ where: { id: row.id }, data: { status: 'CANCELLED', respondedAt: new Date() } });
    });
  }

  async respondInvite(userId: string, memberId: string, accept: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.organizationMember.findUnique({ where: { id: memberId } });
      if (!row || row.userId !== userId) throw notFound('Convite não encontrado.');
      await this.lockOrg(tx, row.organizationId);
      const fresh = await tx.organizationMember.findUniqueOrThrow({ where: { id: memberId } });
      if (fresh.status !== 'INVITED') throw conflict('INVITE_NOT_PENDING', 'Este convite não está mais pendente.');
      const now = new Date();
      await tx.organizationMember.update({
        where: { id: memberId },
        data: accept ? { status: 'ACTIVE', respondedAt: now, joinedAt: now } : { status: 'DECLINED', respondedAt: now },
      });
      return { organizationId: row.organizationId, status: accept ? 'ACTIVE' : 'DECLINED' };
    });
  }

  async changeRole(userId: string, organizationId: string, memberId: string, role: OrgRole) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, organizationId);
      await this.access.assertOrgMember(userId, organizationId, ['OWNER'], tx);
      const target = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId, status: 'ACTIVE' } });
      if (!target) throw notFound('Responsável ativo não encontrado.');
      assertKeepsAnOwner({
        activeOwners: await this.activeOwners(tx, organizationId),
        targetIsOwner: target.role === 'OWNER',
        targetStaysOwner: role === 'OWNER',
      });
      await tx.organizationMember.update({ where: { id: target.id }, data: { role } });
    });
    return this.detail(userId, organizationId).catch(() => null);
  }

  async removeMember(userId: string, organizationId: string, memberId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, organizationId);
      await this.access.assertOrgMember(userId, organizationId, ['OWNER'], tx);
      const target = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId, status: 'ACTIVE' } });
      if (!target) throw notFound('Responsável ativo não encontrado.');
      if (target.userId === userId) throw unprocessable('USE_LEAVE', 'Para deixar a casa, use a opção "Deixar de administrar".');
      assertKeepsAnOwner({ activeOwners: await this.activeOwners(tx, organizationId), targetIsOwner: target.role === 'OWNER', targetStaysOwner: false });
      await tx.organizationMember.update({ where: { id: target.id }, data: { status: 'REMOVED', endedAt: new Date() } });
    });
  }

  async leave(userId: string, organizationId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, organizationId);
      const role = await this.access.assertOrgMember(userId, organizationId, ['OWNER', 'ADMIN'], tx);
      assertKeepsAnOwner({ activeOwners: await this.activeOwners(tx, organizationId), targetIsOwner: role === 'OWNER', targetStaysOwner: false });
      await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: { status: 'LEFT', endedAt: new Date() },
      });
    });
  }

  async transferOwnership(userId: string, organizationId: string, memberId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrg(tx, organizationId);
      await this.access.assertOrgMember(userId, organizationId, ['OWNER'], tx);
      const target = await tx.organizationMember.findFirst({ where: { id: memberId, organizationId, status: 'ACTIVE' } });
      if (!target) throw notFound('Responsável ativo não encontrado.');
      if (target.userId === userId) throw unprocessable('SELF_TRANSFER', 'Escolha outro responsável.');
      await tx.organizationMember.update({ where: { id: target.id }, data: { role: 'OWNER' } });
      await tx.organizationMember.update({ where: { organizationId_userId: { organizationId, userId } }, data: { role: 'ADMIN' } });
    });
    return this.detail(userId, organizationId);
  }
}
