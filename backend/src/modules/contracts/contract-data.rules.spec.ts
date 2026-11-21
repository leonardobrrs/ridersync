import { buildContractFields, ContractSource, formatDateBR, formatDateOnly, formatMoney, formatTimeBR, resolveLocation, templateFileFor } from './contract-data.rules';
import { loadTemplate } from './templates';
import { fillTemplate, PLACEHOLDER } from './utils/fill-template';

const venue = { name: 'Bar do Jaraguá', addressLine: 'Rua do Sol, 100', neighborhood: 'Jaraguá', city: 'Maceió', state: 'AL' };

/** Contratação completa: casa + artista solo. Cada teste altera só o que importa. */
function source(over: Partial<ContractSource> = {}): ContractSource {
  return {
    generatedAt: new Date('2026-11-20T15:00:00Z'),
    contractorType: 'VENUE',
    organization: { ...venue, legalName: 'Bar do Jaraguá Ltda', cnpj: '11222333000181', contactPhone: '82999990000' },
    contractorPerson: null,
    artist: { kind: 'SOLO', name: 'Zé do Violão' },
    soloPerson: { legalName: 'José da Silva', cpf: '52998224725' },
    band: null,
    bandOwner: null,
    event: { title: 'Noite do Forró', description: 'Festa', locationName: null, locationAddress: null, locationCity: null, locationState: null, venue },
    offer: {
      performanceAt: new Date('2026-12-05T22:30:00Z'), // 19:30 em Maceió (UTC-3)
      durationMinutes: 90,
      feeCents: 150000,
      presentationDesc: 'Show de forró pé de serra',
      advanceMinutes: 60,
      signalCents: 50000,
      signalDueDate: new Date('2026-11-25T00:00:00Z'),
      balanceDueDate: new Date('2026-12-05T00:00:00Z'),
      paymentMethod: 'Pix',
      rescissionDays: 3,
      substitutionDays: 7,
    },
    ...over,
  };
}

const individual = (over: Partial<ContractSource> = {}) =>
  source({
    contractorType: 'INDIVIDUAL',
    organization: { name: 'Contratante', addressLine: 'Av. Central, 50', neighborhood: null, city: 'Arapiraca', state: 'AL', legalName: null, cnpj: null, contactPhone: '(82) 98888-7777' },
    contractorPerson: { legalName: 'Maria Souza', cpf: '11144477735', rg: '1234567 SSP/AL' },
    event: { title: 'Aniversário da Maria', description: 'Festa de 30 anos', locationName: 'Sítio Boa Vista', locationAddress: 'Estrada do Sítio, km 3', locationCity: 'Arapiraca', locationState: 'AL', venue: null },
    ...over,
  });

describe('formatação', () => {
  it('formata dinheiro em centavos', () => {
    expect(formatMoney(150000)).toBe('1.500,00');
    expect(formatMoney(5)).toBe('0,05');
    expect(formatMoney(100_000_000)).toBe('1.000.000,00');
  });

  it('usa o fuso de Maceió para data/hora do show (virada de dia)', () => {
    const d = new Date('2026-12-01T02:00:00Z'); // 30/11 23:00 em Maceió
    expect(formatDateBR(d)).toBe('30/11/2026');
    expect(formatTimeBR(d)).toBe('23:00');
  });

  it('datas sem hora (coluna DATE) não voltam um dia', () => {
    expect(formatDateOnly(new Date('2026-11-25T00:00:00Z'))).toBe('25/11/2026');
  });
});

describe('buildContractFields — contratante', () => {
  it('casa (VENUE): razão social, CNPJ formatado e endereço', () => {
    const f = buildContractFields(source());
    expect(f).toMatchObject({
      CONTRATANTE_NOME: 'Bar do Jaraguá Ltda',
      CONTRATANTE_CNPJ: '11.222.333/0001-81',
      CONTRATANTE_ENDERECO: 'Rua do Sol, 100, Jaraguá',
      CONTRATANTE_CIDADE: 'Maceió',
      CONTRATANTE_UF: 'AL',
    });
    expect(templateFileFor('VENUE')).toBe('venue-artist.md');
  });

  it('casa sem razão social usa o nome; sem CNPJ fica ausente', () => {
    const f = buildContractFields(source({ organization: { ...venue, legalName: null, cnpj: null, contactPhone: null } }));
    expect(f.CONTRATANTE_NOME).toBe('Bar do Jaraguá');
    expect(f.CONTRATANTE_CNPJ).toBeUndefined();
  });

  it('pessoa física (INDIVIDUAL): dados civis do dono, endereço e telefone da organização', () => {
    const f = buildContractFields(individual());
    expect(f).toMatchObject({
      CONTRATANTE_NOME: 'Maria Souza',
      CONTRATANTE_CPF: '111.444.777-35',
      CONTRATANTE_RG: '1234567 SSP/AL',
      CONTRATANTE_ENDERECO: 'Av. Central, 50',
      CONTRATANTE_CIDADE: 'Arapiraca',
      CONTRATANTE_TELEFONE: '(82) 98888-7777',
    });
    expect(templateFileFor('INDIVIDUAL')).toBe('individual-artist.md');
  });

  it('pessoa física sem dados civis não inventa o nome (fica a preencher)', () => {
    const f = buildContractFields(individual({ contractorPerson: { legalName: null, cpf: null, rg: null } }));
    expect(f.CONTRATANTE_NOME).toBeUndefined();
    expect(f.CONTRATANTE_CPF).toBeUndefined();
  });
});

