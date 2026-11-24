import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { z } from 'zod';
import { loadEnv } from '../../config/env';
import { notFound, unauthorized } from '../../common/errors';
import { ZBody } from '../../common/zod';
import { Public } from '../auth/auth.decorators';
import { burnPasswordCheck, verifyPassword } from '../auth/password';
import { AdminGuard, adminConfig, clearAdminCookie, setAdminCookie } from './admin-auth';
import { AdminService } from './admin.service';

const LoginSchema = z.object({ username: z.string().trim().max(80), password: z.string().max(128) }).strict();
const INVALID = 'Usuário ou senha inválidos.';

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Painel de administração (/adm na SPA, /api/admin na API). Fora da documentação e sem link no sistema.
 * As rotas são @Public() para o guard de usuários (a sessão é outra) e protegidas pelo AdminGuard.
 */
@ApiExcludeController()
@Public()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('login')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@ZBody(LoginSchema) body: z.infer<typeof LoginSchema>, @Res({ passthrough: true }) res: Response) {
    const env = loadEnv();
    const cfg = adminConfig(env);
    if (!cfg) throw notFound();
    const userOk = sameText(body.username, cfg.username);
    const { ok } = userOk ? await verifyPassword(body.password, cfg.hash) : (await burnPasswordCheck(body.password), { ok: false });
    if (!userOk || !ok) throw unauthorized('INVALID_CREDENTIALS', INVALID);
    setAdminCookie(res, env);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    clearAdminCookie(res, loadEnv());
  }

  @Get('session')
  @UseGuards(AdminGuard)
  session() {
    return { authenticated: true };
  }

  @Get('overview')
  @UseGuards(AdminGuard)
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  @UseGuards(AdminGuard)
  users(@Query('q') q?: string) {
    return this.admin.users(q);
  }

  @Delete('users/:id')
  @UseGuards(AdminGuard)
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteUser(id);
  }

  @Get('artists')
  @UseGuards(AdminGuard)
  artists(@Query('q') q?: string) {
    return this.admin.artists(q);
  }

  @Delete('artists/:id')
  @UseGuards(AdminGuard)
  deleteArtist(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteArtist(id);
  }

  @Get('organizations')
  @UseGuards(AdminGuard)
  organizations(@Query('q') q?: string) {
    return this.admin.organizations(q);
  }

  @Delete('organizations/:id')
  @UseGuards(AdminGuard)
  deleteOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteOrganization(id);
  }

  @Get('events')
  @UseGuards(AdminGuard)
  events(@Query('q') q?: string) {
    return this.admin.events(q);
  }

  @Delete('events/:id')
  @UseGuards(AdminGuard)
  deleteEvent(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteEvent(id);
  }

  @Get('bookings')
  @UseGuards(AdminGuard)
  bookings(@Query('q') q?: string) {
    return this.admin.bookings(q);
  }

  @Delete('bookings/:id')
  @UseGuards(AdminGuard)
  deleteBooking(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteBooking(id);
  }
}
