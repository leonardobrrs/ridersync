import { Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { conflict } from '../../common/errors';
import { email, password, text } from '../../common/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';

export const RegisterSchema = z.object({
  name: text(2, 120, 'Nome'),
  email,
  password,
});
export const LoginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.').max(128),
});

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: z.infer<typeof RegisterSchema>) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw conflict('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.');
    return this.prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
      select: { id: true },
    });
  }

  async login(input: z.infer<typeof LoginSchema>) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true, passwordHash: true } });
    const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' });
    return { id: user.id };
  }

  /**
   * Dados privados da sessão: conta + contextos de atuação (perfil individual,
   * bandas e casas ativas) + contagem de convites pendentes.
   */
  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        musicianProfile: { select: { artist: { select: { id: true, slug: true, name: true, visibility: true } } } },
        bandMemberships: {
          where: { status: 'ACTIVE' },
          orderBy: { joinedAt: 'asc' },
          select: { bandId: true, role: true, band: { select: { artist: { select: { id: true, slug: true, name: true, visibility: true } } } } },
        },
        orgMemberships: {
          where: { status: 'ACTIVE' },
          orderBy: { joinedAt: 'asc' },
          select: { role: true, organization: { select: { id: true, slug: true, name: true } } },
        },
      },
    });
    const [bandInvites, orgInvites] = await Promise.all([
      this.prisma.bandMember.count({ where: { userId, status: 'INVITED' } }),
      this.prisma.organizationMember.count({ where: { userId, status: 'INVITED' } }),
    ]);
    return {
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      musician: user.musicianProfile?.artist ?? null,
      bands: user.bandMemberships
        .filter((m) => m.band.artist)
        .map((m) => ({ bandId: m.bandId, role: m.role, artist: m.band.artist! })),
      organizations: user.orgMemberships.map((m) => ({ ...m.organization, role: m.role })),
      pendingInvitations: bandInvites + orgInvites,
    };
  }
}
