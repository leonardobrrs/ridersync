import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { appSecret, Env, loadEnv } from '../../config/env';
import { notFound, unauthorized } from '../../common/errors';

/**
 * Sessão do painel de administração — independente das contas de usuário.
 * Credenciais vêm do ambiente (ADMIN_USERNAME + ADMIN_PASSWORD_HASH em Argon2id). O cookie é um token assinado
 * (HMAC com APP_SECRET) com validade curta; ele também depende do hash da senha, então trocar a senha derruba as sessões.
 */
export const ADMIN_COOKIE = 'rs_admin';
export const ADMIN_SESSION_HOURS = 8;

export function adminConfig(env: Env = loadEnv()) {
  const username = env.ADMIN_USERNAME?.trim();
  const hash = env.ADMIN_PASSWORD_HASH?.trim();
  if (!username || !hash?.startsWith('$argon2')) return null;
  return { username, hash };
}

function sign(payload: string, env: Env, hash: string) {
  return createHmac('sha256', appSecret(env)).update(`admin|${hash}|${payload}`).digest('base64url');
}

export function issueAdminToken(env: Env, now = Date.now()) {
  const cfg = adminConfig(env)!;
  const exp = now + ADMIN_SESSION_HOURS * 3600_000;
  const payload = `${cfg.username}.${exp}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload, env, cfg.hash)}`;
}

export function verifyAdminToken(token: string | undefined, env: Env, now = Date.now()): boolean {
  const cfg = adminConfig(env);
  if (!cfg || !token) return false;
  const [p64, mac] = token.split('.');
  if (!p64 || !mac) return false;
  const payload = Buffer.from(p64, 'base64url').toString();
  const expected = sign(payload, env, cfg.hash);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const dot = payload.lastIndexOf('.');
  const user = payload.slice(0, dot);
  const exp = Number(payload.slice(dot + 1));
  return user === cfg.username && Number.isFinite(exp) && exp > now;
}

export function setAdminCookie(res: Response, env: Env) {
  res.cookie(ADMIN_COOKIE, issueAdminToken(env), {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: ADMIN_SESSION_HOURS * 3600_000,
  });
}

export function clearAdminCookie(res: Response, env: Env) {
  res.clearCookie(ADMIN_COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'strict', path: '/api/admin' });
}

/** Painel desativado → 404 (não revela que existe). Ativo sem sessão → 401. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const env = loadEnv();
    if (!adminConfig(env)) throw notFound();
    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.cookies as Record<string, string> | undefined)?.[ADMIN_COOKIE];
    if (!verifyAdminToken(token, env)) throw unauthorized('ADMIN_UNAUTHENTICATED', 'Entre no painel de administração.');
    return true;
  }
}
