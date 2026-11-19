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

const booking = (allowMessage = true, unreadMessages = 0) =>
  ({
    title: 'Sexta Autoral',
    unreadMessages,
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
    render(<BookingChat b={booking()} onSend={onSend} onRead={vi.fn()} />);
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
    render(<BookingChat b={booking()} onSend={onSend} onRead={vi.fn()} />);
    const input = screen.getByLabelText('Nova mensagem');
    fireEvent.change(input, { target: { value: 'Não pode sumir' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    });
    expect(input).toHaveValue('Não pode sumir');
  });

  it('celular: barra fixa abre a conversa em pop-up, que fecha com Esc; sem não lidas não há contador', async () => {
    mockViewport(true);
    const onRead = vi.fn();
    render(<BookingChat b={booking()} onSend={vi.fn()} onRead={onRead} />);
    expect(screen.queryByRole('region', { name: 'Mensagens' })).not.toBeInTheDocument();
    const dock = screen.getByRole('button', { name: /Mensagens/ });
    expect(dock).toHaveTextContent('Rafa: Olá! Tudo certo para sexta?');
    expect(dock).not.toHaveTextContent('(1)');
    expect(dock.querySelector('.chat-dock-n')).toBeNull();
    fireEvent.click(dock);
    const dialog = screen.getByRole('dialog', { name: 'Mensagens' });
    expect(dialog).toHaveTextContent('Olá! Tudo certo para sexta?');
    expect(screen.getByLabelText('Nova mensagem')).toHaveFocus();
    expect(onRead).not.toHaveBeenCalled(); // nada para marcar
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('celular: contador mostra só as não lidas e abrir o pop-up marca como lidas', () => {
    mockViewport(true);
    const onRead = vi.fn();
    render(<BookingChat b={booking(true, 2)} onSend={vi.fn()} onRead={onRead} />);
    expect(screen.getByLabelText('2 não lidas')).toHaveTextContent('2');
    expect(onRead).not.toHaveBeenCalled(); // fechado: ainda não leu
    fireEvent.click(screen.getByRole('button', { name: /Mensagens/ }));
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('desktop: conversa visível com não lidas marca como lida', () => {
    mockViewport(false);
    const onRead = vi.fn();
    render(<BookingChat b={booking(true, 1)} onSend={vi.fn()} onRead={onRead} />);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('negociação encerrada: sem campo de mensagem', () => {
    mockViewport(false);
    render(<BookingChat b={booking(false)} onSend={vi.fn()} onRead={vi.fn()} />);
    expect(screen.queryByLabelText('Nova mensagem')).not.toBeInTheDocument();
  });
});
