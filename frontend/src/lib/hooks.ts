import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { CatalogItem, Me, Meta } from './types';
import { useToast } from '../components/Toast';

/** Sessão atual (null para visitante). */
export function useMe() {
  return useQuery<Me | null>({
    queryKey: ['me'],
    queryFn: () => api.get<Me | null>('/auth/session'),
    staleTime: 60_000,
  });
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api.get<Meta>('/public/meta'), staleTime: Infinity });
}

export function useCatalog() {
  return useQuery({ queryKey: ['catalog'], queryFn: () => api.get<CatalogItem[]>('/catalog/equipment'), staleTime: Infinity });
}

/**
 * Mutação com feedback padrão: toast de sucesso/erro e invalidação das consultas afetadas.
 */
export function useAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string; invalidate?: QueryKey[]; onSuccess?: (r: TResult, v: TVars) => void } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<TResult, ApiError, TVars>({
    mutationFn: fn,
    onSuccess: async (r, v) => {
      await Promise.all((opts.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      if (opts.success) toast(opts.success);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => toast(e.message, 'error'),
  });
}
