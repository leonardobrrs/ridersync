import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';

const INTERVAL_MS = 5_000;

function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/**
 * Atualização em tempo real sem recarregar a página. Consulta `/me/pulse` (assinatura barata do estado do usuário:
 * negociações, ofertas, mensagens, contratos, candidaturas, eventos, notificações e convites) a cada 5 s com a aba
 * visível e assim que ela volta a ficar visível. Quando a assinatura muda, todas as consultas abertas são
 * recarregadas — confirmações, contrapropostas, mensagens e mudanças de estado aparecem sozinhas.
 */
export function useLivePulse(enabled: boolean) {
  const qc = useQueryClient();
  const visible = usePageVisible();
  const last = useRef<string | null>(null);
  const pulse = useQuery({
    queryKey: ['pulse'],
    queryFn: () => api.get<{ v: string }>('/me/pulse'),
    enabled: enabled && visible,
    refetchInterval: enabled && visible ? INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const v = pulse.data?.v;
  useEffect(() => {
    if (!v) return;
    if (last.current !== null && last.current !== v) {
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'pulse' });
    }
    last.current = v;
  }, [v, qc]);
  useEffect(() => {
    if (!enabled) last.current = null;
  }, [enabled]);
}
