import { createHash } from 'node:crypto';
import {
  buildAuthUrl,
  decodeTransaction,
  encodeTransaction,
  newTransaction,
  pkceChallenge,
  safeNext,
  validateIdToken,
} from './google-oauth';

const CLIENT = 'cliente-teste.apps.googleusercontent.com';
const jwt = (claims: Record<string, unknown>) =>
  ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'assinatura'].join('.');
const base = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: Math.floor(Date.now() / 1000) + 300,
  nonce: 'n1',
  sub: '1234567890',
  email: 'Pessoa.Teste@Gmail.com',
  email_verified: true,
  name: 'Pessoa Teste',
  ...over,
});

describe('login com Google — funções puras', () => {
  it('monta a URL de autorização com PKCE S256, state, nonce e escopos OIDC', () => {
    const tx = newTransaction('/painel/perfil');
    const u = new URL(buildAuthUrl(tx, CLIENT, 'http://localhost:5173/api/auth/google/callback'));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('client_id')).toBe(CLIENT);
    expect(u.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/auth/google/callback');
    expect(u.searchParams.get('scope')).toBe('openid email profile');
    expect(u.searchParams.get('state')).toBe(tx.state);
    expect(u.searchParams.get('nonce')).toBe(tx.nonce);
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('code_challenge')).toBe(createHash('sha256').update(tx.verifier).digest('base64url'));
    expect(pkceChallenge(tx.verifier)).not.toBe(tx.verifier);
  });

  it('gera valores aleatórios distintos a cada transação e os recupera do cookie', () => {
    const a = newTransaction('/painel');
    const b = newTransaction('/painel');
    expect(a.state).not.toBe(b.state);
    expect(decodeTransaction(encodeTransaction(a))).toEqual(a);
    expect(decodeTransaction('lixo')).toBeNull();
    expect(decodeTransaction(undefined)).toBeNull();
  });

  it('impede redirecionamento para fora do app', () => {
    expect(safeNext('/painel/negociacoes')).toBe('/painel/negociacoes');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', undefined, 42]) expect(safeNext(bad)).toBe('/painel');
  });

  it('aceita id_token válido e normaliza o e-mail', () => {
    expect(validateIdToken(jwt(base()), { clientId: CLIENT, nonce: 'n1' })).toEqual({
      sub: '1234567890',
      email: 'pessoa.teste@gmail.com',
      name: 'Pessoa Teste',
    });
  });

  it.each([
    [{ iss: 'https://evil.com' }, 'emissor_invalido'],
    [{ aud: 'outro-cliente' }, 'audiencia_invalida'],
    [{ exp: Math.floor(Date.now() / 1000) - 3600 }, 'token_expirado'],
    [{ nonce: 'outro' }, 'nonce_invalido'],
    [{ email_verified: false }, 'email_nao_verificado'],
    [{ email: undefined }, 'email_ausente'],
  ])('recusa id_token com %o', (over, code) => {
    expect(() => validateIdToken(jwt(base(over)), { clientId: CLIENT, nonce: 'n1' })).toThrow(code);
  });

  it('recusa token malformado', () => {
    expect(() => validateIdToken('a.b', { clientId: CLIENT, nonce: 'n1' })).toThrow('token_invalido');
  });
});
