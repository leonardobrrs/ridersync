import { acceptsApplications, assertApplicationTransition, assertEventTransition } from './event.rules';

const now = new Date('2026-11-17T12:00:00Z');
const future = new Date('2026-12-01T12:00:00Z');
const past = new Date('2026-11-01T12:00:00Z');

describe('transições de Event', () => {
  it('DRAFT → OPEN com prazo futuro', () => {
    expect(() => assertEventTransition('DRAFT', 'OPEN', { now, startsAt: future, applicationDeadline: future })).not.toThrow();
  });
  it('não abre inscrições com prazo vencido', () => {
    expect(() => assertEventTransition('DRAFT', 'OPEN', { now, startsAt: future, applicationDeadline: past })).toThrow(/prazo/);
  });
  it('não permite DRAFT → COMPLETED nem sair de CANCELLED', () => {
    expect(() => assertEventTransition('DRAFT', 'COMPLETED', { now, startsAt: past, applicationDeadline: past })).toThrow();
    expect(() => assertEventTransition('CANCELLED', 'OPEN', { now, startsAt: future, applicationDeadline: future })).toThrow();
  });
  it('só conclui após a data da apresentação', () => {
    expect(() => assertEventTransition('CLOSED', 'COMPLETED', { now, startsAt: future, applicationDeadline: past })).toThrow();
    expect(() => assertEventTransition('CLOSED', 'COMPLETED', { now, startsAt: past, applicationDeadline: past })).not.toThrow();
  });
  it('inscrições abertas exigem OPEN e prazo não vencido', () => {
    expect(acceptsApplications({ status: 'OPEN', applicationDeadline: future }, now)).toBe(true);
    expect(acceptsApplications({ status: 'OPEN', applicationDeadline: past }, now)).toBe(false);
    expect(acceptsApplications({ status: 'CLOSED', applicationDeadline: future }, now)).toBe(false);
  });
});

describe('transições de EventApplication', () => {
  it('PENDING pode ser aceita, rejeitada ou retirada', () => {
    for (const to of ['ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const) expect(() => assertApplicationTransition('PENDING', to)).not.toThrow();
  });
  it('REJECTED é final', () => {
    expect(() => assertApplicationTransition('REJECTED', 'ACCEPTED')).toThrow();
  });
});
