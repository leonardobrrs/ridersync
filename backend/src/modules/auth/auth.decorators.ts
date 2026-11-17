import { createParamDecorator, ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
/** Rota acessível sem login (o usuário, se houver sessão, ainda é resolvido). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  sessionId: string;
}

export type AuthedRequest = Request & { user?: AuthUser };

/** Usuário autenticado (obrigatório). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Faça login para continuar.' });
  return req.user;
});

/** Usuário opcional (rotas públicas). */
export const OptionalUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.user ?? null;
});
