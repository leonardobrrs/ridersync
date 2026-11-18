import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { z } from 'zod';
import { googleEnabled, loadEnv } from '../../config/env';
import { conflict, forbidden, tooManyRequests, unauthorized, unprocessable } from '../../common/errors';
import { email, password, passwordsMatch, passwordsMatchError, text } from '../../common/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.module';
import { passwordResetEmail, verificationEmail } from '../mail/mail.templates';
import { mediaThumbUrl } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { burnPasswordCheck, hashPassword, verifyPassword } from './password';
import { TokenService } from './token.service';

/** Versão vigente da Política de Privacidade/Termos (frontend: /privacidade e /termos). */
export const PRIVACY_POLICY_VERSION = '2026-11-18';

export const RegisterSchema = z
  .object({
    accountType: z.enum(['ARTIST', 'CONTRACTOR'], { error: 'Escolha se você é artista ou contratante.' }),
    name: text(2, 120, 'Nome'),
    email,
    password,
    passwordConfirmation: z.string({ error: 'Confirme a senha.' }).max(128),
    acceptTerms: z.literal(true, { error: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' }),
  })
  .strict()
  .refine(passwordsMatch, passwordsMatchError);

export const LoginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.').max(128),
});

export const EmailOnlySchema = z.object({ email }).strict();
export const TokenSchema = z.object({ token: z.string().min(20).max(128) }).strict();
export const ResetPasswordSchema = z
  .object({ token: z.string().min(20).max(128), password, passwordConfirmation: z.string().max(128) })
  .strict()
  .refine(passwordsMatch, passwordsMatchError);

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos.';

@Injectable()
export class AuthService {
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  private link(path: string) {
    return new URL(path, this.env.PUBLIC_APP_URL).toString();
  }

  get verificationRequired() {
    return this.env.EMAIL_VERIFICATION_REQUIRED;
  }

