import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { corsOrigins, loadEnv, originMatcher } from '../../config/env';
import { AuthedRequest, IS_PUBLIC } from './auth.decorators';
import { SESSION_COOKIE, SessionService } from './session.service';

/**
 * Guard global:
 *  1) Proteção CSRF para métodos que alteram estado: exige o cabeçalho
 *     `X-Requested-With: RiderSync` (força preflight CORS em requisições cross-site)
 *     e, quando o navegador envia `Origin`, ela deve estar na lista permitida.
 *     Combinado com cookie SameSite=Lax.
 *  2) Resolve a sessão a partir do cookie HttpOnly e exige login, exceto em rotas @Public().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly isAllowedOrigin = originMatcher(corsOrigins(loadEnv()));

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('x-requested-with') !== 'RiderSync') {
        throw new ForbiddenException({ code: 'CSRF', message: 'Requisição recusada (cabeçalho de origem ausente).' });
      }
      const origin = req.get('origin');
      if (origin && !this.isAllowedOrigin(origin) && !isSameOrigin(origin, req.get('host'))) {
        throw new ForbiddenException({ code: 'CSRF', message: 'Origem não permitida.' });
      }
    }

    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    req.user = (await this.sessions.resolve(token)) ?? undefined;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' });
    return true;
  }
}

function isSameOrigin(origin: string, host: string | undefined): boolean {
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
