import { externalUrl, optionalInstagram } from './validation';
import { detectFileType } from '../modules/media/file-types';

describe('validação de links externos', () => {
  it('aceita https público', () => {
    expect(externalUrl.safeParse('https://www.youtube.com/watch?v=abc').success).toBe(true);
  });
  it.each(['http://exemplo.com', 'javascript:alert(1)', 'https://localhost/x', 'https://192.168.0.1/a', 'https://user:pw@site.com', 'nada'])(
    'rejeita %s',
    (url) => expect(externalUrl.safeParse(url).success).toBe(false),
  );
  it('normaliza instagram sem @', () => {
    expect(optionalInstagram.parse('@ana.lins')).toBe('ana.lins');
  });
});

describe('detecção de tipo de arquivo por assinatura', () => {
  it('reconhece PNG, JPEG e PDF; rejeita conteúdo arbitrário', () => {
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime).toBe('image/png');
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg');
    expect(detectFileType(Buffer.from('%PDF-1.7'))?.kind).toBe('DOCUMENT');
    expect(detectFileType(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
  });
});
