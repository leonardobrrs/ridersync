import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';

/**
 * Fonte serifada EMBUTIDA (Tinos, SIL OFL 1.1 — métricas da Times New Roman). Com as fontes padrão do PDF (Times
 * não embutida) cada visualizador usa uma fonte substituta com larguras próprias: palavras em maiúsculas
 * ("CONTRATADO") invadiam o espaço seguinte. Embutida, a largura medida aqui é a mesma desenhada em qualquer leitor.
 * Caminhos literais com __dirname: o nest-cli copia fonts/ para dist e o rastreador da Vercel os inclui no bundle.
 */
let fontBytes: { regular: Buffer; bold: Buffer } | null = null;
function loadFonts() {
  fontBytes ??= {
    regular: readFileSync(join(__dirname, '..', 'fonts', 'Tinos-Regular.ttf')),
    bold: readFileSync(join(__dirname, '..', 'fonts', 'Tinos-Bold.ttf')),
  };
  return fontBytes;
}

// A4 em pontos (1 cm ≈ 28,35 pt). Margem de 2,5 cm — acima do mínimo de 2 cm.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 71;
const FONT_SIZE = 11;
const LINE_H = 15;
const PARA_GAP = 8;
const FOOTER_Y = 36;
/** Linha só é justificada se já ocupa ao menos esta fração da largura (evita buracos enormes entre palavras). */
const MIN_FILL_TO_JUSTIFY = 0.7;

/** Linhas que recebem destaque (negrito): título, cláusulas e cabeçalhos das partes. */
const isHeading = (line: string, index: number) => index === 0 || /^(CLÁUSULA \d|CONTRATANTE$|CONTRATADO$)/.test(line.trim());

export type Block =
  | { kind: 'blank' }
  | { kind: 'heading'; text: string; title: boolean }
  /** `marker` ("a)" ou "-") gera recuo deslocado nas linhas seguintes do item. */
  | { kind: 'text'; text: string; marker: string | null };

const LIST_MARKER = /^\s*([a-z]\)|-)\s/;

/**
 * Reagrupa as linhas do template em parágrafos. O template vem quebrado em ~70 colunas; para justificar é preciso
 * juntar as linhas de continuação. Continuação = linha recuada ou começando em minúscula (que não seja "a) ").
 * A partir da primeira linha de assinatura (____) nada é reagrupado: ali o texto é de dados do usuário (nomes) e
 * cada linha precisa permanecer sozinha.
 */
export function reflowParagraphs(content: string): Block[] {
  const blocks: Block[] = [];
  let reflow = true;
  content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((raw, index) => {
      if (!raw.trim()) {
        blocks.push({ kind: 'blank' });
        return;
      }
      if (/^_{5,}$/.test(raw.trim())) reflow = false;
      if (isHeading(raw, index)) {
        blocks.push({ kind: 'heading', text: raw.trim(), title: index === 0 });
        return;
      }
      const prev = blocks[blocks.length - 1];
      const continuation = reflow && prev?.kind === 'text' && (/^\s/.test(raw) || (/^\p{Ll}/u.test(raw) && !/^[a-z]\)/.test(raw)));
      if (continuation) {
        prev.text += ` ${raw.trim()}`;
        return;
      }
      blocks.push({ kind: 'text', text: raw.trim(), marker: LIST_MARKER.exec(raw)?.[1] ?? null });
    });
  return blocks;
}

/** Posições x (relativas ao início da linha) de cada palavra distribuindo a sobra igualmente entre as palavras. */
export function justifyPositions(wordWidths: number[], available: number): number[] {
  const total = wordWidths.reduce((a, b) => a + b, 0);
  const gap = wordWidths.length > 1 ? (available - total) / (wordWidths.length - 1) : 0;
  const xs: number[] = [];
  let x = 0;
  for (const w of wordWidths) {
    xs.push(x);
    x += w + gap;
  }
  return xs;
}

/** O que a fonte não tem (ex.: emoji em nome) vira "?" em vez de quebrar a geração. */
function sanitize(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text.replace(/\t/g, '  '))
    .map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : '?'))
    .join('');
}

