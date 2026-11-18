import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { loadEnv } from '../../config/env';
import { ApiZodBody, ApiZodQuery, ZBody, ZQuery } from '../../common/zod';
import { AuthUser, CurrentUser, OptionalUser, Public } from './auth.decorators';
import { AuthService, EmailOnlySchema, LoginSchema, RegisterSchema, ResetPasswordSchema, TokenSchema } from './auth.service';
import { GoogleAuthService, GoogleStartSchema, OAUTH_COOKIE } from './google.service';
import { SessionService } from './session.service';

const env = loadEnv();
const authLimit = { default: { limit: env.THROTTLE_AUTH_LIMIT, ttl: 60_000 } };
// E-mails disparados por pedido do usuário: limite mais estrito para evitar abuso da caixa de terceiros.
const mailLimit = { default: { limit: Math.min(env.THROTTLE_AUTH_LIMIT, 5), ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly google: GoogleAuthService,
  ) {}

  @Public()
  @Get('config')
  config() {
    return this.auth.publicConfig();
  }

  @Public()
  @Throttle(authLimit)
  @Post('register')
  @ApiZodBody(RegisterSchema)
  async register(@ZBody(RegisterSchema) body: z.infer<typeof RegisterSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(body);
    if (this.auth.verificationRequired) return { verificationRequired: true, session: null };
    await this.sessions.create(user.id, req.get('user-agent'), res);
    return { verificationRequired: false, session: await this.auth.me(user.id) };
  }

  @Public()
  @Throttle(authLimit)
  @Post('login')
  @HttpCode(200)
  @ApiZodBody(LoginSchema)
  async login(@ZBody(LoginSchema) body: z.infer<typeof LoginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(body);
    await this.sessions.create(user.id, req.get('user-agent'), res);
    return this.auth.me(user.id);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@OptionalUser() user: AuthUser | null, @Res({ passthrough: true }) res: Response) {
    if (user) await this.sessions.destroy(user.sessionId, res);
    else this.sessions.clearCookie(res);
  }

  /** Sessão atual para a SPA: 200 com null quando não há login (evita 401 ruidoso para visitantes). */
  @Public()
  @Get('session')
  async session(@OptionalUser() user: AuthUser | null) {
    return user ? this.auth.me(user.id) : null;
  }

  @ApiCookieAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  // ─────────── Confirmação de e-mail ───────────

  @ApiCookieAuth()
  @Throttle(mailLimit)
  @Post('email-verification/resend')
  @HttpCode(200)
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  @Public()
  @Throttle(mailLimit)
  @Post('email-verification/request')
  @HttpCode(204)
  @ApiZodBody(EmailOnlySchema)
  async requestVerification(@ZBody(EmailOnlySchema) body: z.infer<typeof EmailOnlySchema>) {
    await this.auth.resendVerificationByEmail(body.email);
  }

  @Public()
  @Throttle(authLimit)
  @Post('email-verification/confirm')
  @HttpCode(200)
  @ApiZodBody(TokenSchema)
  async verifyEmail(@ZBody(TokenSchema) body: z.infer<typeof TokenSchema>) {
    await this.auth.verifyEmail(body.token);
    return { verified: true };
  }

  // ─────────── Recuperação de senha ───────────

  @Public()
  @Throttle(mailLimit)
  @Post('password/forgot')
  @HttpCode(204)
  @ApiZodBody(EmailOnlySchema)
  async forgot(@ZBody(EmailOnlySchema) body: z.infer<typeof EmailOnlySchema>) {
    await this.auth.requestPasswordReset(body.email);
  }

  @Public()
  @Throttle(authLimit)
  @Post('password/reset')
  @HttpCode(204)
  @ApiZodBody(ResetPasswordSchema)
  async reset(@ZBody(ResetPasswordSchema) body: z.infer<typeof ResetPasswordSchema>, @Res({ passthrough: true }) res: Response) {
    await this.auth.resetPassword(body);
    this.sessions.clearCookie(res);
  }

  // ─────────── Google ───────────

  @Public()
  @Throttle(authLimit)
  @Get('google/start')
  @ApiZodQuery(GoogleStartSchema)
  googleStart(@ZQuery(GoogleStartSchema) q: z.infer<typeof GoogleStartSchema>, @Res() res: Response) {
    const { url, cookie } = this.google.start(q);
    res.cookie(OAUTH_COOKIE, cookie, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/api/auth/google', maxAge: 10 * 60 * 1000 });
    res.redirect(302, url);
  }

  @Public()
  @Throttle(authLimit)
  @Get('google/callback')
  async googleCallback(
    @Query() q: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[OAUTH_COOKIE];
    res.clearCookie(OAUTH_COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/api/auth/google' });
    const outcome = await this.google.callback(
      { code: typeof q.code === 'string' ? q.code : undefined, state: typeof q.state === 'string' ? q.state : undefined, error: typeof q.error === 'string' ? q.error : undefined },
      cookie,
    );
    if (outcome.kind === 'redirect') return res.redirect(302, outcome.to);
    await this.sessions.create(outcome.userId, req.get('user-agent'), res);
    return res.redirect(302, outcome.next);
  }
}
