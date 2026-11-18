import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { ConfirmButton, CountdownButton, Dialog } from '../../components/Dialog';
import { applyServerErrors, FormError, TextField } from '../../components/Fields';
import { PageHead } from '../../components/Layout';
import { ImagePicker, uploadForm } from '../../components/Media';
import { PasswordField } from '../../components/PasswordField';
import { Avatar } from '../../components/Poster';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { date } from '../../lib/format';
import { useMe } from '../../lib/hooks';
import { matchesWhenBothFilled, strongPassword } from '../../lib/password';
import type { Me } from '../../lib/types';

const NameSchema = z.object({ name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120) });
const PasswordSchema = (needsCurrent: boolean) =>
  z
    .object({
      currentPassword: needsCurrent ? z.string().min(1, 'Informe a senha atual.') : z.string().optional(),
      newPassword: strongPassword,
      newPasswordConfirmation: z.string().min(1, 'Confirme a nova senha.'),
    })
    .refine((v) => v.newPassword === v.newPasswordConfirmation, matchesWhenBothFilled('newPassword', 'newPasswordConfirmation'));

export function AccountPage() {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <>
      <PageHead title="Conta e privacidade" subtitle="Dados privados da sua conta — não aparecem em perfis públicos." />
      <ProfileSection me={me} />
      <PasswordSection me={me} />
      <PrivacySection me={me} />
    </>
  );
}

