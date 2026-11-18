import { randomBytes, scryptSync } from 'node:crypto';
import { password } from '../../common/validation';
import { hashPassword, verifyPassword } from './password';

/** Gera um hash no formato legado (anterior à migração para Argon2id). */
function legacyScrypt(pw: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', 16384, 8, 1, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

describe('hash de senha (Argon2id + migração do scrypt legado)', () => {
  it('gera Argon2id e verifica sem pedir rehash', async () => {
    const h = await hashPassword('Senha@Forte1');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('Senha@Forte1', h)).toEqual({ ok: true, needsRehash: false });
    expect((await verifyPassword('senha@forte1', h)).ok).toBe(false);
  });

  it('aceita hash scrypt legado e sinaliza rehash; senha errada não sinaliza', async () => {
    const legacy = legacyScrypt('antiga-senha-123');
    expect(await verifyPassword('antiga-senha-123', legacy)).toEqual({ ok: true, needsRehash: true });
    expect(await verifyPassword('outra', legacy)).toEqual({ ok: false, needsRehash: false });
  });

  it('hash ausente ou malformado nunca autentica', async () => {
    expect((await verifyPassword('x', null)).ok).toBe(false);
    expect((await verifyPassword('x', 'scrypt$quebrado')).ok).toBe(false);
    expect((await verifyPassword('x', '$argon2id$lixo')).ok).toBe(false);
  });
});

describe('política de senha', () => {
  it.each([
    ['curta', 'Ab@1'],
    ['sem maiúscula', 'senha@forte1'],
    ['sem número', 'Senha@Forte'],
    ['sem especial', 'SenhaForte1'],
  ])('rejeita senha %s', (_label, value) => {
    expect(password.safeParse(value).success).toBe(false);
  });

  it('aceita senha com 8+ caracteres, maiúscula, número e especial', () => {
    expect(password.safeParse('Senha@Forte1').success).toBe(true);
  });

  it('informa cada regra violada em português', () => {
    const r = password.safeParse('abc');
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message).join(' ');
    expect(msgs).toMatch(/8 caracteres/);
    expect(msgs).toMatch(/maiúscula/);
    expect(msgs).toMatch(/número/);
    expect(msgs).toMatch(/especial/);
  });
});
