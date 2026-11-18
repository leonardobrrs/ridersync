import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_DOCUMENT_BYTES } from './file-types';

/** Upload multipart de um único arquivo no campo "file" (limite bruto; o MediaService valida tipo e tamanho reais). */
export const uploadInterceptor = () => FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } });
