import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { ConfirmButton } from '../../components/Dialog';
import { applyServerErrors, FormError, SelectField, TextField } from '../../components/Fields';
import { PageHead } from '../../components/Layout';
import { Avatar, Poster } from '../../components/Poster';
import { Empty, ErrorState, Loading } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, errorMessage } from '../../lib/api';
import { ROLE_LABEL } from '../../lib/format';
import { useAction } from '../../lib/hooks';
import type { BandDetail, BandRole, BandSummary } from '../../lib/types';
import { ArtistWorkspace } from '../artist/ArtistWorkspace';
import { ProfileFields, ProfileFormSchema, toArtistPayload, toFormValues, type ProfileFormValues } from '../artist/ArtistProfileForm';

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
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(ProfileFormSchema), defaultValues: toFormValues() });
  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const band = await api.post<BandDetail>('/bands', toArtistPayload(v));
      await qc.invalidateQueries({ queryKey: ['bands'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('Banda criada. Você é o proprietário (OWNER).');
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
  instrument: z.string().trim().max(60),
});

function MembersTab({ band }: { band: BandDetail }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const key = ['band', band.bandId];
  const [formError, setFormError] = useState<string | null>(null);
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

  return (
    <div className="stack">
      <section className="box" aria-label="Integrantes ativos">
        <h2 className="lbl">Integrantes ativos ({active.length})</h2>
        <ul className="mlist">
          {active.map((m) => (
            <li key={m.id}>
              <Avatar name={m.name} />
              <div>
                <strong>
                  {m.name}
                  {m.isMe && ' (você)'}
                </strong>
                <small className="hint" style={{ display: 'block' }}>
                  {m.instrument ?? 'Função não informada'}
                  {m.musicianProfile && (
                    <>
                      {' · '}
                      <Link className="link" to={`/artistas/${m.musicianProfile.slug}`}>
                        perfil público
                      </Link>
                    </>
                  )}
                </small>
              </div>
              {isOwner && !m.isMe ? (
                <select
                  className="input"
                  aria-label={`Papel de ${m.name}`}
                  value={m.role}
                  onChange={(e) => run(() => api.patch(`/bands/${band.bandId}/members/${m.id}`, { role: e.target.value as BandRole }), 'Papel atualizado.')}
                >
                  <option value="OWNER">Proprietário</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="MEMBER">Integrante</option>
                </select>
              ) : (
                <span className={`role ${m.role === 'OWNER' ? 'owner' : ''}`}>{ROLE_LABEL[m.role]}</span>
              )}
              <span className="row" style={{ gap: 4 }}>
                {isOwner && !m.isMe && m.role !== 'OWNER' && (
                  <ConfirmButton
                    className="btn sm ghost"
                    confirm={`Transferir a propriedade para ${m.name}? Você passará a ADMIN.`}
                    onConfirm={() => run(() => api.post(`/bands/${band.bandId}/transfer-ownership`, { memberId: m.id }), 'Propriedade transferida.')}
                  >
                    Tornar dono
                  </ConfirmButton>
                )}
                {!m.isMe && (isOwner || (band.myRole === 'ADMIN' && m.role === 'MEMBER')) && (
                  <ConfirmButton
                    className="btn sm ghost danger"
                    confirm={`Remover ${m.name} da banda?`}
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
          <ConfirmButton className="btn sm danger" confirm="Sair desta banda?" onConfirm={() => leave.mutate(undefined)}>
            Sair da banda
          </ConfirmButton>
        </div>
        <p className="hint">A banda precisa sempre de ao menos um proprietário (OWNER). Para sair sendo o único, transfira a propriedade antes.</p>
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
                  </div>
                  <span className="st pend">Pendente</span>
                  <ConfirmButton
                    className="btn sm ghost danger"
                    confirm="Cancelar este convite?"
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
                <option value="MEMBER">Integrante (MEMBER)</option>
                {isOwner && <option value="ADMIN">Administrador (ADMIN)</option>}
              </SelectField>
              <TextField label="Função/instrumento" {...form.register('instrument')} />
            </div>
            <p className="hint">A pessoa precisa ter conta no RiderSync. Ela verá o convite no painel e poderá aceitar ou recusar.</p>
            <div className="actions">
              <button className="btn dark" type="submit" disabled={form.formState.isSubmitting}>
                Enviar convite
              </button>
            </div>
          </form>
        </section>
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
        extraTabs={[{ id: 'membros', label: `Integrantes (${band.members.filter((m) => m.status === 'ACTIVE').length})`, render: () => <MembersTab band={band} /> }]}
      />
    </>
  );
}
