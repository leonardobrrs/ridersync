import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { applyServerErrors, FormError, TextField } from '../../components/Fields';
import { PageHead } from '../../components/Layout';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { date } from '../../lib/format';
import { useMe } from '../../lib/hooks';
import type { Me } from '../../lib/types';

const NameSchema = z.object({ name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120) });
const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres.').max(128),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'As senhas não conferem.' });

export function AccountPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const nameForm = useForm<z.infer<typeof NameSchema>>({ resolver: zodResolver(NameSchema), values: { name: me?.user.name ?? '' } });
  const pwForm = useForm<z.infer<typeof PasswordSchema>>({ resolver: zodResolver(PasswordSchema) });
  if (!me) return null;

  const saveName = nameForm.handleSubmit(async (v) => {
    setNameErr(null);
    try {
      qc.setQueryData(['me'], await api.patch<Me>('/account', v));
      toast('Nome atualizado.');
    } catch (e) {
      setNameErr(applyServerErrors(e, nameForm.setError));
    }
  });
  const savePw = pwForm.handleSubmit(async ({ currentPassword, newPassword }) => {
    setPwErr(null);
    try {
      await api.post('/account/password', { currentPassword, newPassword });
      pwForm.reset({ currentPassword: '', newPassword: '', confirm: '' });
      toast('Senha alterada. Outras sessões foram encerradas.');
    } catch (e) {
      setPwErr(applyServerErrors(e, pwForm.setError));
    }
  });

  return (
    <>
      <PageHead title="Conta" subtitle="Dados privados da sua conta — não aparecem em perfis públicos." />
      <section className="box">
        <h2 className="lbl">Dados de acesso</h2>
        <dl className="dl">
          <dt>E-mail</dt>
          <dd>{me.user.email}</dd>
          <dt>Membro desde</dt>
          <dd>{date(me.user.createdAt)}</dd>
        </dl>
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
      <section className="box">
        <h2 className="lbl">Alterar senha</h2>
        <form className="form" onSubmit={savePw} noValidate>
          <FormError message={pwErr} />
          <TextField label="Senha atual" type="password" autoComplete="current-password" {...pwForm.register('currentPassword')} error={pwForm.formState.errors.currentPassword} />
          <div className="row2">
            <TextField label="Nova senha" type="password" autoComplete="new-password" {...pwForm.register('newPassword')} error={pwForm.formState.errors.newPassword} />
            <TextField label="Confirmar nova senha" type="password" autoComplete="new-password" {...pwForm.register('confirm')} error={pwForm.formState.errors.confirm} />
          </div>
          <div className="actions">
            <button className="btn dark" type="submit" disabled={pwForm.formState.isSubmitting}>
              Alterar senha
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
