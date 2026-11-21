import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContractorType } from './contract-data.rules';

const cache = new Map<ContractorType, string>();

/**
 * Lê o template .md (mantido fora do código para facilitar a edição do texto jurídico).
 * Caminhos literais com __dirname: o nest-cli copia os .md para dist e o rastreador da Vercel os inclui no bundle.
 */
export function loadTemplate(type: ContractorType): string {
  let t = cache.get(type);
  if (t === undefined) {
    t =
      type === 'VENUE'
        ? readFileSync(join(__dirname, 'templates', 'venue-artist.md'), 'utf8')
        : readFileSync(join(__dirname, 'templates', 'individual-artist.md'), 'utf8');
    cache.set(type, t);
  }
  return t;
}
