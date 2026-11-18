import { createHash, randomBytes } from 'node:crypto';

/**
 * Login com Google (OpenID Connect, Authorization Code + PKCE). Funções puras e testáveis.
 *
 * O id_token é obtido diretamente do token endpoint do Google, via TLS e autenticado com o
 * client secret. Nesse caso a especificação OIDC (Core 1.0, §3.1.3.7) permite validar apenas as
 * claims, sem verificar a assinatura; validamos iss, aud, exp, nonce e email_verified.
 */
export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
export const OAUTH_COOKIE = 'rs_oauth_google';
export const OAUTH_COOKIE_PATH = '/api/auth/google';
export const OAUTH_TTL_MS = 10 * 60 * 1000;

const b64url = (buf: Buffer) => buf.toString('base64url');

export interface OAuthTransaction {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
}

export function newTransaction(next: string): OAuthTransaction {
  return { state: b64url(randomBytes(32)), verifier: b64url(randomBytes(48)), nonce: b64url(randomBytes(24)), next: safeNext(next) };
}

export const pkceChallenge = (verifier: string) => b64url(createHash('sha256').update(verifier).digest());

/** Só caminhos internos (evita open redirect). */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') && next.length <= 300
    ? next
    : '/painel';
}

export function buildAuthUrl(tx: OAuthTransaction, clientId: string, redirectUri: string): string {
  const u = new URL(GOOGLE_AUTH_ENDPOINT);
  u.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: tx.state,
    nonce: tx.nonce,
    code_challenge: pkceChallenge(tx.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return u.toString();
}

export function encodeTransaction(tx: OAuthTransaction): string {
  return b64url(Buffer.from(JSON.stringify(tx)));
}

export function decodeTransaction(raw: string | undefined): OAuthTransaction | null {
  if (!raw || raw.length > 2000) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if ([v?.state, v?.verifier, v?.nonce, v?.next].every((x) => typeof x === 'string')) return v as OAuthTransaction;
  } catch {
    /* cookie inválido */
  }
  return null;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

export class GoogleAuthError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Decodifica o payload do id_token e valida as claims obrigatórias. */
export function validateIdToken(idToken: string, expected: { clientId: string; nonce: string; now?: number }): GoogleIdentity {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new GoogleAuthError('token_invalido');
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new GoogleAuthError('token_invalido');
  }
  const now = Math.floor((expected.now ?? Date.now()) / 1000);
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!GOOGLE_ISSUERS.includes(String(c.iss))) throw new GoogleAuthError('emissor_invalido');
  if (!aud.includes(expected.clientId)) throw new GoogleAuthError('audiencia_invalida');
  if (typeof c.exp !== 'number' || c.exp + 60 < now) throw new GoogleAuthError('token_expirado');
  if (c.nonce !== expected.nonce) throw new GoogleAuthError('nonce_invalido');
  if (typeof c.sub !== 'string' || !c.sub) throw new GoogleAuthError('token_invalido');
  if (typeof c.email !== 'string' || !c.email.includes('@')) throw new GoogleAuthError('email_ausente');
  if (c.email_verified !== true && c.email_verified !== 'true') throw new GoogleAuthError('email_nao_verificado');
  const email = c.email.trim().toLowerCase();
  const name = typeof c.name === 'string' && c.name.trim().length >= 2 ? c.name.trim().slice(0, 120) : email.split('@')[0];
  return { sub: c.sub, email, name };
}
