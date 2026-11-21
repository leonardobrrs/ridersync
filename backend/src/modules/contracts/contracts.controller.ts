import { Controller, Get, Param, ParseUUIDPipe, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { ContractsService } from './contracts.service';

@ApiTags('contracts')
@ApiCookieAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  /** Metadados do contrato da negociação (null enquanto não gerado). */
  @Get('booking/:bookingId')
  byBooking(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.contracts.findByBooking(user.id, bookingId);
  }

  /** Gera o contrato de uma contratação confirmada, se ainda não existir (idempotente). */
  @Post('booking/:bookingId')
  generate(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.contracts.ensureForBooking(user.id, bookingId);
  }

  /** Refaz o contrato com os dados cadastrais atuais (só antes da apresentação). */
  @Post('booking/:bookingId/refresh')
  refresh(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.contracts.refreshForBooking(user.id, bookingId);
  }

  /** Dados cadastrais que faltam em cada lado para o contrato sair completo. */
  @Get('booking/:bookingId/readiness')
  readiness(@CurrentUser() user: AuthUser, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.contracts.readiness(user.id, bookingId);
  }

  @Get(':contractId/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pdf, filename } = await this.contracts.download(user.id, contractId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.byteLength),
      'X-Content-Type-Options': 'nosniff',
      // Contém dados pessoais (CPF/RG): nunca em cache compartilhado.
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(pdf);
  }
}
