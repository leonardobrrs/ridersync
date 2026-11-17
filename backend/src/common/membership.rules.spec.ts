import { assertBandCanInvite, assertBandCanRemove, assertKeepsAnOwner } from './membership.rules';

describe('regras de membership', () => {
  it('bloqueia remover/rebaixar o último OWNER', () => {
    expect(() => assertKeepsAnOwner({ activeOwners: 1, targetIsOwner: true, targetStaysOwner: false })).toThrow(/último proprietário/);
  });
  it('permite rebaixar um OWNER quando há outro OWNER ativo', () => {
    expect(() => assertKeepsAnOwner({ activeOwners: 2, targetIsOwner: true, targetStaysOwner: false })).not.toThrow();
  });
  it('não interfere em alterações de quem não é OWNER', () => {
    expect(() => assertKeepsAnOwner({ activeOwners: 1, targetIsOwner: false, targetStaysOwner: false })).not.toThrow();
  });
  it('OWNER não pode ser concedido por convite', () => {
    expect(() => assertBandCanInvite('OWNER', 'OWNER')).toThrow();
  });
  it('MEMBER não convida; ADMIN só convida MEMBER', () => {
    expect(() => assertBandCanInvite('MEMBER', 'MEMBER')).toThrow();
    expect(() => assertBandCanInvite('ADMIN', 'ADMIN')).toThrow();
    expect(() => assertBandCanInvite('ADMIN', 'MEMBER')).not.toThrow();
    expect(() => assertBandCanInvite('OWNER', 'ADMIN')).not.toThrow();
  });
  it('remoção: OWNER remove todos; ADMIN só MEMBER; MEMBER ninguém', () => {
    expect(() => assertBandCanRemove('OWNER', 'ADMIN')).not.toThrow();
    expect(() => assertBandCanRemove('ADMIN', 'MEMBER')).not.toThrow();
    expect(() => assertBandCanRemove('ADMIN', 'ADMIN')).toThrow();
    expect(() => assertBandCanRemove('MEMBER', 'MEMBER')).toThrow();
  });
});
