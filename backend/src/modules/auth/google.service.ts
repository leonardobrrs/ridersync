import { Injectable, Logger } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { appSecret, googleEnabled, loadEnv } from '../../config/env';
import { badRequest } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PRIVACY_POLICY_VERSION } from './auth.service';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const VALID_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_COOKIE = 'rs_oauth';

/** Caminho interno seguro para redirecionar após o login (evita open redirect). */
export const safeNext = (v: unknown) => (typeof v === 'string' && /^\/(?!\/)[\w\-/?=&%.]*$/.test(v) && v.length <= 200 ? v : '/painel');

export const GoogleStartSchema = z.object({
  intent: z.enum(['login', 'signup']).default('login'),
  accountType: z.enum(['ARTIST', 'CONTRACTOR']).optional(),
  acceptTerms: z.enum(['1']).optional(),
  next: z.string().max(200).optional(),
});

interface OAuthState {
  nonce: string;
  verifier: string;
  intent: 'login' | 'signup';
  accountType?: AccountType;
  acceptTerms: boolean;
  next: string;
  exp: number;
}

export type GoogleOutcome = { kind: 'session'; userId: string; next: string } | { kind: 'redirect'; to: string };

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  get enabled() {
    return googleEnabled(this.env);
  }

  private get redirectUri() {
    return new URL('/api/auth/google/callback', this.env.PUBLIC_APP_URL).toString();
  }

  private sign(payload: string) {
    return createHmac('sha256', appSecret(this.env)).update(payload).digest('base64url');
  }

  /** Monta a URL de autorização e o cookie de estado assinado (nonce + PKCE verifier). */
  start(input: z.infer<typeof GoogleStartSchema>) {
    if (!this.enabled) throw badRequest('GOOGLE_DISABLED', 'Login com Google não está configurado neste ambiente.');
    if (input.intent === 'signup' && (!input.accountType || input.acceptTerms !== '1')) {
      throw badRequest('SIGNUP_INCOMPLETE', 'Escolha o tipo de conta e aceite os termos antes de continuar com o Google.');
    }
    const state: OAuthState = {
      nonce: randomBytes(16).toString('base64url'),
      verifier: randomBytes(48).toString('base64url'),
      intent: input.intent,
      accountType: input.accountType,
      acceptTerms: input.acceptTerms === '1',
      next: safeNext(input.next),
      exp: Date.now() + STATE_TTL_MS,
    };
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const challenge = createHash('sha256').update(state.verifier).digest('base64url');
    const url = new URL(AUTH_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: state.nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return { url: url.toString(), cookie: `${payload}.${this.sign(payload)}` };
  }

  private readState(cookie: string | undefined, nonce: string | undefined): OAuthState | null {
    if (!cookie || !nonce) return null;
    const [payload, sig] = cookie.split('.');
    if (!payload || !sig) return null;
    const expected = Buffer.from(this.sign(payload));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const state = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OAuthState;
      if (state.exp < Date.now() || state.nonce !== nonce) return null;
      return state;
    } catch {
      return null;
    }
  }

  async callback(query: { code?: string; state?: string; error?: string }, cookie: string | undefined): Promise<GoogleOutcome> {
    const state = this.readState(cookie, query.state);
    if (!state || query.error || !query.code || !this.enabled) {
      return { kind: 'redirect', to: '/entrar?erro=google' };
    }
    let profile: { sub: string; email: string; name: string };
    try {
      profile = await this.exchange(query.code, state.verifier);
    } catch (e) {
      this.logger.warn(`Falha no retorno do Google: ${e instanceof Error ? e.message : String(e)}`);
      return { kind: 'redirect', to: '/entrar?erro=google' };
    }

    const bySub = await this.prisma.user.findUnique({ where: { googleSub: profile.sub }, select: { id: true, anonymizedAt: true } });
    if (bySub && !bySub.anonymizedAt) return { kind: 'session', userId: bySub.id, next: state.next };

    const byEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true, emailVerifiedAt: true, anonymizedAt: true },
    });
    if (byEmail && !byEmail.anonymizedAt) {
      await this.linkExisting(byEmail.id, !!byEmail.emailVerifiedAt, profile.sub);
      return { kind: 'session', userId: byEmail.id, next: state.next };
    }

    if (state.intent !== 'signup' || !state.accountType || !state.acceptTerms) {
      return { kind: 'redirect', to: '/cadastro?google=sem-conta' };
    }
    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name.slice(0, 120) || profile.email.split('@')[0],
        googleSub: profile.sub,
        accountType: state.accountType,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: PRIVACY_POLICY_VERSION,
      },
      select: { id: true },
    });
    return { kind: 'session', userId: user.id, next: state.next };
  }

  /**
   * Vincula o Google a uma conta existente com o mesmo e-mail (verificado pelo Google).
   * Se o e-mail da conta nunca foi confirmado, a senha e as sessões existentes são descartadas:
   * impede que alguém que cadastrou o e-mail de outra pessoa mantenha acesso após o vínculo.
   */
  private async linkExisting(userId: string, alreadyVerified: boolean, sub: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { googleSub: sub, emailVerifiedAt: new Date(), ...(alreadyVerified ? {} : { passwordHash: null }) },
      });
      if (!alreadyVerified) await tx.session.deleteMany({ where: { userId } });
      await this.notifications.notify(tx, [userId], {
        category: 'ACCOUNT',
        type: 'GOOGLE_LINKED',
        title: 'Login com Google ativado',
        body: 'Sua conta RiderSync agora pode ser acessada com o Google. Se não foi você, redefina sua senha e entre em contato.',
        link: '/painel/conta',
        dedupeKey: `google-linked:${sub}`,
      });
    });
    await this.notifications.flush();
  }

  /** Troca o código pelo id_token. O token vem diretamente do endpoint do Google por TLS (OIDC Core 3.1.3.7). */
  private async exchange(code: string, verifier: string) {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.env.GOOGLE_CLIENT_ID!,
        client_secret: this.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`token endpoint ${res.status}`);
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new Error('id_token ausente');
    return parseGoogleIdToken(body.id_token, this.env.GOOGLE_CLIENT_ID!);
  }
}

/** Valida as declarações do id_token (emissor, público, expiração e e-mail verificado). */
export function parseGoogleIdToken(idToken: string, clientId: string, now = Date.now()) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('id_token malformado');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>;
  if (!VALID_ISSUERS.includes(String(claims.iss))) throw new Error('emissor inválido');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(clientId)) throw new Error('público inválido');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) throw new Error('token expirado');
  if (claims.email_verified !== true || typeof claims.email !== 'string' || typeof claims.sub !== 'string') {
    throw new Error('e-mail não verificado pelo Google');
  }
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: typeof claims.name === 'string' ? claims.name : '' };
}
