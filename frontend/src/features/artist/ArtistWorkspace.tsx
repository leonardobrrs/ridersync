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

/** Quando o rider passou a significar "o que o artista precisa" (antes: "o que possui"). */
export const RIDER_CONCEPT_CHANGED_AT = '2026-11-23T20:00:00-03:00';

/**
 * Rider salvo antes da mudança de conceito: os itens foram cadastrados como "o que você possui" e agora são lidos como
 * "o que você precisa", com "Já possuo" zerado. Pede revisão até o próximo salvamento.
 */
export function riderNeedsReview(r: Pick<Rider, 'items' | 'updatedAt'>) {
  return r.items.length > 0 && !!r.updatedAt && new Date(r.updatedAt).getTime() < new Date(RIDER_CONCEPT_CHANGED_AT).getTime();
}

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
      {canManage && riderNeedsReview(q.data!) && (
        <div className="notice warn" role="status">
          <p style={{ margin: 0 }}>
            <strong>Revise seu rider.</strong> Ele foi cadastrado quando o rider significava “o que você possui”. Agora ele é o que você{' '}
            <strong>precisa</strong> para tocar: confira as quantidades, preencha “Já possuo” em cada item e salve. Este aviso some depois que você
            salvar.
          </p>
        </div>
      )}
      <div className="notice">
        <p style={{ margin: 0 }}>
          O rider lista o que você <strong>precisa</strong> para tocar (instrumentos, amplificação, microfones…). Em cada item, informe
          também quanto você <strong>já possui</strong> e leva: a casa só precisa cobrir a diferença. Exemplo: você precisa de 2 amplificadores e
          já tem 1 — se a casa tiver 1, a comparação dá positivo e avisa que o outro é por sua conta. Riders de bandas e de integrantes são
          independentes.
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
    { id: 'rider', label: 'Rider técnico' },
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
