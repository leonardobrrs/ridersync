import { PDFDocument } from 'pdf-lib';
import { generateContractPdf } from './generate-pdf';

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
});
