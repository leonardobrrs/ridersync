import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { processImage } from './image-processing';
import { badRequest } from '../../common/errors';
import { PrismaService, Tx } from '../../prisma/prisma.service';
import { detectFileType, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from './file-types';
import { STORAGE_DRIVER, StorageDriver } from './storage';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

export const mediaUrl = (id: string | null | undefined) => (id ? `/api/media/${id}` : null);
/** Miniatura (listas e cards). A versão principal (mediaUrl) é usada na visualização ampliada. */
export const mediaThumbUrl = (id: string | null | undefined) => (id ? `/api/media/${id}?v=thumb` : null);

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** Valida (tipo real + tamanho), grava no storage e registra os metadados. */
  async store(file: UploadedFile | undefined, uploadedById: string, accept: 'image' | 'image-or-pdf', tx?: Tx) {
    if (!file?.buffer?.length) throw badRequest('FILE_REQUIRED', 'Selecione um arquivo.');
    const type = detectFileType(file.buffer);
    if (!type || (accept === 'image' && type.kind !== 'IMAGE')) {
      throw badRequest(
        'FILE_TYPE',
        accept === 'image' ? 'Formato não suportado. Envie JPG, PNG ou WEBP.' : 'Formato não suportado. Envie JPG, PNG, WEBP ou PDF.',
      );
    }
    const max = type.kind === 'IMAGE' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > max) throw badRequest('FILE_TOO_LARGE', `Arquivo acima do limite de ${max / 1024 / 1024} MB.`);

    const now = new Date();
    const base = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
    const originalName = (file.originalname || `arquivo.${type.ext}`).replace(/[^\w.\- ()À-ú]/g, '_').slice(0, 120);

    if (type.kind === 'IMAGE') {
      const img = await processImage(file.buffer).catch(() => {
        throw badRequest('FILE_INVALID', 'Não foi possível ler a imagem. Envie um JPG, PNG ou WEBP válido.');
      });
      const key = `${base}.webp`;
      const thumbKey = `${base}-thumb.webp`;
      await this.storage.put(key, img.main, 'image/webp');
      await this.storage.put(thumbKey, img.thumb, 'image/webp');
      return this.persist(tx, [key, thumbKey], {
        storageKey: key,
        thumbKey,
        kind: 'IMAGE',
        mimeType: 'image/webp',
        sizeBytes: img.main.length,
        width: img.width,
        height: img.height,
        originalName: originalName.replace(/\.[^.]+$/, '') + '.webp',
        uploadedById,
      });
    }

    const key = `${base}.${type.ext}`;
    await this.storage.put(key, file.buffer, type.mime);
    return this.persist(tx, [key], { storageKey: key, kind: type.kind, mimeType: type.mime, sizeBytes: file.size, originalName, uploadedById });
  }

  private async persist(tx: Tx | undefined, keys: string[], data: Prisma.MediaAssetUncheckedCreateInput) {
    try {
      return await (tx ?? this.prisma).mediaAsset.create({ data });
    } catch (e) {
      await Promise.all(keys.map((k) => this.storage.delete(k).catch(() => undefined)));
      throw e;
    }
  }

  /** Remove metadados e os objetos armazenados (principal e miniatura). */
  async remove(mediaId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!asset) return;
    await this.prisma.mediaAsset.delete({ where: { id: mediaId } });
    for (const key of [asset.storageKey, asset.thumbKey]) {
      if (key) await this.removeObject(key);
    }
  }

  /** Remove o objeto do storage depois que o registro já foi apagado (ex.: cascade). */
  async removeObject(storageKey: string) {
    await this.storage.delete(storageKey).catch((e) => this.logger.warn(`Falha ao remover objeto ${storageKey}: ${e}`));
  }

  openStream(storageKey: string) {
    return this.storage.get(storageKey);
  }
}
