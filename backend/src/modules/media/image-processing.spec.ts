import sharp from 'sharp';
import { MAIN_MAX_PX, processImage, THUMB_MAX_PX } from './image-processing';

describe('processamento de imagens enviadas', () => {
  it('remove metadados (EXIF/GPS) e reencoda para WebP', async () => {
    const withExif = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#336699' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'Câmera pessoal', ImageDescription: 'Local secreto' } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processImage(withExif);
    const meta = await sharp(out.main).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
  });

  it('limita a versão principal e a miniatura sem distorcer a proporção', async () => {
    const big = await sharp({ create: { width: 4000, height: 2000, channels: 3, background: '#000' } }).png().toBuffer();
    const out = await processImage(big);
    expect(out.width).toBe(MAIN_MAX_PX);
    expect(out.height).toBe(MAIN_MAX_PX / 2);
    const thumb = await sharp(out.thumb).metadata();
    expect(thumb.width).toBe(THUMB_MAX_PX);
    expect(thumb.height).toBe(THUMB_MAX_PX / 2);
  });

  it('nunca amplia imagens pequenas (evita perda de nitidez ao abrir o perfil)', async () => {
    const small = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#fff' } }).png().toBuffer();
    const out = await processImage(small);
    expect(out.width).toBe(300);
    expect((await sharp(out.thumb).metadata()).width).toBe(300);
  });

  it('rejeita conteúdo que não é imagem decodificável', async () => {
    const fakePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('<script>alert(1)</script>')]);
    await expect(processImage(fakePng)).rejects.toThrow();
  });
});
