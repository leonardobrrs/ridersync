import { EventStatus } from '@prisma/client';
import {
  acceptsApplications,
  assertApplicationTransition,
  assertEventTransition,
  EVENT_TRANSITIONS,
  statusAfterSlotChange,
  sweepTarget,
} from './event.rules';

const now = new Date('2026-11-17T12:00:00Z');
const future = new Date('2026-12-01T12:00:00Z');
const past = new Date('2026-11-01T12:00:00Z');
const ctx = (over: Partial<Parameters<typeof assertEventTransition>[2]> = {}) => ({
  now,
  startsAt: future,
  applicationDeadline: future,
  filledSlots: 0,
  slots: 2,
  ...over,
});

describe('transições manuais de Event', () => {
  it('DRAFT → OPEN com prazo futuro', () => {
    expect(() => assertEventTransition('DRAFT', 'OPEN', ctx())).not.toThrow();
  });
  it('não abre inscrições com prazo vencido ou data passada', () => {
    expect(() => assertEventTransition('DRAFT', 'OPEN', ctx({ applicationDeadline: past }))).toThrow(/prazo/);
    expect(() => assertEventTransition('CLOSED', 'OPEN', ctx({ startsAt: past, applicationDeadline: past }))).toThrow();
  });
  it('não reabre inscrições com todas as vagas ocupadas', () => {
    expect(() => assertEventTransition('CLOSED', 'OPEN', ctx({ filledSlots: 2, slots: 2 }))).toThrow(/vagas/);
  });
  it('não permite DRAFT → COMPLETED nem sair de estados finais', () => {
    expect(() => assertEventTransition('DRAFT', 'COMPLETED', ctx({ startsAt: past }))).toThrow();
    for (const to of ['OPEN', 'CLOSED', 'POSTPONED'] as EventStatus[]) {
      expect(() => assertEventTransition('CANCELLED', to, ctx())).toThrow();
      expect(() => assertEventTransition('COMPLETED', to, ctx())).toThrow();
    }
  });
  it('só conclui após a data da apresentação', () => {
    expect(() => assertEventTransition('CLOSED', 'COMPLETED', ctx({ applicationDeadline: past }))).toThrow();
    expect(() => assertEventTransition('CLOSED', 'COMPLETED', ctx({ startsAt: past, applicationDeadline: past }))).not.toThrow();
    expect(() => assertEventTransition('FILLED', 'COMPLETED', ctx({ startsAt: past, applicationDeadline: past }))).not.toThrow();
  });
  it('adiar é possível a partir de estados ativos; adiado só volta por OPEN/CLOSED ou cancelamento', () => {
    for (const from of ['OPEN', 'FILLED', 'CLOSED'] as EventStatus[]) expect(() => assertEventTransition(from, 'POSTPONED', ctx())).not.toThrow();
    expect(() => assertEventTransition('DRAFT', 'POSTPONED', ctx())).toThrow();
    expect(EVENT_TRANSITIONS.POSTPONED).toEqual(expect.arrayContaining(['OPEN', 'CLOSED', 'CANCELLED']));
    expect(EVENT_TRANSITIONS.POSTPONED).not.toContain('FILLED');
  });
  it('FILLED nunca é alvo de ação manual (é automático)', () => {
    for (const from of Object.keys(EVENT_TRANSITIONS) as EventStatus[]) expect(EVENT_TRANSITIONS[from]).not.toContain('FILLED');
  });
  it('inscrições abertas exigem OPEN e prazo não vencido', () => {
    expect(acceptsApplications({ status: 'OPEN', applicationDeadline: future }, now)).toBe(true);
    expect(acceptsApplications({ status: 'OPEN', applicationDeadline: past }, now)).toBe(false);
    expect(acceptsApplications({ status: 'FILLED', applicationDeadline: future }, now)).toBe(false);
    expect(acceptsApplications({ status: 'CLOSED', applicationDeadline: future }, now)).toBe(false);
  });
});

describe('transições automáticas por vagas', () => {
  const event = (status: EventStatus, deadline = future) => ({ status, slots: 2, applicationDeadline: deadline });
  it('OPEN → FILLED ao ocupar a última vaga', () => {
    expect(statusAfterSlotChange(event('OPEN'), 1, now)).toBe('OPEN');
    expect(statusAfterSlotChange(event('OPEN'), 2, now)).toBe('FILLED');
  });
  it('FILLED → OPEN ao liberar vaga com prazo vigente; → CLOSED se o prazo venceu', () => {
    expect(statusAfterSlotChange(event('FILLED'), 1, now)).toBe('OPEN');
    expect(statusAfterSlotChange(event('FILLED', past), 1, now)).toBe('CLOSED');
  });
  it('não altera estados fora de OPEN/FILLED', () => {
    for (const s of ['CLOSED', 'POSTPONED', 'CANCELLED', 'COMPLETED', 'DRAFT'] as EventStatus[]) {
      expect(statusAfterSlotChange(event(s), 2, now)).toBe(s);
      expect(statusAfterSlotChange(event(s), 0, now)).toBe(s);
    }
  });
});

describe('transições automáticas por data', () => {
  it('prazo vencido fecha inscrições', () => {
    expect(sweepTarget({ status: 'OPEN', startsAt: future, applicationDeadline: past }, false, now)).toBe('CLOSED');
  });
  it('após a data: COMPLETED com contratação confirmada; CLOSED sem contratação', () => {
    for (const s of ['OPEN', 'FILLED', 'CLOSED'] as EventStatus[]) {
      expect(sweepTarget({ status: s, startsAt: past, applicationDeadline: past }, true, now)).toBe('COMPLETED');
    }
    expect(sweepTarget({ status: 'FILLED', startsAt: past, applicationDeadline: past }, false, now)).toBe('CLOSED');
  });
  it('não toca em eventos adiados, cancelados, rascunhos ou concluídos', () => {
    for (const s of ['POSTPONED', 'CANCELLED', 'DRAFT', 'COMPLETED'] as EventStatus[]) {
      expect(sweepTarget({ status: s, startsAt: past, applicationDeadline: past }, true, now)).toBe(s);
    }
  });
  it('eventos futuros dentro do prazo permanecem como estão', () => {
    expect(sweepTarget({ status: 'OPEN', startsAt: future, applicationDeadline: future }, false, now)).toBe('OPEN');
  });
});

describe('transições de EventApplication', () => {
  it('PENDING pode ser aceita, rejeitada ou retirada', () => {
    for (const to of ['ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const) expect(() => assertApplicationTransition('PENDING', to)).not.toThrow();
  });
  it('ACCEPTED pode virar CANCELLED (vaga cancelada); REJECTED e CANCELLED são finais', () => {
    expect(() => assertApplicationTransition('ACCEPTED', 'CANCELLED')).not.toThrow();
    expect(() => assertApplicationTransition('REJECTED', 'ACCEPTED')).toThrow();
    expect(() => assertApplicationTransition('CANCELLED', 'PENDING')).toThrow();
    expect(() => assertApplicationTransition('PENDING', 'CANCELLED')).toThrow();
  });
  it('retirada pode ser reenviada', () => {
    expect(() => assertApplicationTransition('WITHDRAWN', 'PENDING')).not.toThrow();
  });
});
