import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { del as blobDel, get as blobGet, put as blobPut } from '@vercel/blob';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { Env } from '../../config/env';

/** Interface desacoplada do provedor de armazenamento de objetos. */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/;

/** Armazenamento em disco local (desenvolvimento/compose). Diretório não é servido estaticamente. */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  private resolve(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error('Chave de armazenamento inválida.');
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Chave de armazenamento inválida.');
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: 'wx' });
  }

  async get(key: string): Promise<Readable> {
    const full = this.resolve(key);
    await stat(full);
    return createReadStream(full);
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

/** Armazenamento compatível com S3 (AWS S3, MinIO etc.), habilitado por STORAGE_DRIVER=s3. */
export class S3StorageDriver implements StorageDriver {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
  }

  async get(key: string): Promise<Readable> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!out.Body) throw new Error('Objeto vazio.');
    return out.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error('Chave de armazenamento inválida.');
}

/**
 * Vercel Blob em store PRIVADO (STORAGE_DRIVER=vercel-blob). Credenciais vêm do ambiente:
 * BLOB_READ_WRITE_TOKEN (adicionada ao conectar o store ao projeto) ou OIDC da Vercel + BLOB_STORE_ID.
 * Os arquivos nunca são expostos por URL pública: a API lê o blob e aplica a política de acesso.
 */
export class VercelBlobStorageDriver implements StorageDriver {
  constructor(private readonly token?: string) {}

  private credentials() {
    if (!this.token && !process.env.BLOB_STORE_ID) {
      throw new Error('Vercel Blob não configurado: conecte um Blob store ao projeto (BLOB_READ_WRITE_TOKEN ausente).');
    }
    return this.token ? { token: this.token } : {};
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    await blobPut(key, data, { access: 'private', contentType, addRandomSuffix: false, ...this.credentials() });
  }

  async get(key: string): Promise<Readable> {
    assertSafeKey(key);
    const result = await blobGet(key, { access: 'private', ...this.credentials() });
    if (!result || result.statusCode !== 200) throw new Error('Objeto não encontrado.');
    return Readable.fromWeb(result.stream as import('node:stream/web').ReadableStream<Uint8Array>);
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await blobDel(key, this.credentials());
  }
}

/** Disco local não é persistente na Vercel: falha com mensagem clara em vez de gravar em disco efêmero. */
class UnavailableStorageDriver implements StorageDriver {
  private fail(): never {
    throw new Error('Armazenamento local não é suportado na Vercel. Configure STORAGE_DRIVER=vercel-blob ou s3.');
  }
  async put(): Promise<void> {
    this.fail();
  }
  async get(): Promise<Readable> {
    this.fail();
  }
  async delete(): Promise<void> {
    this.fail();
  }
}

export function createStorageDriver(env: Env): StorageDriver {
  if (env.STORAGE_DRIVER === 'vercel-blob') return new VercelBlobStorageDriver(env.BLOB_READ_WRITE_TOKEN);
  if (env.STORAGE_DRIVER === 's3') {
    const client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
    return new S3StorageDriver(client, env.S3_BUCKET!);
  }
  if (process.env.VERCEL) return new UnavailableStorageDriver();
  return new LocalStorageDriver(env.STORAGE_LOCAL_DIR);
}
