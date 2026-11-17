import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmButton } from '../../components/Dialog';
import { applyServerErrors, FormError, SelectField, TextField } from '../../components/Fields';
import { Empty } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { PORTFOLIO_KIND } from '../../lib/format';
import type { ManagedArtist } from '../../lib/types';

const LinkSchema = z.object({
  kind: z.enum(['AUDIO', 'VIDEO', 'PHOTO', 'DOCUMENT', 'LINK']),
  title: z.string().trim().min(2, 'Título é obrigatório.').max(100),
  url: z
    .string()
    .trim()
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'https:' && u.hostname.includes('.');
      } catch {
        return false;
      }
    }, 'Informe um link válido começando com https://'),
});

export function PortfolioEditor({ artist, queryKey }: { artist: ManagedArtist; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ kind: 'PHOTO' | 'DOCUMENT'; title: string; file: File | null }>({ kind: 'PHOTO', title: '', file: null });
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof LinkSchema>>({ resolver: zodResolver(LinkSchema), defaultValues: { kind: 'VIDEO', title: '', url: '' } });
  const canManage = artist.access.canManage;

  const addLink = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await api.post(`/artists/${artist.id}/portfolio`, v);
      form.reset({ kind: v.kind, title: '', url: '' });
      await qc.invalidateQueries({ queryKey });
      toast('Link adicionado ao portfólio.');
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });

  const sendUpload = async () => {
    setUploadErr(null);
    if (!upload.file) return setUploadErr('Selecione um arquivo.');
    if (upload.title.trim().length < 2) return setUploadErr('Informe um título.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('kind', upload.kind);
      fd.append('title', upload.title.trim());
      fd.append('file', upload.file);
      await api.upload('POST', `/artists/${artist.id}/portfolio/upload`, fd);
      setUpload({ kind: upload.kind, title: '', file: null });
      await qc.invalidateQueries({ queryKey });
      toast('Arquivo enviado ao portfólio.');
    } catch (e) {
      setUploadErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/artists/${artist.id}/portfolio/${id}`);
      await qc.invalidateQueries({ queryKey });
      toast('Item removido.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div className="stack">
      <section className="box" aria-label="Itens do portfólio">
        <h2 className="lbl">Portfólio ({artist.portfolio.length})</h2>
        {artist.portfolio.length === 0 ? (
          <Empty title="Portfólio vazio">Adicione links de áudio, vídeo, fotos ou press kit.</Empty>
        ) : (
          <ul className="mlist">
            {artist.portfolio.map((p) => (
              <li key={p.id}>
                <span className="chip">{PORTFOLIO_KIND[p.kind]}</span>
                <div style={{ minWidth: 0 }}>
                  <a className="link" href={p.url ?? '#'} target="_blank" rel="noopener noreferrer">
                    {p.title}
                  </a>
                  <small className="hint" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.isUpload ? `Arquivo: ${p.file?.name}` : p.url}
                  </small>
                </div>
                <span />
                {canManage && (
                  <ConfirmButton className="btn sm ghost danger" confirm={`Remover "${p.title}" do portfólio?`} onConfirm={() => remove(p.id)}>
                    Remover
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <>
          <form className="box form" onSubmit={addLink} noValidate aria-label="Adicionar link">
            <h2 className="lbl">Adicionar link externo</h2>
            <FormError message={formError} />
            <div className="row3">
              <SelectField label="Tipo" {...form.register('kind')}>
                {Object.entries(PORTFOLIO_KIND).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </SelectField>
              <TextField label="Título" {...form.register('title')} error={form.formState.errors.title} />
              <TextField label="Link (https://)" type="url" {...form.register('url')} error={form.formState.errors.url} />
            </div>
            <div className="actions">
              <button className="btn dark" type="submit" disabled={form.formState.isSubmitting}>
                Adicionar link
              </button>
            </div>
          </form>

          <section className="box form" aria-label="Enviar arquivo">
            <h2 className="lbl">Enviar arquivo</h2>
            <FormError message={uploadErr} />
            <div className="row3">
              <SelectField label="Tipo" value={upload.kind} onChange={(e) => setUpload({ ...upload, kind: e.target.value as 'PHOTO' | 'DOCUMENT' })}>
                <option value="PHOTO">Foto (JPG, PNG, WEBP até 5 MB)</option>
                <option value="DOCUMENT">Documento / press kit (PDF até 10 MB)</option>
              </SelectField>
              <TextField label="Título do arquivo" value={upload.title} onChange={(e) => setUpload({ ...upload, title: e.target.value })} />
              <label className="field">
                <span>Arquivo</span>
                <input
                  className="input"
                  type="file"
                  accept={upload.kind === 'PHOTO' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp'}
                  onChange={(e) => setUpload({ ...upload, file: e.target.files?.[0] ?? null })}
                  style={{ paddingTop: 9 }}
                />
              </label>
            </div>
            <div className="actions">
              <button className="btn dark" type="button" onClick={sendUpload} disabled={busy}>
                {busy ? 'Enviando…' : 'Enviar arquivo'}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
