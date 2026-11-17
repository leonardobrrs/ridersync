import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
    const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${type.ext}`;
    await this.storage.put(key, file.buffer, type.mime);
    const originalName = (file.originalname || `arquivo.${type.ext}`).replace(/[^\w.\- ()À-ú]/g, '_').slice(0, 120);
    try {
      return await (tx ?? this.prisma).mediaAsset.create({
        data: { storageKey: key, kind: type.kind, mimeType: type.mime, sizeBytes: file.size, originalName, uploadedById },
      });
    } catch (e) {
      await this.storage.delete(key).catch(() => undefined);
      throw e;
    }
  }

  /** Remove metadados e o objeto armazenado. */
  async remove(mediaId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!asset) return;
    await this.prisma.mediaAsset.delete({ where: { id: mediaId } });
    await this.storage.delete(asset.storageKey).catch((e) => this.logger.warn(`Falha ao remover objeto ${asset.storageKey}: ${e}`));
  }

  /** Remove o objeto do storage depois que o registro já foi apagado (ex.: cascade). */
  async removeObject(storageKey: string) {
    await this.storage.delete(storageKey).catch((e) => this.logger.warn(`Falha ao remover objeto ${storageKey}: ${e}`));
  }

  openStream(storageKey: string) {
    return this.storage.get(storageKey);
  }
}
