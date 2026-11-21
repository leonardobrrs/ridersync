import { PDFDocument } from 'pdf-lib';
import { generateContractPdf, justifyPositions, reflowParagraphs } from './generate-pdf';

const text = (n: number) => Array.from({ length: n }, (_, i) => `Linha ${i + 1} do contrato com acentuação: ação, é, ç, ª, —.`).join('\n');

describe('generateContractPdf', () => {
  it('gera um PDF válido em A4', async () => {
    const bytes = await generateContractPdf('CONTRATO TESTE\n\nCLÁUSULA 1ª — DO OBJETO\nTexto.');
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it('pagina textos longos', async () => {
    const doc = await PDFDocument.load(await generateContractPdf(text(200)));
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });

  it('quebra palavras maiores que a linha e linhas muito longas sem falhar', async () => {
    const long = 'x'.repeat(400);
    const doc = await PDFDocument.load(await generateContractPdf(`TÍTULO\n${long}\n${'palavra '.repeat(200)}`));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('não falha com caracteres fora do WinAnsi (emoji, CJK)', async () => {
    await expect(generateContractPdf('TÍTULO\nNome: João 🎸 山田')).resolves.toBeInstanceOf(Uint8Array);
  });

  it('aceita conteúdo vazio', async () => {
    await expect(generateContractPdf('')).resolves.toBeInstanceOf(Uint8Array);
  });

  it('é determinístico para o mesmo texto e data', async () => {
    const at = new Date('2026-11-20T12:00:00Z');
    const a = await generateContractPdf('TÍTULO\nCorpo', { createdAt: at });
    const b = await generateContractPdf('TÍTULO\nCorpo', { createdAt: at });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('renderiza parágrafos, listas com recuo e assinaturas justificados sem falhar', async () => {
    const body = [
      'CONTRATO',
      '',
      'CLÁUSULA 1ª — DO OBJETO',
      'O CONTRATADO se compromete a realizar apresentação musical descrita como "Show de forró pé de serra" no dia 05/12/2026,',
      'às 19:30, com duração aproximada de 90 minutos, no endereço Rua do Sol, 100, Jaraguá, cidade de Maceió/AL, conforme combinado.',
      '',
      'a) Disponibilizar o espaço físico em condições adequadas para a realização da apresentação, incluindo área para montagem',
      '   de equipamentos e camarim reservado para a banda;',
      '- Sinal de R$ 500,00 (quinhentos reais) até 25/11/2026,',
      '  como condição para confirmação do presente contrato;',
      '',
      '_____________________________________________',
      'José da Silva',
      'zé do violão',
    ].join('\n');
    const doc = await PDFDocument.load(await generateContractPdf(body));
    expect(doc.getPageCount()).toBe(1);
  });
});

describe('reflowParagraphs (justificação)', () => {
  const texts = (c: string) => reflowParagraphs(c).filter((b) => b.kind === 'text').map((b) => (b as { text: string }).text);

  it('junta linhas de continuação do mesmo parágrafo', () => {
    const c = 'TÍTULO\n\nO CONTRATADO se compromete a realizar\napresentação musical no dia 05/12/2026,\nàs 19:30, com duração aproximada.';
    expect(texts(c)).toEqual(['O CONTRATADO se compromete a realizar apresentação musical no dia 05/12/2026, às 19:30, com duração aproximada.']);
  });

  it('itens a) e - continuam separados; continuação recuada vai para o item e guarda o marcador', () => {
    const c = 'TÍTULO\n\na) Disponibilizar o espaço físico\n   em condições adequadas;\nb) Fornecer a estrutura;\n- Sinal de R$ 500,00 até 25/11,\n  como condição.';
    const blocks = reflowParagraphs(c).filter((b) => b.kind === 'text') as { text: string; marker: string | null }[];
    expect(blocks.map((b) => b.text)).toEqual([
      'a) Disponibilizar o espaço físico em condições adequadas;',
      'b) Fornecer a estrutura;',
      '- Sinal de R$ 500,00 até 25/11, como condição.',
    ]);
    expect(blocks.map((b) => b.marker)).toEqual(['a)', 'b)', '-']);
  });

  it('cláusulas, título e dados das partes não são fundidos', () => {
    const c = 'TÍTULO\n\nCONTRATANTE\nRazão Social: X\nCNPJ: Y\nCidade/UF: Maceió/AL\n\nCLÁUSULA 1ª — DO OBJETO\nTexto da cláusula.\n5.1 — Cancelamento:\n- Item.';
    expect(reflowParagraphs(c).map((b) => b.kind)).toEqual(['heading', 'blank', 'heading', 'text', 'text', 'text', 'blank', 'heading', 'text', 'text', 'text']);
  });

  it('bloco de assinaturas nunca é reagrupado, mesmo com nome artístico em minúscula', () => {
    const c = 'TÍTULO\n\n_____________________________________________\nJosé da Silva\nCPF/CNPJ: 529.982.247-25\nzé do violão\nCONTRATADO';
    expect(texts(c)).toEqual(['_____________________________________________', 'José da Silva', 'CPF/CNPJ: 529.982.247-25', 'zé do violão']);
  });

  it('data do contrato (depois de linha em branco) não é fundida ao parágrafo anterior', () => {
    const c = 'TÍTULO\n\nCLÁUSULA 8ª — DO FORO\nFica eleito o foro,\nprivilegiado que seja.\n\nmaceió, 20/11/2026.\n\n______';
    expect(texts(c)).toEqual(['Fica eleito o foro, privilegiado que seja.', 'maceió, 20/11/2026.', '______']);
  });
});

describe('justifyPositions', () => {
  it('a última palavra termina exatamente na largura disponível, com lacunas iguais', () => {
    const widths = [30, 50, 20, 40];
    const xs = justifyPositions(widths, 300);
    expect(xs[0]).toBe(0);
    expect(xs[3] + widths[3]).toBeCloseTo(300, 6);
    const gaps = [1, 2, 3].map((i) => xs[i] - (xs[i - 1] + widths[i - 1]));
    expect(gaps[0]).toBeCloseTo(gaps[1], 6);
    expect(gaps[1]).toBeCloseTo(gaps[2], 6);
  });

  it('palavra única fica à esquerda', () => {
    expect(justifyPositions([80], 300)).toEqual([0]);
  });
});