  async register(input: z.infer<typeof RegisterSchema>) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw conflict('EMAIL_TAKEN', 'Já existe uma conta com este e-mail. Entre ou recupere a senha.');
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        accountType: input.accountType,
        passwordHash: await hashPassword(input.password),
        termsAcceptedAt: new Date(),
        termsVersion: PRIVACY_POLICY_VERSION,
      },
      select: { id: true, name: true, email: true },
    });
    await this.sendVerification(user);
    return { id: user.id };
  }

  async login(input: z.infer<typeof LoginSchema>) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true, lockedUntil: true, emailVerifiedAt: true, anonymizedAt: true },
    });
    if (!user || user.anonymizedAt || !user.passwordHash) {
      await burnPasswordCheck(input.password);
      throw unauthorized('INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw tooManyRequests('ACCOUNT_LOCKED', `Muitas tentativas sem sucesso. Aguarde ${minutes} min ou redefina sua senha.`);
    }
    const { ok, needsRehash } = await verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      await this.registerFailedAttempt(user.id);
      throw unauthorized('INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }
    if (this.verificationRequired && !user.emailVerifiedAt) {
      throw forbidden('Confirme seu e-mail para entrar. Enviamos um link para a sua caixa de entrada.', 'EMAIL_NOT_VERIFIED');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, ...(needsRehash ? { passwordHash: await hashPassword(input.password) } : {}) },
    });
    return { id: user.id };
  }

  /**
   * Incremento atômico; ao atingir o limite a conta fica bloqueada por LOGIN_LOCK_MINUTES.
   * O instante do bloqueio vem da aplicação (UTC), como as demais colunas gravadas pelo Prisma,
   * em vez de now() do banco — que depende do fuso configurado no servidor PostgreSQL.
   */
  private async registerFailedAttempt(userId: string) {
    const max = this.env.LOGIN_MAX_ATTEMPTS;
    const lockUntil = new Date(Date.now() + this.env.LOGIN_LOCK_MINUTES * 60_000);
    await this.prisma.$executeRaw`
      UPDATE "User" SET
        "failedLoginCount" = CASE WHEN "failedLoginCount" + 1 >= ${max} THEN 0 ELSE "failedLoginCount" + 1 END,
        "lockedUntil" = CASE WHEN "failedLoginCount" + 1 >= ${max} THEN (${lockUntil}::timestamptz AT TIME ZONE 'UTC') ELSE "lockedUntil" END
      WHERE "id" = ${userId}::uuid`;
  }

  // ─────────── Confirmação de e-mail ───────────

  private async sendVerification(user: { id: string; name: string; email: string }) {
    const token = await this.tokens.issue(user.id, 'EMAIL_VERIFICATION');
    await this.mail.sendNow(verificationEmail(user.email, user.name, this.link(`/verificar-email?token=${token}`)));
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, emailVerifiedAt: true } });
    if (user.emailVerifiedAt) return { alreadyVerified: true };
    await this.sendVerification(user);
    return { alreadyVerified: false };
  }

  /** Reenvio sem sessão (quando o login exige confirmação). Resposta idêntica exista ou não a conta. */
  async resendVerificationByEmail(address: string) {
    const user = await this.prisma.user.findUnique({ where: { email: address }, select: { id: true, name: true, email: true, emailVerifiedAt: true, anonymizedAt: true } });
    if (user && !user.emailVerifiedAt && !user.anonymizedAt) await this.sendVerification(user);
  }

  async verifyEmail(token: string) {
    const userId = await this.tokens.consume(token, 'EMAIL_VERIFICATION');
    if (!userId) throw unprocessable('INVALID_TOKEN', 'Link de confirmação inválido ou expirado. Peça um novo link.');
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return { userId };
  }

  // ─────────── Recuperação de senha ───────────

  /** Resposta sempre igual (não revela se o e-mail existe). */
  async requestPasswordReset(address: string) {
    const user = await this.prisma.user.findUnique({ where: { email: address }, select: { id: true, name: true, email: true, anonymizedAt: true } });
    if (!user || user.anonymizedAt) return;
    const token = await this.tokens.issue(user.id, 'PASSWORD_RESET');
    await this.mail.sendNow(passwordResetEmail(user.email, user.name, this.link(`/redefinir-senha?token=${token}`)));
  }

  async resetPassword(input: z.infer<typeof ResetPasswordSchema>) {
    const passwordHash = await hashPassword(input.password);
    await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(input.token, 'PASSWORD_RESET', tx);
      if (!userId) throw unprocessable('INVALID_TOKEN', 'Link de redefinição inválido ou expirado. Peça um novo link.');
      // Quem recebeu o link comprovou acesso à caixa de e-mail: a conta passa a constar como confirmada.
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: new Date() },
      });
      await tx.session.deleteMany({ where: { userId } });
      await this.notifications.notify(tx, [userId], {
        category: 'ACCOUNT',
        type: 'PASSWORD_CHANGED',
        title: 'Sua senha foi alterada',
        body: 'A senha da sua conta foi redefinida e todas as sessões foram encerradas. Se não foi você, redefina a senha imediatamente.',
        link: '/painel/conta',
        dedupeKey: `password-reset:${Date.now()}`,
      });
    });
    await this.notifications.flush();
  }

  // ─────────── Sessão ───────────

  /**
   * Dados privados da sessão: conta + contextos de atuação (perfil individual,
   * bandas e casas ativas) + pendências (convites, notificações, aceite de termos).
   */
  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        accountType: true,
        emailVerifiedAt: true,
        passwordHash: true,
        googleSub: true,
        termsVersion: true,
        musicianProfile: { select: { artist: { select: { id: true, slug: true, name: true, visibility: true, photoId: true } } } },
        bandMemberships: {
          where: { status: 'ACTIVE' },
          orderBy: { joinedAt: 'asc' },
          select: { bandId: true, role: true, band: { select: { artist: { select: { id: true, slug: true, name: true, visibility: true } } } } },
        },
        orgMemberships: {
          where: { status: 'ACTIVE' },
          orderBy: { joinedAt: 'asc' },
          select: { role: true, organization: { select: { id: true, slug: true, name: true, type: true, photoId: true } } },
        },
      },
    });
    const [bandInvites, orgInvites, unreadNotifications] = await Promise.all([
      this.prisma.bandMember.count({ where: { userId, status: 'INVITED' } }),
      this.prisma.organizationMember.count({ where: { userId, status: 'INVITED' } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        accountType: user.accountType as AccountType | null,
        emailVerified: !!user.emailVerifiedAt,
        hasPassword: !!user.passwordHash,
        googleLinked: !!user.googleSub,
        // Foto única da pessoa: a do perfil individual; para contratantes, a da organização. (Não há foto de conta.)
        profilePhotoUrl: mediaThumbUrl(
          user.musicianProfile?.artist?.photoId ?? user.orgMemberships.find((m) => m.organization.photoId)?.organization.photoId ?? null,
        ),
        needsTermsAcceptance: user.termsVersion !== PRIVACY_POLICY_VERSION,
      },
      musician: user.musicianProfile?.artist ? withoutPhotoId(user.musicianProfile.artist) : null,
      bands: user.bandMemberships
        .filter((m) => m.band.artist)
        .map((m) => ({ bandId: m.bandId, role: m.role, artist: m.band.artist! })),
      organizations: user.orgMemberships.map((m) => ({ ...withoutPhotoId(m.organization), role: m.role })),
      pendingInvitations: bandInvites + orgInvites,
      unreadNotifications,
      features: { emailVerificationRequired: this.verificationRequired, googleLogin: googleEnabled(this.env) },
    };
  }

  /** Versão pública das capacidades de login (exibir ou não o botão "Entrar com Google"). */
  publicConfig() {
    return { googleLogin: googleEnabled(this.env), emailVerificationRequired: this.verificationRequired, privacyPolicyVersion: PRIVACY_POLICY_VERSION };
  }
}

function withoutPhotoId<T extends { photoId: string | null }>(o: T): Omit<T, 'photoId'> {
  const { photoId: _photoId, ...rest } = o;
  return rest;
}