describe('buildContractFields — artista', () => {
  it('músico solo: nome civil e CPF; sem representante', () => {
    const f = buildContractFields(source());
    expect(f).toMatchObject({ ARTISTA_NOME_ARTISTICO: 'Zé do Violão', ARTISTA_NOME_LEGAL: 'José da Silva', ARTISTA_DOCUMENTO: '529.982.247-25', ARTISTA_REPRESENTANTE: '' });
  });

  it('banda com CNPJ: razão social e CNPJ; sem representante', () => {
    const f = buildContractFields(
      source({ artist: { kind: 'BAND', name: 'Os Fulanos' }, soloPerson: null, band: { legalName: 'Fulanos Produções ME', cnpj: '11222333000181' }, bandOwner: { legalName: 'Beto', cpf: '52998224725' } }),
    );
    expect(f).toMatchObject({ ARTISTA_NOME_ARTISTICO: 'Os Fulanos', ARTISTA_NOME_LEGAL: 'Fulanos Produções ME', ARTISTA_DOCUMENTO: '11.222.333/0001-81', ARTISTA_REPRESENTANTE: '' });
  });

  it('banda sem CNPJ: o OWNER é a parte e o representante legal', () => {
    const f = buildContractFields(
      source({ artist: { kind: 'BAND', name: 'Os Fulanos' }, soloPerson: null, band: { legalName: null, cnpj: null }, bandOwner: { legalName: 'Beto Almeida', cpf: '52998224725' } }),
    );
    expect(f.ARTISTA_NOME_LEGAL).toBe('Beto Almeida');
    expect(f.ARTISTA_DOCUMENTO).toBe('529.982.247-25');
    expect(f.ARTISTA_REPRESENTANTE).toBe('Beto Almeida, CPF 529.982.247-25, representando o grupo musical "Os Fulanos"');
  });

  it('banda sem CNPJ e dono sem dados civis: representante com marcadores a preencher', () => {
    const f = buildContractFields(source({ artist: { kind: 'BAND', name: 'Os Fulanos' }, soloPerson: null, band: { legalName: null, cnpj: null }, bandOwner: null }));
    expect(f.ARTISTA_NOME_LEGAL).toBeUndefined();
    expect(f.ARTISTA_REPRESENTANTE).toBe(`${PLACEHOLDER}, CPF ${PLACEHOLDER}, representando o grupo musical "Os Fulanos"`);
  });
});

