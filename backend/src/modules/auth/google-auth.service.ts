import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { loadEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { GOOGLE_TOKEN_ENDPOINT, GoogleAuthError, GoogleIdentity, OAuthTransaction, validateIdToken } from './google-oauth';
import { hashPassword } from './password';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly env = loadEnv();

  constructor(private readonly prisma: PrismaService) {}

  get enabled(): boolean {
    return !!(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET && this.env.GOOGLE_REDIRECT_URI);
  }

  get clientId(): string {
    return this.env.GOOGLE_CLIENT_ID!;
  }

  get redirectUri(): string {
    return this.env.GOOGLE_REDIRECT_URI!;
  }

  /** Troca o authorization code (com o verificador PKCE) por tokens no Google e valida o id_token. */
  async exchangeCode(code: string, tx: OAuthTransaction): Promise<GoogleIdentity> {
    let res: Response;
    try {
      res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: tx.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new GoogleAuthError('google_indisponivel');
    }
    const body = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null;
    if (!res.ok || !body?.id_token) {
      this.logger.warn(`Troca de código recusada pelo Google (HTTP ${res.status}, ${body?.error ?? 'sem detalhe'})`);
      throw new GoogleAuthError('troca_recusada');
    }
    return validateIdToken(body.id_token, { clientId: this.clientId, nonce: tx.nonce });
  }

  /**
   * Conta pelo e-mail verificado pelo Google. Contas novas recebem senha aleatória inutilizável
   * (entram somente pelo Google). Contas existentes com o mesmo e-mail são reutilizadas.
   */
  async findOrCreateUser(identity: GoogleIdentity): Promise<{ id: string; created: boolean }> {
    const existing = await this.prisma.user.findUnique({ where: { email: identity.email }, select: { id: true } });
    if (existing) return { id: existing.id, created: false };
    const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
    try {
      const user = await this.prisma.user.create({ data: { email: identity.email, name: identity.name, passwordHash }, select: { id: true } });
      return { id: user.id, created: true };
    } catch {
      // corrida: outra requisição criou a mesma conta
      const again = await this.prisma.user.findUniqueOrThrow({ where: { email: identity.email }, select: { id: true } });
      return { id: again.id, created: false };
    }
  }
}
