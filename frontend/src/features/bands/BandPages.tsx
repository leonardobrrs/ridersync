import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { ConfirmButton } from '../../components/Dialog';
import { ImagePicker, uploadForm } from '../../components/Media';
import { TransferOwnershipDialog } from '../../components/TransferOwnershipDialog';
import { applyServerErrors, FormError, SelectField, TextField } from '../../components/Fields';
import { PageHead } from '../../components/Layout';
import { Avatar, Poster } from '../../components/Poster';
import { Empty, ErrorState, Loading } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { ROLE_LABEL } from '../../lib/format';
import { useAction, useMeta } from '../../lib/hooks';
import type { BandDetail, BandRole, BandSummary } from '../../lib/types';
import { ArtistWorkspace } from '../artist/ArtistWorkspace';
import { ProfileFields, ProfileFormSchema, toArtistPayload, toFormValues, type ProfileFormValues } from '../artist/ArtistProfileForm';
import { InstrumentLabel } from '../../components/InstrumentLabel';
import { BandLegalSection } from '../contracts/LegalDataForms';

export function BandsPage() {
  const q = useQuery({ queryKey: ['bands'], queryFn: () => api.get<BandSummary[]>('/bands/mine') });
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHead
        title="Minhas bandas"
        subtitle="Cada banda tem perfil, portfólio e rider próprios — independentes dos perfis individuais dos integrantes."
        actions={
          !creating && (
            <button className="btn cue" type="button" onClick={() => setCreating(true)}>
              Criar banda
            </button>
          )
        }
      />
      {creating && <CreateBand onCancel={() => setCreating(false)} />}
      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} retry={q.refetch} />}
      {q.data && q.data.length === 0 && !creating && (
        <Empty title="Você ainda não participa de nenhuma banda">
          Crie uma banda ou aceite um convite em <Link className="link" to="/painel/convites">Convites</Link>.
        </Empty>
      )}
      {q.data && q.data.length > 0 && (
        <div className="stack-sm">
          {q.data.map((b) => (
            <article className="prow" key={b.bandId}>
              <Poster name={b.artist.name} photoUrl={b.artist.photoUrl} top={[b.artist.city ?? '', '']} bottom={[b.artist.genres[0] ?? '', '']} />
              <div>
                <h3>{b.artist.name}</h3>
                <div className="meta">
                  <span className={`role ${b.role === 'OWNER' ? 'owner' : ''}`}>{ROLE_LABEL[b.role]}</span>
                  <span>{b.memberCount} integrante(s) ativo(s)</span>
                  <span className={`st ${b.artist.visibility === 'PUBLIC' ? 'pub' : 'draft'}`}>{b.artist.visibility === 'PUBLIC' ? 'Pública' : 'Privada'}</span>
                </div>
              </div>
              <div className="acts">
                <Link className="btn sm" to={`/painel/bandas/${b.bandId}`}>
                  {b.role === 'MEMBER' ? 'Ver banda' : 'Gerenciar'}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function CreateBand({ onCancel }: { onCancel: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(ProfileFormSchema), defaultValues: toFormValues() });
  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const band = await api.post<BandDetail>('/bands', toArtistPayload(v));
      if (photo) {
        await api.upload('PUT', `/artists/${band.artist.id}/photo`, uploadForm(photo)).catch(() => toast('A banda foi criada, mas a imagem não pôde ser enviada.', 'error'));
      }
      await qc.invalidateQueries({ queryKey: ['bands'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('Banda criada. Você é o proprietário.');
      navigate(`/painel/bandas/${band.bandId}`);
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });
  return (
    <form className="box form" onSubmit={onSubmit} noValidate aria-label="Criar banda">
      <h2 className="lbl">Nova banda</h2>
      <div className="notice">Os dados da banda não são copiados do seu perfil individual. A banda começa privada.</div>
      <FormError message={formError} />
      <ImagePicker label="Imagem da banda" value={photo} onChange={setPhoto} />
      <ProfileFields form={form} solo={false} />
      <div className="actions">
        <button className="btn ghost" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
          Criar banda
        </button>
      </div>
    </form>
  );
}

const InviteSchema = z.object({
  email: z.email('Informe o e-mail da conta RiderSync da pessoa.'),
  role: z.enum(['MEMBER', 'ADMIN']),
  instrument: z.string(),
});

/** Dropdown de função/cargo. Valores antigos fora da lista continuam visíveis até serem trocados. */
function PositionSelect({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const { data: meta } = useMeta();
  const positions = meta?.bandPositions ?? [];
  return (
    <select className="input" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Função não informada</option>
      {value && !positions.includes(value) && <option value={value}>{value}</option>}
      {positions.map((p) => (
        <option key={p}>{p}</option>
      ))}
    </select>
  );
}

function MembersTab({ band }: { band: BandDetail }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: meta } = useMeta();
  const key = ['band', band.bandId];
  const [formError, setFormError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const form = useForm<z.infer<typeof InviteSchema>>({ resolver: zodResolver(InviteSchema), defaultValues: { email: '', role: 'MEMBER', instrument: '' } });
  const isOwner = band.myRole === 'OWNER';
  const isManager = band.myRole !== 'MEMBER';

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: key });
      toast(success);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const leave = useAction(() => api.post(`/bands/${band.bandId}/leave`), {
    invalidate: [['bands'], ['me']],
    success: 'Você saiu da banda.',
    onSuccess: () => navigate('/painel/bandas'),
  });

  const invite = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      await api.post(`/bands/${band.bandId}/invitations`, { ...v, instrument: v.instrument || null });
      form.reset({ email: '', role: 'MEMBER', instrument: '' });
      await qc.invalidateQueries({ queryKey: key });
      toast('Convite enviado. O vínculo só fica ativo após o aceite.');
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });

  const active = band.members.filter((m) => m.status === 'ACTIVE');
  const invited = band.members.filter((m) => m.status === 'INVITED');
  const candidates = active.filter((m) => !m.isMe).map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="stack">
      <section className="box" aria-label="Integrantes ativos">
        <div className="row space">
          <h2 className="lbl">Integrantes ativos ({active.length})</h2>
          {isOwner && (
            <button className="btn sm dark" type="button" onClick={() => setTransferOpen(true)}>
              Transferir propriedade
            </button>
          )}
        </div>
        <ul className="mlist">
          {active.map((m) => (
            <li key={m.id}>
              <Avatar name={m.name} />
              <div className="stack-sm">
                <strong>
                  {m.name}
                  {m.isMe && ' (você)'}
                </strong>
                {m.musicianProfile && (
                  <Link className="handle" to={`/artistas/${m.musicianProfile.slug}`}>
                    @{m.musicianProfile.slug}
                  </Link>
                )}
                {isManager || m.isMe ? (
                  <PositionSelect
                    label={`Função de ${m.name}`}
                    value={m.instrument}
                    onChange={(v) => run(() => api.patch(`/bands/${band.bandId}/members/${m.id}/position`, { instrument: v }), 'Função atualizada.')}
                  />
                ) : (
                  m.instrument ? <InstrumentLabel value={m.instrument} /> : <small className="hint">Função não informada</small>
                )}
              </div>
              {isOwner && !m.isMe && m.role !== 'OWNER' ? (
                <select
                  className="input"
                  aria-label={`Papel de ${m.name}`}
                  value={m.role}
                  onChange={(e) => run(() => api.patch(`/bands/${band.bandId}/members/${m.id}`, { role: e.target.value as BandRole }), 'Papel atualizado.')}
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="MEMBER">Integrante</option>
                </select>
              ) : (
                <span className={`role ${m.role === 'OWNER' ? 'owner' : ''}`}>{ROLE_LABEL[m.role]}</span>
              )}
              <span className="row" style={{ gap: 4 }}>
                {!m.isMe && m.role !== 'OWNER' && (isOwner || (band.myRole === 'ADMIN' && m.role === 'MEMBER')) && (
                  <ConfirmButton
                    className="btn sm ghost danger"
                    confirm={`Remover ${m.name} da banda?`}
                    confirmLabel="Remover"
                    danger
                    onConfirm={() => run(() => api.delete(`/bands/${band.bandId}/members/${m.id}`), 'Integrante removido.')}
                  >
                    Remover
                  </ConfirmButton>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <ConfirmButton className="btn sm danger" confirm="Sair desta banda?" confirmLabel="Sair da banda" danger onConfirm={() => leave.mutate(undefined)}>
            Sair da banda
          </ConfirmButton>
        </div>
        <p className="hint">A banda precisa sempre de um proprietário. Para sair sendo o único, transfira a propriedade antes.</p>
      </section>

      {isManager && (
        <section className="box" aria-label="Convites pendentes">
          <h2 className="lbl">Convites pendentes ({invited.length})</h2>
          {invited.length === 0 ? (
            <p className="hint">Nenhum convite pendente.</p>
          ) : (
            <ul className="mlist">
              {invited.map((m) => (
                <li key={m.id}>
                  <Avatar name={m.name} />
                  <div>
                    <strong>{m.name}</strong>
                    <small className="hint" style={{ display: 'block' }}>
                      {m.email} · {ROLE_LABEL[m.role]}
                    </small>
                    {m.instrument && <InstrumentLabel value={m.instrument} size={13} />}
                  </div>
                  <span className="st pend">Pendente</span>
                  <ConfirmButton
                    className="btn sm ghost danger"
                    confirm="Cancelar este convite?"
                    confirmLabel="Cancelar convite"
                    danger
                    onConfirm={() => run(() => api.delete(`/bands/${band.bandId}/invitations/${m.id}`), 'Convite cancelado.')}
                  >
                    Cancelar
                  </ConfirmButton>
                </li>
              ))}
            </ul>
          )}
          <form className="form" onSubmit={invite} noValidate aria-label="Convidar integrante">
            <FormError message={formError} />
            <div className="row3">
              <TextField label="E-mail da conta da pessoa" type="email" {...form.register('email')} error={form.formState.errors.email} />
              <SelectField label="Papel" {...form.register('role')}>
                <option value="MEMBER">Integrante</option>
                {isOwner && <option value="ADMIN">Administrador</option>}
              </SelectField>
              <SelectField label="Função" {...form.register('instrument')}>
                <option value="">Definir depois</option>
                {meta?.bandPositions.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </SelectField>
            </div>
            <p className="hint">A pessoa precisa ter uma conta de artista no RiderSync. Ela verá o convite no painel e poderá aceitar ou recusar.</p>
            <div className="actions">
              <button className="btn dark" type="submit" disabled={form.formState.isSubmitting}>
                Enviar convite
              </button>
            </div>
          </form>
        </section>
      )}

      {isOwner && (
        <TransferOwnershipDialog
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          entityLabel="banda"
          entityName={band.artist.name}
          candidates={candidates}
          onTransfer={async (memberId, password) => {
            await api.post(`/bands/${band.bandId}/transfer-ownership`, { memberId, password });
            await qc.invalidateQueries({ queryKey: key });
            await qc.invalidateQueries({ queryKey: ['bands'] });
            toast('Propriedade transferida. Você agora é administrador(a).');
          }}
        />
      )}
    </div>
  );
}

export function BandPage() {
  const { bandId } = useParams();
  const key = ['band', bandId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<BandDetail>(`/bands/${bandId}`) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={q.refetch} />;
  const band = q.data!;
  return (
    <>
      <PageHead
        title={band.artist.name}
        back="/painel/bandas"
        subtitle={
          <>
            Seu papel: <span className={`role ${band.myRole === 'OWNER' ? 'owner' : ''}`}>{ROLE_LABEL[band.myRole]}</span>
          </>
        }
      />
      <ArtistWorkspace
        artist={band.artist}
        queryKey={key}
        extraTabs={[
          { id: 'membros', label: `Integrantes (${band.members.filter((m) => m.status === 'ACTIVE').length})`, render: () => <MembersTab band={band} /> },
          ...(band.legal ? [{ id: 'contrato', label: 'Dados para contrato', render: () => <BandLegalSection band={band} /> }] : []),
        ]}
      />
    </>
  );
}
