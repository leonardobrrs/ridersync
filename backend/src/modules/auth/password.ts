import { Algorithm, hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

// Parâmetros mínimos recomendados pela OWASP para Argon2id (19 MiB, 2 iterações, paralelismo 1).
const ARGON2_OPTIONS = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

/**
 * Verifica Argon2id e o formato legado scrypt$N$r$p$salt$hash (contas anteriores à migração).
 * `needsRehash` sinaliza que o login deve regravar o hash em Argon2id — migração transparente,
 * sem invalidar sessões nem exigir troca de senha.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) return { ok: false, needsRehash: false };
  if (stored.startsWith('$argon2')) {
    const ok = await argon2Verify(stored, password).catch(() => false);
    return { ok, needsRehash: false };
  }
  const ok = await verifyLegacyScrypt(password, stored);
  return { ok, needsRehash: ok };
}

async function verifyLegacyScrypt(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;

/** Executa uma verificação real descartável para equalizar o tempo de resposta quando a conta não existe ou não tem senha. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('ridersync-timing-equalizer');
  await argon2Verify(await dummyHash, password).catch(() => false);
}
