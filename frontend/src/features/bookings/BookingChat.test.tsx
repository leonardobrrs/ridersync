import { act, fireEvent, render, screen } from '@testing-library/react';
import type { BookingDetail } from '../../lib/types';
import { BookingChat } from './BookingChat';

function mockViewport(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: mobile,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const booking = (allowMessage = true) =>
  ({
    title: 'Sexta Autoral',
    allowed: { message: allowMessage },
    messages: [{ id: 'm1', authorSide: 'VENUE', body: 'Olá! Tudo certo para sexta?', createdAt: '2026-11-18T20:00:00-03:00', author: { name: 'Rafa', isMe: false } }],
  }) as unknown as BookingDetail;

describe('conversa da negociação', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });

  it('desktop: conversa na coluna; Enter envia e Shift+Enter não envia', async () => {
    mockViewport(false);
    const onSend = vi.fn().mockResolvedValue(true);
    render(<BookingChat b={booking()} onSend={onSend} />);
    expect(screen.getByRole('region', { name: 'Mensagens' })).toBeInTheDocument();
    const input = screen.getByLabelText('Nova mensagem');
    fireEvent.change(input, { target: { value: 'Tudo certo!' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(onSend).toHaveBeenCalledWith('Tudo certo!');
    expect(input).toHaveValue('');
  });

  it('mantém o texto quando o envio falha', async () => {
    mockViewport(false);
    const onSend = vi.fn().mockResolvedValue(false);
    render(<BookingChat b={booking()} onSend={onSend} />);
    const input = screen.getByLabelText('Nova mensagem');
    fireEvent.change(input, { target: { value: 'Não pode sumir' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    });
    expect(input).toHaveValue('Não pode sumir');
  });

  it('celular: barra fixa abre a conversa em pop-up, que fecha com Esc', async () => {
    mockViewport(true);
    const onSend = vi.fn().mockResolvedValue(true);
    render(<BookingChat b={booking()} onSend={onSend} />);
    expect(screen.queryByRole('region', { name: 'Mensagens' })).not.toBeInTheDocument();
    const dock = screen.getByRole('button', { name: /Mensagens \(1\)/ });
    expect(dock).toHaveTextContent('Rafa: Olá! Tudo certo para sexta?');
    fireEvent.click(dock);
    const dialog = screen.getByRole('dialog', { name: 'Mensagens' });
    expect(dialog).toHaveTextContent('Olá! Tudo certo para sexta?');
    expect(screen.getByLabelText('Nova mensagem')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('negociação encerrada: sem campo de mensagem', () => {
    mockViewport(false);
    render(<BookingChat b={booking(false)} onSend={vi.fn()} />);
    expect(screen.queryByLabelText('Nova mensagem')).not.toBeInTheDocument();
  });
});