function ProfileSection({ me }: { me: Me }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const nameForm = useForm<z.infer<typeof NameSchema>>({ resolver: zodResolver(NameSchema), values: { name: me.user.name } });

  const saveName = nameForm.handleSubmit(async (v) => {
    setNameErr(null);
    try {
      qc.setQueryData(['me'], await api.patch<Me>('/account', v));
      toast('Nome atualizado.');
    } catch (e) {
      setNameErr(applyServerErrors(e, nameForm.setError));
    }
  });
  const saveAvatar = async () => {
    if (!avatar) return;
    setBusy(true);
    try {
      qc.setQueryData(['me'], await api.upload<Me>('PUT', '/account/avatar', uploadForm(avatar)));
      setAvatar(null);
      toast('Foto atualizada.');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível enviar a foto.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="box stack">
      <h2 className="lbl">Dados da conta</h2>
      <div className="row">
        <Avatar name={me.user.name} photoUrl={me.user.avatarUrl} size={64} />
        <dl className="dl">
          <dt>E-mail</dt>
          <dd>
            {me.user.email} {me.user.emailVerified ? <span className="st ok">confirmado</span> : <span className="st pend">não confirmado</span>}
          </dd>
          <dt>Tipo de conta</dt>
          <dd>{me.user.accountType === 'ARTIST' ? 'Artista / banda' : me.user.accountType === 'CONTRACTOR' ? 'Proprietário / contratante' : 'Não definido'}</dd>
          <dt>Entrar com Google</dt>
          <dd>{me.user.googleLinked ? 'Vinculado' : 'Não vinculado'}</dd>
          <dt>Membro desde</dt>
          <dd>{date(me.user.createdAt)}</dd>
        </dl>
      </div>
      <ImagePicker label="Foto da conta" value={avatar} onChange={setAvatar} currentUrl={me.user.avatarUrl} />
      <div className="row">
        {avatar && (
          <button className="btn dark sm" type="button" onClick={saveAvatar} disabled={busy}>
            {busy ? 'Enviando…' : 'Salvar foto'}
          </button>
        )}
        {me.user.avatarUrl && !avatar && (
          <ConfirmButton
            className="btn sm ghost danger"
            confirm="A foto da conta será removida."
            confirmLabel="Remover foto"
            danger
            onConfirm={async () => qc.setQueryData(['me'], await api.delete<Me>('/account/avatar'))}
          >
            Remover foto
          </ConfirmButton>
        )}
      </div>
      <form className="form" onSubmit={saveName} noValidate>
        <FormError message={nameErr} />
        <TextField label="Nome" {...nameForm.register('name')} error={nameForm.formState.errors.name} />
        <div className="actions">
          <button className="btn dark" type="submit" disabled={nameForm.formState.isSubmitting}>
            Salvar nome
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordSection({ me }: { me: Me }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [pwErr, setPwErr] = useState<string | null>(null);
  const hasPassword = me.user.hasPassword;
  const pwForm = useForm<z.infer<ReturnType<typeof PasswordSchema>>>({ resolver: zodResolver(PasswordSchema(hasPassword)) });
  const newPassword = useWatch({ control: pwForm.control, name: 'newPassword' }) ?? '';
  const savePw = pwForm.handleSubmit(async (v) => {
    setPwErr(null);
    try {
      await api.post('/account/password', hasPassword ? v : { newPassword: v.newPassword, newPasswordConfirmation: v.newPasswordConfirmation });
      pwForm.reset({ currentPassword: '', newPassword: '', newPasswordConfirmation: '' });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast(hasPassword ? 'Senha alterada. Outras sessões foram encerradas.' : 'Senha definida.');
    } catch (e) {
      setPwErr(applyServerErrors(e, pwForm.setError));
    }
  });
  return (
    <section className="box">
      <h2 className="lbl">{hasPassword ? 'Alterar senha' : 'Definir senha'}</h2>
      {!hasPassword && <p className="hint">Sua conta usa o acesso pelo Google. Defina uma senha para também entrar com e-mail e confirmar operações críticas.</p>}
      <form className="form" onSubmit={savePw} noValidate>
        <FormError message={pwErr} />
        {hasPassword && (
          <PasswordField label="Senha atual" autoComplete="current-password" {...pwForm.register('currentPassword')} error={pwForm.formState.errors.currentPassword} />
        )}
        <div className="row2">
          <PasswordField
            label="Nova senha"
            autoComplete="new-password"
            showRules
            watchValue={newPassword}
            {...pwForm.register('newPassword')}
            error={pwForm.formState.errors.newPassword}
          />
          <PasswordField
            label="Confirmar nova senha"
            autoComplete="new-password"
            {...pwForm.register('newPasswordConfirmation')}
            error={pwForm.formState.errors.newPasswordConfirmation}
          />
        </div>
        <div className="actions">
          <button className="btn dark" type="submit" disabled={pwForm.formState.isSubmitting}>
            {hasPassword ? 'Alterar senha' : 'Definir senha'}
          </button>
        </div>
      </form>
    </section>
  );
}

function PrivacySection({ me }: { me: Me }) {
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    try {
      const data = await api.get<unknown>('/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ridersync-meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível gerar a cópia.', 'error');
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/account/delete', { password: me.user.hasPassword ? password : undefined, confirmation });
      qc.clear();
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('Sua conta foi excluída.');
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível excluir a conta.');
    } finally {
      setBusy(false);
    }
  };
  const ready = confirmation === 'EXCLUIR' && (!me.user.hasPassword || password.length > 0);

  return (
    <section className="box stack">
      <h2 className="lbl">Privacidade e seus dados (LGPD)</h2>
      <div className="row space">
        <div className="stack-sm">
          <strong>Baixar meus dados</strong>
          <span className="hint">Cópia dos dados da sua conta em formato JSON (acesso e portabilidade).</span>
        </div>
        <button type="button" className="btn sm" onClick={download}>
          Baixar cópia
        </button>
      </div>
      <div className="row space">
        <div className="stack-sm">
          <strong>Notificações por e-mail</strong>
          <span className="hint">Escolha o que chega por e-mail ou desative tudo.</span>
        </div>
        <Link className="btn sm" to="/painel/notificacoes/preferencias">
          Preferências
        </Link>
      </div>
      <div className="row space">
        <div className="stack-sm">
          <strong>Encerrar outras sessões</strong>
          <span className="hint">Sai da conta em todos os outros dispositivos.</span>
        </div>
        <ConfirmButton
          confirm="Todas as outras sessões abertas serão encerradas. Esta continua ativa."
          confirmLabel="Encerrar sessões"
          onConfirm={async () => {
            await api.post('/account/sessions/revoke-others');
            toast('Outras sessões encerradas.');
          }}
        >
          Encerrar
        </ConfirmButton>
      </div>
      <div className="row space danger-zone">
        <div className="stack-sm">
          <strong>Excluir minha conta</strong>
          <span className="hint">
            Remove seus dados pessoais. Perfis com negociações registradas são anonimizados para preservar o histórico da outra parte. Leia a{' '}
            <Link className="link" to="/privacidade">
              Política de Privacidade
            </Link>
            .
          </span>
        </div>
        <button type="button" className="btn sm danger" onClick={() => setOpen(true)}>
          Excluir conta
        </button>
      </div>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} title="Excluir conta">
        <div className="stack">
          <div className="inline-msg bad" role="note">
            Esta ação não pode ser desfeita. Suas sessões serão encerradas, seu perfil sairá do ar e negociações em andamento serão encerradas, com aviso à
            outra parte. Se você é o único proprietário de uma banda ou casa com outros integrantes, transfira a propriedade antes.
          </div>
          {me.user.hasPassword && <PasswordField label="Sua senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          <TextField label='Digite "EXCLUIR" para confirmar' value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
          <FormError message={error} />
          <div className="row dlg-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </button>
            {ready && (
              <CountdownButton busy={busy} onClick={remove}>
                Excluir definitivamente
              </CountdownButton>
            )}
          </div>
        </div>
      </Dialog>
    </section>
  );
}
