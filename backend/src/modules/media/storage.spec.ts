import { Readable } from 'node:stream';
import { createStorageDriver, VercelBlobStorageDriver } from './storage';
import type { Env } from '../../config/env';

jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({}),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(undefined),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const blob = require('@vercel/blob') as { put: jest.Mock; get: jest.Mock; del: jest.Mock };

describe('VercelBlobStorageDriver', () => {
  beforeEach(() => jest.clearAllMocks());

  it('grava em store privado, sem sufixo aleatório, com o content-type detectado', async () => {
    const d = new VercelBlobStorageDriver('token-de-teste');
    await d.put('2026/11/abc.png', Buffer.from('x'), 'image/png');
    expect(blob.put).toHaveBeenCalledWith('2026/11/abc.png', expect.any(Buffer), {
      access: 'private',
      contentType: 'image/png',
      addRandomSuffix: false,
      token: 'token-de-teste',
    });
  });

  it('lê como stream do Node e trata ausência como erro', async () => {
    const d = new VercelBlobStorageDriver('t');
    blob.get.mockResolvedValueOnce({ statusCode: 200, stream: new Blob(['conteudo']).stream() });
    const s = await d.get('2026/11/abc.png');
    expect(s).toBeInstanceOf(Readable);
    expect(blob.get).toHaveBeenCalledWith('2026/11/abc.png', { access: 'private', token: 't' });
    blob.get.mockResolvedValueOnce(null);
    await expect(d.get('2026/11/nao-existe.png')).rejects.toThrow('não encontrado');
  });

  it('exclui pelo pathname e recusa chaves inseguras', async () => {
    const d = new VercelBlobStorageDriver('t');
    await d.delete('2026/11/abc.png');
    expect(blob.del).toHaveBeenCalledWith('2026/11/abc.png', { token: 't' });
    await expect(d.put('../segredo', Buffer.from('x'), 'image/png')).rejects.toThrow('inválida');
  });

  it('sem credenciais falha com mensagem clara (não grava em lugar nenhum)', async () => {
    const prev = process.env.BLOB_STORE_ID;
    delete process.env.BLOB_STORE_ID;
    await expect(new VercelBlobStorageDriver(undefined).put('a.png', Buffer.from('x'), 'image/png')).rejects.toThrow(
      'Vercel Blob não configurado',
    );
    expect(blob.put).not.toHaveBeenCalled();
    if (prev) process.env.BLOB_STORE_ID = prev;
  });

  it('na Vercel, o driver local é recusado (disco efêmero)', async () => {
    process.env.VERCEL = '1';
    try {
      const d = createStorageDriver({ STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: './storage' } as Env);
      await expect(d.put('a.png', Buffer.from('x'), 'image/png')).rejects.toThrow('não é suportado na Vercel');
    } finally {
      delete process.env.VERCEL;
    }
  });
});