/** Quebra palavras em linhas respeitando a largura; palavras maiores que a linha são partidas por caractere. */
function wrapWords(words: string[], font: PDFFont, size: number, widthFirst: number, widthRest: number): string[][] {
  const lines: string[][] = [];
  const space = font.widthOfTextAtSize(' ', size);
  const avail = () => (lines.length === 0 ? widthFirst : widthRest);
  const w = (s: string) => font.widthOfTextAtSize(s, size);
  let current: string[] = [];
  let currentW = 0;
  const flush = () => {
    if (current.length) lines.push(current);
    current = [];
    currentW = 0;
  };
  for (const word of words) {
    const add = (current.length ? space : 0) + w(word);
    if (currentW + add <= avail()) {
      current.push(word);
      currentW += add;
      continue;
    }
    flush();
    let rest = word;
    while (w(rest) > avail()) {
      let cut = rest.length - 1;
      while (cut > 1 && w(rest.slice(0, cut)) > avail()) cut--;
      lines.push([rest.slice(0, cut)]);
      rest = rest.slice(cut);
    }
    current = [rest];
    currentW = w(rest);
  }
  flush();
  return lines.length ? lines : [[]];
}

/**
 * Renderiza o texto do contrato em PDF (A4, fonte serifada, margem de 2,5 cm, parágrafos justificados, quebra
 * automática de linha e paginação com rodapé). Determinístico para o mesmo texto e data.
 */
export async function generateContractPdf(content: string, opts: { title?: string; createdAt?: Date } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = loadFonts();
  // Fonte inteira (sem subset): o recorte do pdf-lib + fontkit perde glifos desta fonte (letras somem no PDF).
  const regular = await doc.embedFont(fonts.regular);
  const bold = await doc.embedFont(fonts.bold);
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
  const ensureRoom = () => {
    if (y - LINE_H < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const draw = (text: string, x: number, font: PDFFont) => page.drawText(text, { x, y: y - FONT_SIZE, size: FONT_SIZE, font, color: rgb(0, 0, 0) });

  const blocks = reflowParagraphs(content);
  /** Altura de um bloco de assinatura: da linha ____ até a próxima linha em branco. */
  const signatureHeight = (start: number) => {
    let h = 0;
    for (let i = start; i < blocks.length && blocks[i].kind !== 'blank'; i++) h += LINE_H + (blocks[i].kind === 'heading' ? 4 : 0);
    return h;
  };
  blocks.forEach((block, index) => {
    if (block.kind === 'text' && /^_{5,}$/.test(block.text) && y - signatureHeight(index) < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    if (block.kind === 'blank') {
      y -= PARA_GAP;
      return;
    }
    if (block.kind === 'heading') {
      const text = sanitize(block.text, bold);
      if (!block.title) y -= 4;
      for (const words of wrapWords(text.split(/\s+/), bold, FONT_SIZE, maxWidth, maxWidth)) {
        ensureRoom();
        const line = words.join(' ');
        const x = block.title ? MARGIN + (maxWidth - bold.widthOfTextAtSize(line, FONT_SIZE)) / 2 : MARGIN;
        draw(line, Math.max(MARGIN, x), bold);
        y -= LINE_H;
      }
      return;
    }
    const words = sanitize(block.text, regular).split(/\s+/).filter(Boolean);
    const hang = block.marker ? regular.widthOfTextAtSize(`${block.marker} `, FONT_SIZE) : 0;
    const lines = wrapWords(words, regular, FONT_SIZE, maxWidth, maxWidth - hang);
    lines.forEach((lineWords, idx) => {
      ensureRoom();
      const indent = idx === 0 ? 0 : hang;
      const available = maxWidth - indent;
      const widths = lineWords.map((w) => regular.widthOfTextAtSize(w, FONT_SIZE));
      const natural = widths.reduce((a, b) => a + b, 0) + regular.widthOfTextAtSize(' ', FONT_SIZE) * (lineWords.length - 1);
      const justify = idx < lines.length - 1 && lineWords.length > 1 && natural >= available * MIN_FILL_TO_JUSTIFY;
      if (justify) {
        const xs = justifyPositions(widths, available);
        lineWords.forEach((w, k) => draw(w, MARGIN + indent + xs[k], regular));
      } else {
        draw(lineWords.join(' '), MARGIN + indent, regular);
      }
      y -= LINE_H;
    });
  });

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Página ${i + 1} de ${pages.length}`;
    p.drawText(label, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(label, 9), y: FOOTER_Y, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
  });
  return doc.save();
}
