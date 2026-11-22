import { OfferSchema } from './bookings.service';

const base = {
  performanceAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  durationMinutes: 90,
  feeCents: 150000,
};

describe('OfferSchema — termos de contrato', () => {
  it('campos de contrato são opcionais e viram null', () => {
    const r = OfferSchema.parse(base);
    expect(r).toMatchObject({
      terms: '',
      presentationDesc: null,
      advanceMinutes: null,
      signalCents: null,
      signalDueDate: null,
      balanceDueDate: null,
      paymentMethod: null,
      rescissionDays: null,
      substitutionDays: null,
    });
  });

  it('aceita termos completos e converte datas para meia-noite UTC', () => {
    const r = OfferSchema.parse({
      ...base,
      presentationDesc: '  Show de forró  ',
      advanceMinutes: 60,
      signalCents: 50000,
      signalDueDate: '2026-11-25',
      balanceDueDate: '2026-12-05',
      paymentMethod: 'Pix',
      rescissionDays: 3,
      substitutionDays: 7,
    });
    expect(r.presentationDesc).toBe('Show de forró');
    expect(r.signalDueDate?.toISOString()).toBe('2026-11-25T00:00:00.000Z');
    expect(r.balanceDueDate?.toISOString()).toBe('2026-12-05T00:00:00.000Z');
  });

  it('vazio vira null (limpa o campo na contraproposta)', () => {
    const r = OfferSchema.parse({ ...base, presentationDesc: '', paymentMethod: '   ', signalCents: null, signalDueDate: null });
    expect(r.presentationDesc).toBeNull();
    expect(r.paymentMethod).toBeNull();
    expect(r.signalCents).toBeNull();
  });

  it('rejeita sinal maior que o cachê e aceita sinal igual', () => {
    expect(OfferSchema.safeParse({ ...base, signalCents: 150001 }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...base, signalCents: 150000 }).success).toBe(true);
  });

  it('rejeita prazos e datas inválidos', () => {
    expect(OfferSchema.safeParse({ ...base, advanceMinutes: 1441 }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...base, rescissionDays: -1 }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...base, signalDueDate: '25/11/2026' }).success).toBe(false);
    expect(OfferSchema.safeParse({ ...base, signalCents: -5 }).success).toBe(false);
  });

  it('prazo do sinal não pode passar da data da apresentação', () => {
    const performanceAt = '2027-03-10T21:00:00-03:00';
    expect(OfferSchema.safeParse({ ...base, performanceAt, signalDueDate: '2027-03-10' }).success).toBe(true);
    const r = OfferSchema.safeParse({ ...base, performanceAt, signalDueDate: '2027-03-11' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['signalDueDate']);
  });

  it('usa o dia da apresentação no fuso de Maceió (show às 23h)', () => {
    // 23:00 em Maceió = 02:00 UTC do dia seguinte: o dia do show continua sendo 10/03.
    const performanceAt = '2027-03-10T23:00:00-03:00';
    expect(OfferSchema.safeParse({ ...base, performanceAt, signalDueDate: '2027-03-10' }).success).toBe(true);
    expect(OfferSchema.safeParse({ ...base, performanceAt, signalDueDate: '2027-03-11' }).success).toBe(false);
  });

  it('prazo do saldo não pode ser antes do prazo do sinal (iguais ou saldo depois do show são aceitos)', () => {
    const performanceAt = '2027-03-10T21:00:00-03:00';
    const r = OfferSchema.safeParse({ ...base, performanceAt, signalDueDate: '2027-03-01', balanceDueDate: '2027-02-20' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['balanceDueDate']);
    expect(OfferSchema.safeParse({ ...base, performanceAt, signalDueDate: '2027-03-01', balanceDueDate: '2027-03-01' }).success).toBe(true);
    expect(OfferSchema.safeParse({ ...base, performanceAt, signalDueDate: '2027-03-01', balanceDueDate: '2027-03-15' }).success).toBe(true);
    expect(OfferSchema.safeParse({ ...base, performanceAt, balanceDueDate: '2027-01-01' }).success).toBe(true);
  });

  it('continua estrito: campos desconhecidos são recusados', () => {
    expect(OfferSchema.safeParse({ ...base, balanceCents: 1 }).success).toBe(false);
  });
});
