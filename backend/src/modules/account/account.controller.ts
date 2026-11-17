import { Controller, HttpCode, Module, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { password, text } from '../../common/validation';
import { ApiZodBody, ZBody } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { hashPassword, verifyPassword } from '../auth/password';
import { SessionService } from '../auth/session.service';

const UpdateAccountSchema = z.object({ name: text(2, 120, 'Nome') });
const ChangePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Informe a senha atual.').max(128), newPassword: password })
  .refine((v) => v.currentPassword !== v.newPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual.' });

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async update(userId: string, input: z.infer<typeof UpdateAccountSchema>) {
    await this.prisma.user.update({ where: { id: userId }, data: { name: input.name } });
  }

  async changePassword(user: AuthUser, input: z.infer<typeof ChangePasswordSchema>) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(input.currentPassword, current.passwordHash))) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Senha atual incorreta.' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
    await this.sessions.revokeOthers(user.id, user.sessionId);
  }
}

@ApiTags('account')
@ApiCookieAuth()
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
  ) {}

  @Patch()
  @ApiZodBody(UpdateAccountSchema)
  async update(@CurrentUser() user: AuthUser, @ZBody(UpdateAccountSchema) body: z.infer<typeof UpdateAccountSchema>) {
    await this.account.update(user.id, body);
    return this.auth.me(user.id);
  }

  @Post('password')
  @HttpCode(204)
  @ApiZodBody(ChangePasswordSchema)
  async changePassword(@CurrentUser() user: AuthUser, @ZBody(ChangePasswordSchema) body: z.infer<typeof ChangePasswordSchema>) {
    await this.account.changePassword(user, body);
  }
}

@Module({ imports: [AuthModule], controllers: [AccountController], providers: [AccountService] })
export class AccountModule {}
