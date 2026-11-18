import { useEffect, type RefObject } from 'react';

/**
 * Fecha um menu/painel flutuante ao clicar ou tocar fora dele e ao pressionar Esc.
 * `pointerdown` cobre mouse, toque e caneta e dispara antes do clique, então um toque fora fecha o menu sem
 * acionar nada dentro dele. Esc devolve o foco ao botão que abriu o menu (quando informado).
 */
export function useDismiss(open: boolean, container: RefObject<HTMLElement | null>, onClose: () => void, trigger?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      trigger?.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, container, onClose, trigger]);
}
