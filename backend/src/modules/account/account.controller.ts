import { Controller, Delete, Get, HttpCode, Module, Patch, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { ApiZodBody, ZBody } from '../../common/zod';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import type { UploadedFile as File } from '../media/media.service';
import { uploadInterceptor } from '../media/upload';
import { AccountDeletionService, DeleteAccountSchema } from './account-deletion.service';
import { AcceptTermsSchema, AccountService, AccountTypeSchema, ChangePasswordSchema, UpdateAccountSchema } from './account.service';

const sensitiveLimit = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('account')
@ApiCookieAuth()
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly deletion: AccountDeletionService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Patch()
  @ApiZodBody(UpdateAccountSchema)
  async update(@CurrentUser() user: AuthUser, @ZBody(UpdateAccountSchema) body: z.infer<typeof UpdateAccountSchema>) {
    await this.account.update(user.id, body);
    return this.auth.me(user.id);
  }

  @Throttle(sensitiveLimit)
  @Post('password')
  @HttpCode(204)
  @ApiZodBody(ChangePasswordSchema)
  async changePassword(@CurrentUser() user: AuthUser, @ZBody(ChangePasswordSchema) body: z.infer<typeof ChangePasswordSchema>) {
    await this.account.changePassword(user, body);
  }

  @Post('account-type')
  @ApiZodBody(AccountTypeSchema)
  async chooseType(@CurrentUser() user: AuthUser, @ZBody(AccountTypeSchema) body: z.infer<typeof AccountTypeSchema>) {
    await this.account.chooseAccountType(user.id, body);
    return this.auth.me(user.id);
  }

  @Post('accept-terms')
  @ApiZodBody(AcceptTermsSchema)
  async acceptTerms(@CurrentUser() user: AuthUser, @ZBody(AcceptTermsSchema) _body: z.infer<typeof AcceptTermsSchema>) {
    await this.account.acceptTerms(user.id);
    return this.auth.me(user.id);
  }

  @Put('avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(uploadInterceptor())
  async setAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: File) {
    await this.account.setAvatar(user.id, file);
    return this.auth.me(user.id);
  }

  @Delete('avatar')
  async removeAvatar(@CurrentUser() user: AuthUser) {
    await this.account.removeAvatar(user.id);
    return this.auth.me(user.id);
  }

  @Post('sessions/revoke-others')
  @HttpCode(204)
  async revokeOthers(@CurrentUser() user: AuthUser) {
    await this.account.revokeOtherSessions(user);
  }

  @Throttle(sensitiveLimit)
  @Get('export')
  async export(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', 'attachment; filename="ridersync-meus-dados.json"');
    res.setHeader('Cache-Control', 'no-store');
    return this.account.exportData(user.id);
  }

  @Throttle(sensitiveLimit)
  @Post('delete')
  @HttpCode(204)
  @ApiZodBody(DeleteAccountSchema)
  async delete(
    @CurrentUser() user: AuthUser,
    @ZBody(DeleteAccountSchema) body: z.infer<typeof DeleteAccountSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.deletion.delete(user.id, body);
    this.sessions.clearCookie(res);
  }
}

@Module({ imports: [AuthModule], controllers: [AccountController], providers: [AccountService, AccountDeletionService] })
export class AccountModule {}
