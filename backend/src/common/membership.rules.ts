import { conflict, forbidden } from './errors';

/**
 * Regras puras de memberships (bandas e organizações).
 * O chamador deve executá-las dentro de uma transação com lock da entidade-mãe
 * (SELECT ... FOR UPDATE) para evitar condições de corrida.
 */

/** Impede que a operação deixe a entidade sem nenhum OWNER ativo. */
export function assertKeepsAnOwner(params: { activeOwners: number; targetIsOwner: boolean; targetStaysOwner: boolean }) {
  const { activeOwners, targetIsOwner, targetStaysOwner } = params;
  if (targetIsOwner && !targetStaysOwner && activeOwners <= 1) {
    throw conflict(
      'LAST_OWNER',
      'Não é possível remover ou rebaixar o último proprietário (OWNER). Transfira a propriedade para outro integrante antes.',
    );
  }
}

type BandRoleT = 'OWNER' | 'ADMIN' | 'MEMBER';

/** Quem pode convidar com qual papel (banda): OWNER convida ADMIN/MEMBER; ADMIN convida MEMBER. OWNER só por transferência. */
export function assertBandCanInvite(actor: BandRoleT, invitedRole: BandRoleT) {
  if (invitedRole === 'OWNER') throw forbidden('O papel OWNER só pode ser concedido por transferência de propriedade.');
  if (actor === 'MEMBER') throw forbidden('Integrantes com papel MEMBER não podem convidar.');
  if (actor === 'ADMIN' && invitedRole !== 'MEMBER') throw forbidden('Administradores só podem convidar integrantes com papel MEMBER.');
}

/** Remoção de integrante (banda): OWNER remove qualquer um; ADMIN remove apenas MEMBER; MEMBER não remove. */
export function assertBandCanRemove(actor: BandRoleT, target: BandRoleT) {
  if (actor === 'OWNER') return;
  if (actor === 'ADMIN' && target === 'MEMBER') return;
  throw forbidden(actor === 'MEMBER' ? 'Integrantes MEMBER não administram a banda.' : 'Administradores só podem remover integrantes MEMBER.');
}
