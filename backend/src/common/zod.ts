import { applyDecorators, BadRequestException, Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z, ZodType } from 'zod';

/** Pipe que valida e normaliza a entrada com um schema Zod. */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos. Verifique os campos destacados.',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

function toOpenApi(schema: ZodType): Record<string, unknown> {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'openapi-3.0' }) as Record<string, unknown>;
  } catch {
    return { type: 'object' };
  }
}

/** Corpo validado por Zod (uso: `@ZBody(Schema) body: z.infer<typeof Schema>`). */
export const ZBody = (schema: ZodType) => Body(new ZodValidationPipe(schema));
/** Query validada por Zod. */
export const ZQuery = (schema: ZodType) => Query(new ZodValidationPipe(schema));

/** Documenta o corpo no Swagger a partir do schema Zod. */
export const ApiZodBody = (schema: ZodType) => applyDecorators(ApiBody({ schema: toOpenApi(schema) }));

/** Documenta parâmetros de query (objeto plano) no Swagger. */
export function ApiZodQuery(schema: z.ZodObject) {
  const decorators = Object.keys(schema.shape).map((name) => ApiQuery({ name, required: false }));
  return applyDecorators(...decorators);
}
