import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import { loadEnv } from '../../config/env';
import { createMailTransport, MAIL_TRANSPORT, MailMessage, MailTransport, SendResult } from './mail.transport';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  get driver() {
    return this.transport.name;
  }

  /** Envio imediato (usado para links com token, que não passam pelo outbox). Falhas não vazam para o cliente. */
  async sendNow(message: MailMessage): Promise<SendResult | { status: 'failed' }> {
    try {
      return await this.transport.send(message);
    } catch (e) {
      this.logger.error(`Falha ao enviar e-mail "${message.subject}": ${e instanceof Error ? e.message : String(e)}`);
      return { status: 'failed' };
    }
  }

  /** Envio que propaga o erro (o outbox registra a falha e tenta novamente). */
  send(message: MailMessage) {
    return this.transport.send(message);
  }
}

@Global()
@Module({
  providers: [{ provide: MAIL_TRANSPORT, useFactory: () => createMailTransport(loadEnv()) }, MailService],
  exports: [MailService],
})
export class MailModule {}
