import { Injectable } from '@nestjs/common';
import { BandRole } from '@prisma/client';
import { z } from 'zod';
import { assertBandCanInvite, assertBandCanRemove, assertKeepsAnOwner } from '../../common/membership.rules';
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors';
import { BAND_POSITIONS } from '../../common/domain-lists';
import { email, optionalCnpj, optionalText } from '../../common/validation';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { PasswordConfirmationSchema, ReauthService } from '../auth/reauth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateArtistSchema } from '../artists/artist.schemas';
import { ArtistsService } from '../artists/artists.service';
import { mediaUrl } from '../media/media.service';

export const CreateBandSchema = CreateArtistSchema;
/** Razão social e CNPJ da banda para contratos (PUT = substituição). Sem CNPJ, o OWNER representa o grupo. */
export const BandLegalSchema = z.object({ legalName: optionalText(150, 'Razão social'), cnpj: optionalCnpj }).strict();
const position = z.enum(BAND_POSITIONS, { error: 'Escolha uma função da lista.' }).nullable();
export const InviteBandMemberSchema = z
  .object({
    email,
    role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    instrument: position.optional(),
  })
  .strict();
/** OWNER só é concedido pela transferência de propriedade (fluxo dedicado com senha). */
export const ChangeBandRoleSchema = z.object({ role: z.enum(['ADMIN', 'MEMBER'], { error: 'Use "Transferir propriedade" para definir um novo proprietário.' }) }).strict();
export const MemberPositionSchema = z.object({ instrument: position }).strict();
export const TransferSchema = z.object({ memberId: z.uuid(), password: PasswordConfirmationSchema }).strict();

