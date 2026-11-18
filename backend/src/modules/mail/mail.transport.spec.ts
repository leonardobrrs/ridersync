import { BrevoTransport, createMailTransport, parseMailFrom } from './mail.transport';
import type { Env } from '../../config/env';

describe('parseMailFrom', () => {
  it('aceita "Nome <email>", nome entre aspas e e-mail puro', () => {
    expect(parseMailFrom('RiderSync <contato@exemplo.com>')).toEqual({ name: 'RiderSync', email: 'contato@exemplo.com' });
    expect(parseMailFrom('"Equipe RiderSync" <a@b.com>')).toEqual({ name: 'Equipe RiderSync', email: 'a@b.com' });
    expect(parseMailFrom('a@b.com')).toEqual({ email: 'a@b.com' });
  });
  it('recusa remetente inválido', () => {
    expect(() => parseMailFrom('RiderSync')).toThrow(/MAIL_FROM/);
  });
});

describe('BrevoTransport', () => {
  const message = { to: 'pessoa@exemplo.com', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' };
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  it('envia pela API transacional com a chave no cabeçalho api-key e o remetente verificado', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: '<id-123@smtp-relay>' }), { status: 201 }));
    const result = await new BrevoTransport('chave-teste', 'RiderSync <contato@exemplo.com>').send(message);
    expect(result).toEqual({ status: 'sent', providerId: '<id-123@smtp-relay>' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['api-key']).toBe('chave-teste');
    expect(JSON.parse(String(init.body))).toEqual({
      sender: { name: 'RiderSync', email: 'contato@exemplo.com' },
      to: [{ email: 'pessoa@exemplo.com' }],
      subject: 'Assunto',
      htmlContent: '<p>Oi</p>',
      textContent: 'Oi',
    });
  });

  it('falha com o status da Brevo, sem incluir a chave na mensagem', async () => {
    fetchMock.mockResolvedValue(new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 }));
    const err = await new BrevoTransport('chave-secreta-xyz', 'a@b.com').send(message).catch((e: Error) => e);
    expect(String(err)).toMatch(/Brevo respondeu 401/);
    expect(String(err)).not.toContain('chave-secreta-xyz');
  });

  it('é escolhido quando MAIL_DRIVER=brevo', () => {
    const t = createMailTransport({ MAIL_DRIVER: 'brevo', BREVO_API_KEY: 'k', MAIL_FROM: 'a@b.com' } as Env);
    expect(t.name).toBe('brevo');
  });
});
