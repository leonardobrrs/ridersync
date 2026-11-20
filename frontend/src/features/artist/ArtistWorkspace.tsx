import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ErrorState, Loading } from '../../components/States';
import { api } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import type { ManagedArtist, Rider } from '../../lib/types';
import { PhotoCard, VisibilityCard } from './ArtistCards';
import { ArtistProfileForm } from './ArtistProfileForm';
import { EquipmentEditor, type EquipmentInput } from './EquipmentEditor';
import { PortfolioEditor } from './PortfolioEditor';

export function RiderTab({ artistId, canManage }: { artistId: string; canManage: boolean }) {
  const q = useQuery({ queryKey: ['rider', artistId], queryFn: () => api.get<Rider>(`/artists/${artistId}/rider`) });
  const save = useAction((p: { items: EquipmentInput[]; notes: string }) => api.put<Rider>(`/artists/${artistId}/rider`, p), {
    invalidate: [['rider', artistId]],
    success: 'Rider salvo.',
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  return (
    <div className="stack">
      <div className="notice">
        <p style={{ margin: 0 }}>
          Liste aqui os equipamentos que você <strong>já possui</strong> e leva para os shows. O que a casa precisa fornecer você informa
          em cada candidatura. Riders de bandas e de integrantes são independentes.
          {canManage && (
            <>
              {' '}
              <Link className="link" to={`/painel/comparar?artist=${artistId}`}>
                Comparar com uma casa
              </Link>
            </>
          )}
        </p>
      </div>
      <EquipmentEditor
        key={q.data!.updatedAt}
        mode="rider"
        items={q.data!.items}
        notes={q.data!.notes}
        readOnly={!canManage}
        saving={save.isPending}
        onSave={(p) => save.mutate(p)}
      />
    </div>
  );
}

/** Abas de gestão de uma identidade artística (perfil individual ou banda). */
export function ArtistWorkspace({ artist, queryKey, extraTabs = [] }: { artist: ManagedArtist; queryKey: unknown[]; extraTabs?: { id: string; label: string; render: () => ReactNode }[] }) {
  const tabs = [
    { id: 'perfil', label: 'Perfil' },
    ...extraTabs.map(({ id, label }) => ({ id, label })),
    { id: 'portfolio', label: `Portfólio (${artist.portfolio.length})` },
    { id: 'rider', label: 'Rider (equipamentos)' },
  ];
  const [tab, setTab] = useState('perfil');
  return (
    <div className="stack">
      <div className="tabs" role="tablist" aria-label="Seções">
        {tabs.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} id={`tab-${t.id}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack">
        {tab === 'perfil' && (
          <>
            {!artist.access.canManage && <div className="notice">Você é integrante: pode visualizar, mas apenas o proprietário e os administradores editam a banda.</div>}
            <VisibilityCard artist={artist} queryKey={queryKey} />
            <PhotoCard artist={artist} queryKey={queryKey} />
            <ArtistProfileForm artist={artist} queryKey={queryKey} />
          </>
        )}
        {extraTabs.find((t) => t.id === tab)?.render()}
        {tab === 'portfolio' && <PortfolioEditor artist={artist} queryKey={queryKey} />}
        {tab === 'rider' && <RiderTab artistId={artist.id} canManage={artist.access.canManage} />}
      </div>
    </div>
  );
}
