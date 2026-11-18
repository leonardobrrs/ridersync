import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { conflict, unauthorized } from '../../common/errors';
import { password, text } from '../../common/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../auth/auth.decorators';
import { PRIVACY_POLICY_VERSION } from '../auth/auth.service';
import { hashPassword, verifyPassword } from '../auth/password';
import { SessionService } from '../auth/session.service';
import { MediaService, UploadedFile } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

export const UpdateAccountSchema = z.object({ name: text(2, 120, 'Nome') }).strict();
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    newPassword: password,
    newPasswordConfirmation: z.string().max(128),
  })
  .strict()
  .refine((v) => v.newPassword === v.newPasswordConfirmation, { path: ['newPasswordConfirmation'], message: 'As senhas não conferem.' })
  .refine((v) => !v.currentPassword || v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual.',
  });
export const AccountTypeSchema = z.object({ accountType: z.enum(['ARTIST', 'CONTRACTOR']) }).strict();
export const AcceptTermsSchema = z.object({ version: z.literal(PRIVACY_POLICY_VERSION, { error: 'Versão da política desatualizada. Recarregue a página.' }) }).strict();

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
  ) {}

  async update(userId: string, input: z.infer<typeof UpdateAccountSchema>) {
    await this.prisma.user.update({ where: { id: userId }, data: { name: input.name } });
  }

  /** Contas com senha exigem a atual; contas criadas só com Google podem definir a primeira senha. */
  async changePassword(user: AuthUser, input: z.infer<typeof ChangePasswordSchema>) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (current.passwordHash) {
      const { ok } = await verifyPassword(input.currentPassword ?? '', current.passwordHash);
      if (!ok) throw unauthorized('INVALID_CREDENTIALS', 'Senha atual incorreta.');
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } });
      await this.notifications.notify(tx, [user.id], {
        category: 'ACCOUNT',
        type: 'PASSWORD_CHANGED',
        title: current.passwordHash ? 'Sua senha foi alterada' : 'Senha definida na sua conta',
        body: 'As demais sessões abertas foram encerradas. Se não foi você, redefina a senha imediatamente.',
        link: '/painel/conta',
        dedupeKey: `password-changed:${Date.now()}`,
      });
    });
    await this.notifications.flush();
  }

  /** Somente contas legadas (sem tipo) escolhem depois; o tipo é definitivo. */
  async chooseAccountType(userId: string, input: z.infer<typeof AccountTypeSchema>) {
    const res = await this.prisma.user.updateMany({ where: { id: userId, accountType: null }, data: { accountType: input.accountType } });
    if (res.count !== 1) throw conflict('ACCOUNT_TYPE_SET', 'O tipo da conta já foi definido e não pode ser alterado.');
  }

  async acceptTerms(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { termsAcceptedAt: new Date(), termsVersion: PRIVACY_POLICY_VERSION } });
  }

  async setAvatar(userId: string, file: UploadedFile | undefined) {
    const prev = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarId: true } });
    const asset = await this.media.store(file, userId, 'image');
    await this.prisma.user.update({ where: { id: userId }, data: { avatarId: asset.id } });
    if (prev.avatarId) await this.media.remove(prev.avatarId);
  }

  async removeAvatar(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarId: true } });
    if (!u.avatarId) return;
    await this.prisma.user.update({ where: { id: userId }, data: { avatarId: null } });
    await this.media.remove(u.avatarId);
  }

  async revokeOtherSessions(user: AuthUser) {
    await this.sessions.revokeOthers(user.id, user.sessionId);
  }

  /**
   * Exportação dos dados pessoais do titular (LGPD art. 18, II e V). Inclui o que a conta registrou
   * ou que se refere diretamente a ela; não inclui dados pessoais de outras pessoas além de nomes
   * necessários para dar contexto (ex.: contraparte de uma negociação).
   */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        accountType: true,
        emailVerifiedAt: true,
        googleSub: true,
        termsAcceptedAt: true,
        termsVersion: true,
        createdAt: true,
        updatedAt: true,
        notificationPreference: { select: { emailEnabled: true, emailInvitations: true, emailApplications: true, emailBookings: true, emailEvents: true } },
        sessions: { select: { createdAt: true, lastUsedAt: true, expiresAt: true, userAgent: true } },
        musicianProfile: {
          select: {
            mainInstrument: true,
            instruments: true,
            artist: {
              select: {
                slug: true,
                name: true,
                headline: true,
                bio: true,
                city: true,
                state: true,
                genres: true,
                formats: true,
                contactEmail: true,
                contactPhone: true,
                instagram: true,
                website: true,
                visibility: true,
                portfolioItems: { select: { kind: true, title: true, description: true, url: true, createdAt: true } },
              },
            },
          },
        },
        bandMemberships: { select: { role: true, status: true, instrument: true, joinedAt: true, endedAt: true, band: { select: { artist: { select: { name: true, slug: true } } } } } },
        orgMemberships: { select: { role: true, status: true, joinedAt: true, endedAt: true, organization: { select: { name: true, slug: true, type: true } } } },
        applicationsSent: { select: { status: true, message: true, createdAt: true, event: { select: { title: true, startsAt: true } }, artist: { select: { name: true } } } },
        offersAuthored: { select: { authorSide: true, performanceAt: true, durationMinutes: true, feeCents: true, terms: true, status: true, createdAt: true, booking: { select: { title: true } } } },
        messages: { select: { authorSide: true, body: true, createdAt: true, booking: { select: { title: true } } } },
        notifications: { select: { category: true, title: true, body: true, readAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 },
      },
    });
    const { googleSub, ...rest } = user;
    return { exportedAt: new Date().toISOString(), format: 'RiderSync/LGPD v1', account: { ...rest, googleLinked: !!googleSub } };
  }
}