@Injectable()
export class BandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artists: ArtistsService,
    private readonly access: AccessService,
    private readonly reauth: ReauthService,
    private readonly notifications: NotificationsService,
  ) {}

  private async bandName(tx: Tx | PrismaService, bandId: string) {
    const a = await tx.artist.findUnique({ where: { bandId }, select: { name: true } });
    return a?.name ?? 'banda';
  }

  private async managerIds(tx: Tx, bandId: string) {
    const rows = await tx.bandMember.findMany({ where: { bandId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }

  private async lockBand(tx: Tx, bandId: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Band" WHERE id = ${bandId}::uuid FOR UPDATE`;
    if (!rows.length) throw notFound('Banda não encontrada.');
  }

  private async actorRole(tx: Tx | PrismaService, bandId: string, userId: string): Promise<BandRole | null> {
    const m = await tx.bandMember.findUnique({ where: { bandId_userId: { bandId, userId } }, select: { role: true, status: true } });
    return m?.status === 'ACTIVE' ? m.role : null;
  }

  private async requireRole(tx: Tx | PrismaService, bandId: string, userId: string, roles: BandRole[]) {
    const band = await tx.band.findUnique({ where: { id: bandId }, select: { id: true } });
    if (!band) throw notFound('Banda não encontrada.');
    const role = await this.actorRole(tx, bandId, userId);
    if (!role) throw forbidden('Você não é integrante ativo desta banda.');
    if (!roles.includes(role)) throw forbidden('Seu papel na banda não permite esta ação.');
    return role;
  }

  private async activeOwners(tx: Tx, bandId: string) {
    return tx.bandMember.count({ where: { bandId, status: 'ACTIVE', role: 'OWNER' } });
  }

  /** Cria a banda (identidade própria) e o vínculo OWNER ativo do criador. Não copia dados do perfil individual. */
  async create(userId: string, input: z.infer<typeof CreateBandSchema>) {
    await this.access.assertAccountType(userId, 'ARTIST');
    const bandId = await this.prisma.$transaction(async (tx) => {
      const band = await tx.band.create({ data: { createdById: userId } });
      await tx.artist.create({ data: { kind: 'BAND', bandId: band.id, ...(await this.artists.artistCreateData(tx, input)) } });
      const now = new Date();
      await tx.bandMember.create({
        data: { bandId: band.id, userId, role: 'OWNER', status: 'ACTIVE', joinedAt: now, invitedAt: null },
      });
      return band.id;
    });
    return this.detail(userId, bandId);
  }

  async listMine(userId: string) {
    const rows = await this.prisma.bandMember.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        band: {
          select: {
            id: true,
            artist: { select: { id: true, slug: true, name: true, city: true, genres: true, visibility: true, photoId: true } },
            _count: { select: { members: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    });
    return rows
      .filter((r) => r.band.artist)
      .map((r) => ({
        bandId: r.band.id,
        role: r.role,
        memberCount: r.band._count.members,
        artist: { ...r.band.artist!, photoUrl: mediaUrl(r.band.artist!.photoId), photoId: undefined },
      }));
  }

  async updateLegal(userId: string, bandId: string, input: z.infer<typeof BandLegalSchema>) {
    await this.requireRole(this.prisma, bandId, userId, ['OWNER', 'ADMIN']);
    await this.prisma.band.update({ where: { id: bandId }, data: input });
    return this.detail(userId, bandId);
  }

  /** Detalhe para integrantes ativos. Convites pendentes (e e-mails convidados) só para OWNER/ADMIN. */
  async detail(userId: string, bandId: string) {
    const role = await this.requireRole(this.prisma, bandId, userId, ['OWNER', 'ADMIN', 'MEMBER']);
    const isManager = role !== 'MEMBER';
    const band = await this.prisma.band.findUniqueOrThrow({
      where: { id: bandId },
      select: {
        id: true,
        createdAt: true,
        legalName: isManager,
        cnpj: isManager,
        artist: { select: { id: true } },
        members: {
          where: { status: { in: isManager ? ['ACTIVE', 'INVITED'] : ['ACTIVE'] } },
          orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }, { invitedAt: 'asc' }],
          select: {
            id: true,
            role: true,
            status: true,
            instrument: true,
            invitedAt: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                musicianProfile: { select: { artist: { select: { slug: true, name: true, visibility: true } } } },
              },
            },
          },
        },
      },
    });
    const artist = await this.artists.getManaged(userId, band.artist!.id);
    const owner = isManager
      ? await this.prisma.bandMember.findFirst({ where: { bandId, role: 'OWNER', status: 'ACTIVE' }, select: { user: { select: { legalName: true, cpf: true } } } })
      : null;
    return {
      bandId: band.id,
      myRole: role,
      artist,
      /** Dados de contrato (só OWNER/ADMIN). Sem CNPJ, o contrato usa nome civil e CPF do proprietário. */
      legal: isManager ? { legalName: band.legalName ?? null, cnpj: band.cnpj ?? null, ownerHasLegalData: !!owner?.user.legalName && !!owner.user.cpf } : null,
      members: band.members.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        instrument: m.instrument,
        invitedAt: m.invitedAt,
        joinedAt: m.joinedAt,
        isMe: m.user.id === userId,
        name: m.user.name,
        // e-mail só para administradores e somente em convites pendentes (eles digitaram o e-mail)
        email: isManager && m.status === 'INVITED' ? m.user.email : undefined,
        musicianProfile:
          m.user.musicianProfile?.artist?.visibility === 'PUBLIC'
            ? { slug: m.user.musicianProfile.artist.slug, name: m.user.musicianProfile.artist.name }
            : null,
      })),
    };
  }

  /** Convite para usuário já cadastrado (identificado pelo e-mail da conta). Só fica ativo após aceite. */
  async invite(userId: string, bandId: string, input: z.infer<typeof InviteBandMemberSchema>) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockBand(tx, bandId);
      const actor = await this.requireRole(tx, bandId, userId, ['OWNER', 'ADMIN']);
      assertBandCanInvite(actor, input.role);
      const invitee = await tx.user.findUnique({ where: { email: input.email }, select: { id: true, accountType: true, anonymizedAt: true } });
      if (!invitee || invitee.anonymizedAt) {
        throw notFound('Nenhuma conta RiderSync usa este e-mail. Peça para a pessoa se cadastrar e tente novamente.');
      }
      if (invitee.id === userId) throw unprocessable('SELF_INVITE', 'Você já faz parte desta banda.');
      if (invitee.accountType === 'CONTRACTOR') {
        throw unprocessable('WRONG_ACCOUNT_TYPE', 'Esta pessoa usa uma conta de contratante. Integrantes de banda precisam de conta de artista.');
      }
      const existing = await tx.bandMember.findUnique({ where: { bandId_userId: { bandId, userId: invitee.id } } });
      if (existing?.status === 'ACTIVE') throw conflict('ALREADY_MEMBER', 'Esta pessoa já é integrante ativa da banda.');
      if (existing?.status === 'INVITED') throw conflict('ALREADY_INVITED', 'Já existe um convite pendente para esta pessoa.');
      const data = {
        role: input.role,
        status: 'INVITED' as const,
        instrument: input.instrument ?? null,
        invitedById: userId,
        invitedAt: new Date(),
        respondedAt: null,
        joinedAt: null,
        endedAt: null,
      };
      const row = existing
        ? await tx.bandMember.update({ where: { id: existing.id }, data, select: { id: true } })
        : await tx.bandMember.create({ data: { bandId, userId: invitee.id, ...data }, select: { id: true } });
      await this.notifications.notify(tx, [invitee.id], {
        category: 'INVITATIONS',
        type: 'BAND_INVITE',
        title: `Convite para a banda ${await this.bandName(tx, bandId)}`,
        body: 'Você foi convidado(a) para integrar uma banda no RiderSync. Aceite ou recuse em "Convites".',
        link: '/painel/convites',
        dedupeKey: `band-invite:${row.id}:${data.invitedAt.getTime()}`,
      });
      return { id: row.id, status: 'INVITED' };
    });
    await this.notifications.flush();
    return result;
  }

  /** Função/cargo do integrante: OWNER/ADMIN definem de qualquer um; cada integrante pode definir a própria. */
  async setPosition(userId: string, bandId: string, memberId: string, input: z.infer<typeof MemberPositionSchema>) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBand(tx, bandId);
      const role = await this.requireRole(tx, bandId, userId, ['OWNER', 'ADMIN', 'MEMBER']);
      const target = await tx.bandMember.findFirst({ where: { id: memberId, bandId, status: { in: ['ACTIVE', 'INVITED'] } } });
      if (!target) throw notFound('Integrante não encontrado.');
      if (role === 'MEMBER' && target.userId !== userId) throw forbidden('Você só pode alterar a sua própria função.');
      await tx.bandMember.update({ where: { id: target.id }, data: { instrument: input.instrument } });
    });
    return this.detail(userId, bandId);
  }

  async cancelInvite(userId: string, bandId: string, memberId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBand(tx, bandId);
      await this.requireRole(tx, bandId, userId, ['OWNER', 'ADMIN']);
      const row = await tx.bandMember.findFirst({ where: { id: memberId, bandId, status: 'INVITED' } });
      if (!row) throw notFound('Convite pendente não encontrado.');
      await tx.bandMember.update({ where: { id: row.id }, data: { status: 'CANCELLED', respondedAt: new Date() } });
    });
  }

  /** Resposta do convidado. Apenas o próprio convidado responde. */
  async respondInvite(userId: string, memberId: string, accept: boolean) {
    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.bandMember.findUnique({ where: { id: memberId } });
      if (!row || row.userId !== userId) throw notFound('Convite não encontrado.');
      if (accept) await this.access.assertAccountType(userId, 'ARTIST', tx);
      await this.lockBand(tx, row.bandId);
      const fresh = await tx.bandMember.findUniqueOrThrow({ where: { id: memberId } });
      if (fresh.status !== 'INVITED') throw conflict('INVITE_NOT_PENDING', 'Este convite não está mais pendente.');
      const now = new Date();
      await tx.bandMember.update({
        where: { id: memberId },
        data: accept ? { status: 'ACTIVE', respondedAt: now, joinedAt: now } : { status: 'DECLINED', respondedAt: now },
      });
      const invitee = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
      await this.notifications.notify(tx, (await this.managerIds(tx, row.bandId)).filter((id) => id !== userId), {
        category: 'INVITATIONS',
        type: accept ? 'BAND_INVITE_ACCEPTED' : 'BAND_INVITE_DECLINED',
        title: accept ? `${invitee.name} entrou na banda` : `${invitee.name} recusou o convite`,
        body: `Banda: ${await this.bandName(tx, row.bandId)}.`,
        link: `/painel/bandas/${row.bandId}`,
        dedupeKey: `band-invite-response:${memberId}:${now.getTime()}`,
      });
      return { bandId: row.bandId, status: accept ? 'ACTIVE' : 'DECLINED' };
    });
    await this.notifications.flush();
    return result;
  }

  /** Alteração de papel: somente OWNER; protege o último OWNER. */
  async changeRole(userId: string, bandId: string, memberId: string, role: BandRole) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBand(tx, bandId);
      await this.requireRole(tx, bandId, userId, ['OWNER']);
      const target = await tx.bandMember.findFirst({ where: { id: memberId, bandId, status: 'ACTIVE' } });
      if (!target) throw notFound('Integrante ativo não encontrado.');
      assertKeepsAnOwner({
        activeOwners: await this.activeOwners(tx, bandId),
        targetIsOwner: target.role === 'OWNER',
        targetStaysOwner: role === 'OWNER',
      });
      await tx.bandMember.update({ where: { id: target.id }, data: { role } });
    });
    return this.detail(userId, bandId).catch(() => null);
  }

  async removeMember(userId: string, bandId: string, memberId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBand(tx, bandId);
      const actor = await this.requireRole(tx, bandId, userId, ['OWNER', 'ADMIN']);
      const target = await tx.bandMember.findFirst({ where: { id: memberId, bandId, status: 'ACTIVE' } });
      if (!target) throw notFound('Integrante ativo não encontrado.');
      if (target.userId === userId) throw unprocessable('USE_LEAVE', 'Para sair da banda, use a opção "Sair da banda".');
      assertBandCanRemove(actor, target.role);
      assertKeepsAnOwner({ activeOwners: await this.activeOwners(tx, bandId), targetIsOwner: target.role === 'OWNER', targetStaysOwner: false });
      await tx.bandMember.update({ where: { id: target.id }, data: { status: 'REMOVED', endedAt: new Date() } });
    });
  }

  async leave(userId: string, bandId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockBand(tx, bandId);
      const role = await this.requireRole(tx, bandId, userId, ['OWNER', 'ADMIN', 'MEMBER']);
      assertKeepsAnOwner({ activeOwners: await this.activeOwners(tx, bandId), targetIsOwner: role === 'OWNER', targetStaysOwner: false });
      await tx.bandMember.update({
        where: { bandId_userId: { bandId, userId } },
        data: { status: 'LEFT', endedAt: new Date() },
      });
    });
  }

  /**
   * Transferência atômica com confirmação de senha: o alvo vira OWNER e o OWNER atual passa a ADMIN
   * na mesma transação (nunca há estado sem proprietário ou com o papel duplicado por engano).
   */
  async transferOwnership(userId: string, bandId: string, input: z.infer<typeof TransferSchema>) {
    await this.reauth.assertPassword(userId, input.password);
    await this.prisma.$transaction(async (tx) => {
      await this.lockBand(tx, bandId);
      await this.requireRole(tx, bandId, userId, ['OWNER']);
      const target = await tx.bandMember.findFirst({ where: { id: input.memberId, bandId, status: 'ACTIVE' }, select: { id: true, userId: true } });
      if (!target) throw notFound('Integrante ativo não encontrado.');
      if (target.userId === userId) throw unprocessable('SELF_TRANSFER', 'Escolha outro integrante.');
      await tx.bandMember.update({ where: { id: target.id }, data: { role: 'OWNER' } });
      await tx.bandMember.update({ where: { bandId_userId: { bandId, userId } }, data: { role: 'ADMIN' } });
      const name = await this.bandName(tx, bandId);
      const now = Date.now();
      await this.notifications.notify(tx, [target.userId], {
        category: 'ACCOUNT',
        type: 'OWNERSHIP_RECEIVED',
        title: `Você é o novo proprietário de ${name}`,
        body: 'A propriedade da banda foi transferida para você.',
        link: `/painel/bandas/${bandId}`,
        dedupeKey: `band-owner:${bandId}:${now}`,
      });
      await this.notifications.notify(tx, [userId], {
        category: 'ACCOUNT',
        type: 'OWNERSHIP_TRANSFERRED',
        title: `Propriedade de ${name} transferida`,
        body: 'Você agora é administrador(a) da banda. Se não reconhece esta ação, altere sua senha.',
        link: `/painel/bandas/${bandId}`,
        dedupeKey: `band-owner-out:${bandId}:${now}`,
      });
    });
    await this.notifications.flush();
    return this.detail(userId, bandId);
  }
}
