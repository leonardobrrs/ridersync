import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { loadEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from './auth.decorators';

export const SESSION_COOKIE = 'rs_session';
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionService {
  private readonly env = loadEnv();

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, userAgent: string | undefined, res: Response) {
    const token = randomBytes(32).toString('base64url');
    const ttlMs = this.env.SESSION_TTL_HOURS * 3600 * 1000;
    await this.prisma.session.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs), userAgent: userAgent?.slice(0, 255) },
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      maxAge: ttlMs,
    });
  }

  async resolve(token: string | undefined): Promise<AuthUser | null> {
    if (!token || token.length > 128) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
    return { ...session.user, sessionId: session.id };
  }

  async destroy(sessionId: string, res: Response) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
    this.clearCookie(res);
  }

  clearCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: this.env.COOKIE_SECURE, sameSite: 'lax', path: '/' });
  }

  /** Revoga as demais sessões (ex.: após troca de senha). */
  async revokeOthers(userId: string, keepSessionId: string) {
    await this.prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
  }
}
