import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Diálogo modal acessível baseado em <dialog> nativo (foco preso e Esc pelo navegador). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
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
    <dialog ref={ref} className={wide ? 'wide' : undefined} aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      {open && (
        <div className="dlg">
          <div className="dlg-h">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="iconbtn" onClick={onClose} aria-label="Fechar">
              <Icon name="x" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Botão que pede confirmação antes de uma ação destrutiva/irreversível. */
export function ConfirmButton({
  children,
  confirm,
  onConfirm,
  className = 'btn sm',
  disabled,
}: {
  children: ReactNode;
  confirm: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(confirm)) onConfirm();
      }}
    >
      {children}
    </button>
  );
}
