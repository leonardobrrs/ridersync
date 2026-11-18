import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../components/Icon';
import { dateTime, SIDE_LABEL } from '../../lib/format';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import type { BookingDetail } from '../../lib/types';

type Message = BookingDetail['messages'][number];

/**
 * Conversa da negociação.
 *  - Desktop: caixa fixa na coluna lateral.
 *  - Celular/tablet: barra "Mensagens" fixa no rodapé (acima da barra de atalhos) que abre a conversa em um
 *    painel sobre a página, como os chats da maioria dos sites. Fecha no X, no fundo escurecido ou com Esc.
 *  Enter envia; Shift+Enter quebra a linha (durante composição de acentos/IME o Enter não envia).
 */
export function BookingChat({ b, onSend }: { b: BookingDetail; onSend: (text: string) => Promise<boolean> }) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const count = b.messages.length;
  const last = b.messages[count - 1];

  if (!mobile) {
    return (
      <section className="box chat-box" aria-label="Mensagens">
        <h2 className="lbl">Mensagens</h2>
        <MessageList messages={b.messages} />
        {b.allowed.message && <Composer onSend={onSend} />}
      </section>
    );
  }

  return (
    <>
      <button type="button" className="chat-dock" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className="chat-dock-i" aria-hidden="true">
          <Icon name="chat" size={20} />
        </span>
        <span className="chat-dock-t">
          <strong>Mensagens{count ? ` (${count})` : ''}</strong>
          <small>{last ? `${last.author?.isMe ? 'Você' : (last.author?.name ?? 'Conta removida')}: ${last.body}` : b.allowed.message ? 'Escreva para a outra parte' : 'Nenhuma mensagem'}</small>
        </span>
        <Icon name="expand" size={18} />
      </button>
      {open && <ChatSheet b={b} onSend={onSend} onClose={() => setOpen(false)} titleId={titleId} />}
    </>
  );
}

function ChatSheet({ b, onSend, onClose, titleId }: { b: BookingDetail; onSend: (text: string) => Promise<boolean>; onClose: () => void; titleId: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // Foco direto no campo de mensagem (ou no botão de fechar, se a negociação não aceita mensagens).
    (panel.current?.querySelector<HTMLElement>('textarea') ?? panel.current?.querySelector<HTMLElement>('button'))?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);
  return (
    <>
      <div className="chat-backdrop" aria-hidden="true" onClick={onClose} />
      <div className="chat-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <div className="chat-sheet-h">
          <div className="stack-sm" style={{ gap: 0, minWidth: 0 }}>
            <strong id={titleId}>Mensagens</strong>
            <small className="muted clamp-1">{b.title}</small>
          </div>
          <button type="button" className="btn sm ghost" aria-label="Fechar conversa" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <MessageList messages={b.messages} scroll />
        {b.allowed.message ? <Composer onSend={onSend} /> : <p className="hint chat-closed">Esta negociação não aceita novas mensagens.</p>}
      </div>
    </>
  );
}

function MessageList({ messages, scroll = false }: { messages: Message[]; scroll?: boolean }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  if (messages.length === 0) return <p className={`hint${scroll ? ' chat-body chat-empty' : ''}`}>Nenhuma mensagem ainda.</p>;
  return (
    <ol className={`chat${scroll ? ' chat-body' : ''}`} aria-live="polite">
      {messages.map((m, i) => (
        <li key={m.id} ref={i === messages.length - 1 ? end : undefined} className={`bubble ${m.author?.isMe ? 'me' : ''}`}>
          <small>
            {m.author?.name ?? 'Conta removida'} · {SIDE_LABEL[m.authorSide]} · {dateTime(m.createdAt)}
          </small>
          {m.body}
        </li>
      ))}
    </ol>
  );
}

function Composer({ onSend }: { onSend: (text: string) => Promise<boolean> }) {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const send = useCallback(async () => {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true);
    // O texto só é limpo se o envio der certo: em caso de erro a mensagem continua no campo.
    if (await onSend(text)) setMsg('');
    setSending(false);
  }, [msg, sending, onSend]);
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };
  return (
    <form
      className="chat-compose"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label className="sr-only" htmlFor="chat-msg">
        Nova mensagem
      </label>
      <textarea
        id="chat-msg"
        className="input"
        placeholder="Escreva uma mensagem…"
        maxLength={2000}
        rows={2}
        enterKeyHint="send"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button className="btn dark" type="submit" disabled={sending || !msg.trim()} aria-label="Enviar mensagem">
        {sending ? 'Enviando…' : 'Enviar'}
      </button>
      <small className="hint chat-tip">Enter envia · Shift+Enter quebra a linha</small>
    </form>
  );
}
