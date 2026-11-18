import sharp from 'sharp';

export const MAIN_MAX_PX = 1600;
export const THUMB_MAX_PX = 480;
const MAX_INPUT_PIXELS = 40_000_000;

export interface ProcessedImage {
  main: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

/**
 * Reprocessa a imagem enviada:
 *  - aplica a orientação EXIF e remove todos os metadados (GPS, câmera) — privacidade;
 *  - reencoda (neutraliza payloads embutidos no arquivo original);
 *  - gera a versão principal (até 1600 px) para visualização ampliada sem perda perceptível e uma
 *    miniatura (até 480 px) para listas. Nunca amplia: imagens menores mantêm a resolução original.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();
  const [main, thumb] = await Promise.all([
    base
      .clone()
      .resize({ width: MAIN_MAX_PX, height: MAIN_MAX_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86, effort: 4 })
      .toBuffer({ resolveWithObject: true }),
    base
      .clone()
      .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer(),
  ]);
  return { main: main.data, thumb, width: main.info.width, height: main.info.height };
}
