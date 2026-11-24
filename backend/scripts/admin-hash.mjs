// Gera o hash Argon2id da senha do painel de administração (valor de ADMIN_PASSWORD_HASH).
// Uso: npm run admin:hash -w backend   (a senha é pedida no terminal e não fica no histórico)
import { hash, Algorithm } from '@node-rs/argon2';
import { createInterface } from 'node:readline';

const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
rl.stdoutMuted = true;
rl._writeToOutput = (s) => { if (!rl.stdoutMuted || s.includes('Senha')) process.stderr.write(s); };
rl.question('Senha do painel de administração: ', async (pw) => {
  rl.close();
  process.stderr.write('\n');
  if (!pw || pw.length < 8) { console.error('Use ao menos 8 caracteres.'); process.exit(1); }
  console.log(await hash(pw, { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }));
});
