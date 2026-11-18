import { prepareImage } from '../../components/Media';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Poster } from '../../components/Poster';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import type { ManagedArtist } from '../../lib/types';

/** Publicação: exige campos mínimos; o backend aplica a mesma regra. */
export function VisibilityCard({ artist, queryKey }: { artist: ManagedArtist; queryKey: unknown[] }) {
  const isPublic = artist.visibility === 'PUBLIC';
  const action = useAction((visibility: 'PUBLIC' | 'PRIVATE') => api.put(`/artists/${artist.id}/visibility`, { visibility }), {
    invalidate: [queryKey, ['me']],
    success: isPublic ? 'Perfil agora é privado.' : 'Perfil publicado no marketplace.',
  });
  return (
    <section className="box" aria-label="Visibilidade">
      <div className="row between">
        <div className="stack-sm">
          <h2 className="lbl">Visibilidade</h2>
          <span className={`st ${isPublic ? 'pub' : 'draft'}`}>{isPublic ? 'Público no marketplace' : 'Privado'}</span>
        </div>
        {artist.access.canManage && (
          <button
            className={`btn ${isPublic ? '' : 'cue'}`}
            type="button"
            disabled={action.isPending || (!isPublic && artist.publicationIssues.length > 0)}
            onClick={() => action.mutate(isPublic ? 'PRIVATE' : 'PUBLIC')}
          >
            {isPublic ? 'Tornar privado' : 'Publicar perfil'}
          </button>
        )}
      </div>
      {!isPublic && artist.publicationIssues.length > 0 && (
        <div className="inline-msg info">
          Para publicar, complete: {artist.publicationIssues.join(', ')}.
        </div>
      )}
      {isPublic && (
        <div className="row">
          <Link className="btn sm" to={`/artistas/${artist.slug}`}>
            Ver perfil público
          </Link>
          <span className="hint">Perfis públicos podem se candidatar a oportunidades e receber propostas.</span>
        </div>
      )}
    </section>
  );
}

export function PhotoCard({ artist, queryKey }: { artist: ManagedArtist; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload('PUT', `/artists/${artist.id}/photo`, fd);
      await qc.invalidateQueries({ queryKey });
      toast('Foto atualizada.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/artists/${artist.id}/photo`);
      await qc.invalidateQueries({ queryKey });
      toast('Foto removida.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="box" aria-label="Foto de perfil">
      <h2 className="lbl">Foto de perfil</h2>
      <div className="photo-edit">
        <Poster name={artist.name} photoUrl={artist.photoUrl} top={[artist.city ?? '', artist.state]} bottom={[artist.genres[0] ?? '', '']} />
        {artist.access.canManage && (
          <div className="stack-sm">
            <label className="btn sm">
              {busy ? 'Enviando…' : artist.photoUrl ? 'Trocar foto' : 'Enviar foto'}
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={async (e) => e.target.files?.[0] && upload(await prepareImage(e.target.files[0]))}
              />
            </label>
            {artist.photoUrl && (
              <button type="button" className="btn sm ghost danger" onClick={remove} disabled={busy}>
                Remover foto
              </button>
            )}
            <span className="hint">JPG, PNG ou WEBP (fotos grandes são reduzidas automaticamente).</span>
          </div>
        )}
      </div>
    </section>
  );
}
