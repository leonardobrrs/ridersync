import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { loadEnv } from '../../config/env';
import { ApiZodBody, ZBody } from '../../common/zod';
import { AuthUser, CurrentUser, OptionalUser, Public } from './auth.decorators';
import { AuthService, LoginSchema, RegisterSchema } from './auth.service';
import { SessionService } from './session.service';

const authLimit = { default: { limit: loadEnv().THROTTLE_AUTH_LIMIT, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle(authLimit)
  @Post('register')
  @ApiZodBody(RegisterSchema)
  async register(
    @ZBody(RegisterSchema) body: z.infer<typeof RegisterSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(body);
    await this.sessions.create(user.id, req.get('user-agent'), res);
    return this.auth.me(user.id);
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
}
