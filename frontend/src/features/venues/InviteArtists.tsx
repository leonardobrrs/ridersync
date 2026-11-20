import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Icon } from '../../components/Icon';
import { api, qs } from '../../lib/api';
import type { ArtistCard, Paged } from '../../lib/types';

export type InvitedArtist = Pick<ArtistCard, 'id' | 'name' | 'slug' | 'kind'>;

/** Busca perfis públicos (músicos e bandas) e monta a lista de artistas a convidar. */
export function InviteArtists({ value, onChange }: { value: InvitedArtist[]; onChange: (v: InvitedArtist[]) => void }) {
  const id = useId();
  const [term, setTerm] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setQ(term.trim()), 300);
    return () => window.clearTimeout(t);
  }, [term]);
  const results = useQuery({
    queryKey: ['invite-search', q],
    queryFn: () => api.get<Paged<ArtistCard>>(`/public/artists${qs({ q, pageSize: 8 })}`),
    enabled: q.length >= 2,
  });
  const chosen = new Set(value.map((a) => a.id));
  return (
    <div className="invite">
      <label htmlFor={id}>Convidar artistas</label>
      <input id={id} className="input" type="search" placeholder="Buscar músico ou banda pelo nome ou @perfil" value={term} onChange={(e) => setTerm(e.target.value)} />
      {q.length >= 2 && (
        <ul className="invite-results" aria-label="Resultados da busca">
          {results.isLoading && <li className="hint">Buscando…</li>}
          {results.data?.items.length === 0 && <li className="hint">Nenhum perfil público encontrado.</li>}
          {results.data?.items.map((a) => (
            <li key={a.id}>
              <label className="fchk">
                <input
                  type="checkbox"
                  checked={chosen.has(a.id)}
                  onChange={() => onChange(chosen.has(a.id) ? value.filter((v) => v.id !== a.id) : [...value, { id: a.id, name: a.name, slug: a.slug, kind: a.kind }])}
                />
                <span>
                  {a.name} <small className="muted">@{a.slug} · {a.kind === 'BAND' ? 'Banda' : 'Músico'}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <ul className="chips" aria-label="Artistas convidados">
          {value.map((a) => (
            <li key={a.id} className="chip">
              {a.name}
              <button type="button" className="chip-x" aria-label={`Remover ${a.name}`} onClick={() => onChange(value.filter((v) => v.id !== a.id))}>
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Envia os convites (propostas diretas vinculadas ao evento). Retorna quantos falharam. */
export async function sendInvites(
  ev: { id: string; organizerId: string; startsAt: string; durationMinutes: number | null; feeCents: number | null; conditions: string },
  artists: InvitedArtist[],
  terms?: { performanceAt: string; durationMinutes: number; feeCents: number },
): Promise<{ failed: { name: string; reason: string }[] }> {
  const failed: { name: string; reason: string }[] = [];
  const offer = terms ?? { performanceAt: ev.startsAt, durationMinutes: ev.durationMinutes ?? 60, feeCents: ev.feeCents ?? 0 };
  for (const a of artists) {
    try {
      await api.post('/bookings', { organizationId: ev.organizerId, artistId: a.id, eventId: ev.id, offer: { ...offer, terms: ev.conditions } });
    } catch (e) {
      failed.push({ name: a.name, reason: e instanceof Error ? e.message : 'erro' });
    }
  }
  return { failed };
}
