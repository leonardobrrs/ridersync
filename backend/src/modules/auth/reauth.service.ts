import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { forbidden, unauthorized } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyPassword } from './password';

export const PasswordConfirmationSchema = z.string({ error: 'Informe sua senha.' }).min(1, 'Informe sua senha.').max(128);

/** Confirmação de identidade por senha para operações críticas (ex.: transferência de propriedade). */
@Injectable()
export class ReauthService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    if (!user.passwordHash) {
      throw forbidden('Defina uma senha em "Conta" para confirmar operações críticas.', 'PASSWORD_REQUIRED');
    }
    const { ok } = await verifyPassword(password, user.passwordHash);
    if (!ok) throw unauthorized('INVALID_PASSWORD', 'Senha incorreta.');
  }
}
