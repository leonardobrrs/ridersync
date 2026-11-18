import { parseGoogleIdToken, safeNext } from './google.service';

const CLIENT = 'cliente-123.apps.googleusercontent.com';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (claims: Record<string, unknown>) => `${b64({ alg: 'RS256' })}.${b64(claims)}.assinatura`;
const now = Date.UTC(2026, 10, 18);
const valid = { iss: 'https://accounts.google.com', aud: CLIENT, exp: now / 1000 + 600, sub: '1234567890', email: 'Pessoa@Exemplo.com', email_verified: true, name: 'Pessoa' };

describe('validação do id_token do Google', () => {
  it('aceita token válido e normaliza o e-mail', () => {
    expect(parseGoogleIdToken(token(valid), CLIENT, now)).toEqual({ sub: '1234567890', email: 'pessoa@exemplo.com', name: 'Pessoa' });
  });
  it.each([
    ['emissor', { iss: 'https://evil.example' }],
    ['público', { aud: 'outro-cliente' }],
    ['expirado', { exp: now / 1000 - 1 }],
    ['e-mail não verificado', { email_verified: false }],
    ['sem sub', { sub: undefined }],
  ])('rejeita token com %s inválido', (_label, over) => {
    expect(() => parseGoogleIdToken(token({ ...valid, ...over }), CLIENT, now)).toThrow();
  });
  it('rejeita token malformado', () => {
    expect(() => parseGoogleIdToken('abc', CLIENT, now)).toThrow();
  });
});

describe('redirecionamento pós-login (anti open redirect)', () => {
  it.each(['/painel', '/painel/negociacoes/abc', '/artistas/ana-lins?aba=rider'])('aceita caminho interno %s', (p) => {
    expect(safeNext(p)).toBe(p);
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil', 'javascript:alert(1)', '', undefined, 42])('troca %s por /painel', (p) => {
    expect(safeNext(p)).toBe('/painel');
  });
});
