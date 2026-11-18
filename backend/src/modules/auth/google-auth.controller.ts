import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { loadEnv } from '../../config/env';
import { Public } from './auth.decorators';
import { GoogleAuthService } from './google-auth.service';
import {
  buildAuthUrl,
  decodeTransaction,
  encodeTransaction,
  GoogleAuthError,
  newTransaction,
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  OAUTH_TTL_MS,
} from './google-oauth';
import { SessionService } from './session.service';

const limit = { default: { limit: loadEnv().THROTTLE_AUTH_LIMIT, ttl: 60_000 } };

/**
 * Login com Google. As duas rotas são acessadas pelo domínio do front (proxy de /api), então o cookie de
 * sessão e o cookie temporário do fluxo ficam no domínio do front, e os redirecionamentos são relativos.
 */
@ApiTags('auth')
@Controller('auth')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);
  private readonly env = loadEnv();

  constructor(
    private readonly google: GoogleAuthService,
    private readonly sessions: SessionService,
  ) {}

  private cookieOptions() {
    return { httpOnly: true, secure: this.env.COOKIE_SECURE, sameSite: 'lax' as const, path: OAUTH_COOKIE_PATH };
  }

  /** Provedores de login disponíveis (o front só mostra o botão do Google se estiver configurado). */
  @Public()
  @Get('providers')
  providers() {
    return { google: this.google.enabled };
  }

  @Public()
  @Throttle(limit)
  @Get('google')
  @ApiExcludeEndpoint()
  start(@Query('next') next: string | undefined, @Res() res: Response) {
    if (!this.google.enabled) return res.redirect(302, '/entrar?erro=google_indisponivel');
    const tx = newTransaction(next ?? '/painel');
    res.cookie(OAUTH_COOKIE, encodeTransaction(tx), { ...this.cookieOptions(), maxAge: OAUTH_TTL_MS });
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, buildAuthUrl(tx, this.google.clientId, this.google.redirectUri));
  }

  @Public()
  @Throttle(limit)
  @Get('google/callback')
  @ApiExcludeEndpoint()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tx = decodeTransaction((req.cookies as Record<string, string> | undefined)?.[OAUTH_COOKIE]);
    res.clearCookie(OAUTH_COOKIE, this.cookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    const fail = (reason: string) => res.redirect(302, `/entrar?erro=google_${reason}`);

    if (!this.google.enabled) return fail('indisponivel');
    if (error) return fail(error === 'access_denied' ? 'cancelado' : 'recusado');
    if (!tx || !state || state !== tx.state) return fail('sessao_expirada');
    if (!code || code.length > 2048) return fail('recusado');

    try {
      const identity = await this.google.exchangeCode(code, tx);
      const user = await this.google.findOrCreateUser(identity);
      await this.sessions.create(user.id, req.get('user-agent'), res);
      return res.redirect(302, tx.next);
    } catch (e) {
      if (e instanceof GoogleAuthError) return fail(e.code);
      this.logger.error(e instanceof Error ? e.message : String(e));
      return fail('erro');
    }
  }
}
