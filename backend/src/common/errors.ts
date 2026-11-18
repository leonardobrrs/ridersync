import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Helpers de erro com código estável para o frontend. */
export const notFound = (message = 'Recurso não encontrado.') => new NotFoundException({ code: 'NOT_FOUND', message });
export const forbidden = (message = 'Você não tem permissão para esta ação.', code = 'FORBIDDEN') =>
  new ForbiddenException({ code, message });
export const unauthorized = (code: string, message: string) => new UnauthorizedException({ code, message });
export const tooManyRequests = (code: string, message: string) => new HttpException({ code, message }, HttpStatus.TOO_MANY_REQUESTS);
export const conflict = (code: string, message: string) => new ConflictException({ code, message });
export const unprocessable = (code: string, message: string) => new UnprocessableEntityException({ code, message });
export const badRequest = (code: string, message: string) => new BadRequestException({ code, message });

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Normaliza todas as respostas de erro: { statusCode, code, message, details? }.
 * Nunca expõe stack traces ou detalhes internos do banco.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'object' && resp !== null) {
        const r = resp as Record<string, unknown>;
        const message = Array.isArray(r.message) ? r.message.join('; ') : (r.message as string | undefined);
        return {
          statusCode: status,
          code: (r.code as string) ?? defaultCode(status),
          message: message ?? exception.message,
          ...(r.details ? { details: r.details } : {}),
        };
      }
      return { statusCode: status, code: defaultCode(status), message: String(resp) };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: 409, code: 'CONFLICT', message: 'Registro duplicado: já existe um item com estes dados.' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: 404, code: 'NOT_FOUND', message: 'Recurso não encontrado.' };
      }
      if (exception.code === 'P2003') {
        return { statusCode: 409, code: 'CONFLICT', message: 'Operação viola uma referência entre registros.' };
      }
    }
    if (exception instanceof Prisma.PrismaClientUnknownRequestError && /check constraint/i.test(exception.message)) {
      return { statusCode: 422, code: 'CONSTRAINT_VIOLATION', message: 'Os dados violam uma regra de integridade.' };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' };
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 422:
      return 'UNPROCESSABLE';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
