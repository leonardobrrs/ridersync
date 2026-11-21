import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';

// A4 em pontos (1 cm ≈ 28,35 pt). Margem de 2,5 cm — acima do mínimo de 2 cm.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 71;
const FONT_SIZE = 11;
const LINE_H = 15;
const PARA_GAP = 8;
const FOOTER_Y = 36;

/** Linhas que recebem destaque (negrito): título, cláusulas e cabeçalhos das partes. */
const isHeading = (line: string, index: number) => index === 0 || /^(CLÁUSULA \d|CONTRATANTE$|CONTRATADO$)/.test(line.trim());

/** Fontes padrão do PDF só codificam WinAnsi: o que não couber (ex.: emoji em nome) vira "?" em vez de quebrar a geração. */
function sanitize(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text.replace(/\t/g, '  '))
    .map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : '?'))
    .join('');
}

/** Quebra uma linha em várias respeitando a largura; palavras maiores que a linha são partidas por caractere. */
function wrap(line: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const indent = /^\s*/.exec(line)![0];
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = indent;
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;
  for (const word of words) {
    const candidate = current.trim() ? `${current} ${word}` : `${current}${word}`;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current.trim()) lines.push(current);
    current = '';
    let rest = word;
    while (!fits(rest)) {
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current.trim()) lines.push(current);
  return lines;
}

/**
 * Renderiza o texto do contrato em PDF (A4, fonte serifada, margem de 2,5 cm, quebra automática de linha e
 * paginação com rodapé). Mantém as quebras de linha do template. Determinístico para o mesmo texto e data.
 */
export async function generateContractPdf(content: string, opts: { title?: string; createdAt?: Date } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedStandardFont(StandardFonts.TimesRoman);
  const bold = await doc.embedStandardFont(StandardFonts.TimesRomanBold);
  doc.setTitle(opts.title ?? 'Contrato de prestação de serviços artísticos');
  doc.setProducer('RiderSync');
  doc.setCreator('RiderSync');
  if (opts.createdAt) {
    doc.setCreationDate(opts.createdAt);
    doc.setModificationDate(opts.createdAt);
  }

  const maxWidth = PAGE_W - MARGIN * 2;
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((raw, index) => {
      const heading = isHeading(raw, index);
      const font = heading ? bold : regular;
      const text = sanitize(raw, font);
      if (!text.trim()) {
        y -= PARA_GAP;
        return;
      }
      if (heading && index > 0) y -= 4;
      for (const l of wrap(text, font, FONT_SIZE, maxWidth)) {
        if (y - LINE_H < MARGIN) newPage();
        const x = index === 0 ? MARGIN + (maxWidth - font.widthOfTextAtSize(l, FONT_SIZE)) / 2 : MARGIN;
        page.drawText(l, { x: Math.max(MARGIN, x), y: y - FONT_SIZE, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
        y -= LINE_H;
      }
    });

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Página ${i + 1} de ${pages.length}`;
    p.drawText(label, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(label, 9), y: FOOTER_Y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
  });
  return doc.save();
}
