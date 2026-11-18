import { Injectable } from '@nestjs/common';
import { TokenPurpose } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService, Tx } from '../../prisma/prisma.service';

const TTL_MS: Record<TokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 3600 * 1000,
  PASSWORD_RESET: 3600 * 1000,
};

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Tokens de uso único enviados por e-mail. Apenas o hash fica no banco; emitir um novo invalida os anteriores. */
@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, purpose: TokenPurpose, db: Tx | PrismaService = this.prisma): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await db.userToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } });
    await db.userToken.create({ data: { userId, purpose, tokenHash: hash(token), expiresAt: new Date(now.getTime() + TTL_MS[purpose]) } });
    return token;
  }

  /** Consome atomicamente: duas requisições simultâneas com o mesmo token nunca são aceitas ambas. */
  async consume(token: string, purpose: TokenPurpose, db: Tx | PrismaService = this.prisma): Promise<string | null> {
    if (!token || token.length > 128) return null;
    const tokenHash = hash(token);
    const now = new Date();
    const res = await db.userToken.updateMany({ where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (res.count !== 1) return null;
    const row = await db.userToken.findUnique({ where: { tokenHash }, select: { userId: true } });
    return row?.userId ?? null;
  }
}
