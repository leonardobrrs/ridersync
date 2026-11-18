import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Diálogo modal acessível baseado em <dialog> nativo (foco preso e Esc pelo navegador). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** false: obrigatório — Esc e o botão de fechar ficam desativados. */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={wide ? 'wide' : undefined} aria-labelledby={titleId} onClose={onClose}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
        else onClose();
      }}
    >
      {open && (
        <div className="dlg">
          <div className="dlg-h">
            <h2 id={titleId}>{title}</h2>
            {dismissible && (
              <button type="button" className="iconbtn" onClick={onClose} aria-label="Fechar">
                <Icon name="x" />
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Modal de confirmação do sistema (substitui o confirm() do navegador). */
export function ConfirmDialog({
  open,
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  danger,
  busy,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="stack">
        <div className="prose">{message}</div>
        {children}
        <div className="row dlg-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Voltar
          </button>
          <button type="button" className={`btn ${danger ? 'danger' : 'cue'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Botão que pede confirmação (modal do sistema) antes de uma ação destrutiva/irreversível. */
export function ConfirmButton({
  children,
  confirm,
  onConfirm,
  className = 'btn sm',
  disabled,
  title,
  confirmLabel,
  danger,
}: {
  children: ReactNode;
  confirm: ReactNode;
  onConfirm: () => void | Promise<unknown>;
  className?: string;
  disabled?: boolean;
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => setOpen(true)}>
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        message={confirm}
        confirmLabel={confirmLabel}
        danger={danger}
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await onConfirm();
            setOpen(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

/** Pede um texto opcional (ex.: motivo) em modal do sistema (substitui o prompt() do navegador). */
export function TextPromptDialog({
  open,
  title,
  label,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  message?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (value: string) => void | Promise<unknown>;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message ?? null}
      confirmLabel={confirmLabel}
      danger={danger}
      busy={busy}
      onClose={() => {
        setValue('');
        onClose();
      }}
      onConfirm={async () => {
        setBusy(true);
        try {
          await onConfirm(value.trim());
          setValue('');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea id={id} className="input" rows={3} maxLength={500} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    </ConfirmDialog>
  );
}

/**
 * Botão de confirmação final que só fica habilitado após a contagem regressiva — evita confirmações
 * por impulso em ações críticas. Não substitui a validação do servidor.
 */
export function CountdownButton({
  seconds = 3,
  children,
  onClick,
  busy,
  className = 'btn danger',
}: {
  seconds?: number;
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return (
    <button type="button" className={className} disabled={left > 0 || busy} onClick={onClick} aria-live="polite">
      {busy ? 'Aguarde…' : left > 0 ? `${children} (${left}s)` : children}
    </button>
  );
}