describe('buildContractFields — apresentação e pagamento', () => {
  it('data, hora, duração e valores', () => {
    const f = buildContractFields(source());
    expect(f).toMatchObject({
      EVENTO_DATA: '05/12/2026',
      EVENTO_HORARIO: '19:30',
      EVENTO_DURACAO: '90',
      APRESENTACAO_DESCRICAO: 'Show de forró pé de serra',
      CACHE_VALOR: '1.500,00',
      CACHE_VALOR_EXTENSO: 'mil e quinhentos reais',
      SINAL_VALOR: '500,00',
      SINAL_VALOR_EXTENSO: 'quinhentos reais',
      SINAL_PRAZO: '25/11/2026',
      SALDO_VALOR: '1.000,00',
      SALDO_VALOR_EXTENSO: 'mil reais',
      SALDO_PRAZO: '05/12/2026',
      FORMA_PAGAMENTO: 'Pix',
      ANTECEDENCIA_MINUTOS: '60',
      RESCISAO_PRAZO: '3',
      ANTECEDENCIA_SUBSTITUICAO: '7',
      ANTECEDENCIA_INFORMACAO: '3',
      CONTRATO_DATA: '20/11/2026',
      CONTRATO_CIDADE: 'Maceió',
      FORO_CIDADE: 'Maceió',
      FORO_UF: 'AL',
    });
  });

  it('sem sinal definido: sinal e saldo ficam a preencher; cachê permanece', () => {
    const f = buildContractFields(source({ offer: { ...source().offer, signalCents: null } }));
    expect(f.SINAL_VALOR).toBeUndefined();
    expect(f.SALDO_VALOR).toBeUndefined();
    expect(f.CACHE_VALOR).toBe('1.500,00');
  });

  it('sinal igual ao cachê: saldo zero', () => {
    const f = buildContractFields(source({ offer: { ...source().offer, signalCents: 150000 } }));
    expect(f.SALDO_VALOR).toBe('0,00');
    expect(f.SALDO_VALOR_EXTENSO).toBe('zero real');
  });

  it('prazos padrão quando a oferta não define (rescisão 2, substituição 5)', () => {
    const f = buildContractFields(source({ offer: { ...source().offer, rescissionDays: null, substitutionDays: null, advanceMinutes: null } }));
    expect(f.RESCISAO_PRAZO).toBe('2');
    expect(f.ANTECEDENCIA_SUBSTITUICAO).toBe('5');
    expect(f.ANTECEDENCIA_MINUTOS).toBeUndefined();
  });

  it('descrição da apresentação cai para o título do evento; sem evento fica a preencher', () => {
    expect(buildContractFields(source({ offer: { ...source().offer, presentationDesc: null } })).APRESENTACAO_DESCRICAO).toBe('Noite do Forró');
    expect(buildContractFields(source({ event: null, offer: { ...source().offer, presentationDesc: '  ' } })).APRESENTACAO_DESCRICAO).toBeUndefined();
  });

  it('descrição do evento em linha única e limitada', () => {
    const f = buildContractFields(individual({ event: { ...individual().event!, description: `linha 1\n\nlinha 2 ${'x'.repeat(500)}` } }));
    expect(f.EVENTO_DESCRICAO).not.toContain('\n');
    expect(f.EVENTO_DESCRICAO!.length).toBeLessThanOrEqual(300);
    expect(f.EVENTO_DESCRICAO!.endsWith('…')).toBe(true);
  });
});

describe('resolveLocation', () => {
  it('usa a casa vinculada ao evento', () => {
    expect(resolveLocation(source())).toEqual({ address: 'Bar do Jaraguá, Rua do Sol, 100, Jaraguá', city: 'Maceió', state: 'AL' });
  });

  it('evento sem casa usa o local descrito no evento', () => {
    expect(resolveLocation(individual())).toEqual({ address: 'Sítio Boa Vista, Estrada do Sítio, km 3', city: 'Arapiraca', state: 'AL' });
  });

  it('proposta direta (sem evento) usa o local do contratante (nome e endereço da casa)', () => {
    expect(resolveLocation(source({ event: null }))).toEqual({ address: 'Bar do Jaraguá, Rua do Sol, 100, Jaraguá', city: 'Maceió', state: 'AL' });
  });
});

describe('templates × campos', () => {
  const keys = (t: string) => [...new Set([...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];

  it.each([
    ['VENUE', source()],
    ['INDIVIDUAL', individual()],
  ] as const)('todo marcador do template %s é fornecido pelas regras', (type, src) => {
    const fields = buildContractFields(src);
    const missing = keys(loadTemplate(type)).filter((k) => !(k in fields));
    expect(missing).toEqual([]);
  });

  it.each([
    ['VENUE', source()],
    ['INDIVIDUAL', individual()],
  ] as const)('com dados completos o contrato %s não tem "[A PREENCHER]" nem marcadores', (type, src) => {
    const out = fillTemplate(loadTemplate(type), buildContractFields(src));
    expect(out).not.toContain(PLACEHOLDER);
    expect(out).not.toMatch(/\{\{/);
    expect(out).toContain('R$ 1.500,00 (mil e quinhentos reais)');
  });

  it('dados ausentes aparecem como "[A PREENCHER]" no contrato', () => {
    const out = fillTemplate(loadTemplate('VENUE'), buildContractFields(source({ organization: { ...venue, legalName: null, cnpj: null, contactPhone: null }, soloPerson: null })));
    expect(out).toContain(`CNPJ: ${PLACEHOLDER}`);
    expect(out).toContain(`CPF/CNPJ: ${PLACEHOLDER}`);
  });
});
