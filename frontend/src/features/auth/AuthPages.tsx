import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { applyServerErrors, FormError, TextField } from '../../components/Fields';
import { Poster } from '../../components/Poster';
import { api } from '../../lib/api';
import { useMe } from '../../lib/hooks';
import type { Me } from '../../lib/types';

const LoginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});
const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome (mínimo 2 caracteres).').max(120),
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(128),
});

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/painel';
}

function AuthArt() {
  return (
    <div className="auth-art">
      <p className="bigtitle">
        Do rider ao <em>palco</em>.
      </p>
      <p style={{ color: 'var(--case-muted)', maxWidth: '42ch' }}>
        Perfis profissionais, riders técnicos, oportunidades de apresentação e negociações entre artistas e casas de show de Alagoas.
      </p>
      <div className="auth-posters">
        <Poster name="Forró" top={['Maceió', 'Sex']} bottom={['Voz', 'Sanfona']} />
        <Poster name="MPB ao vivo" top={['Penedo', 'Sáb']} bottom={['Duo', '21h']} />
        <Poster name="Coco de roda" top={['Arapiraca', 'Dom']} bottom={['Trio', '19h']} />
      </div>
    </div>
  );
}

function useSessionDone() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return async (me: Me) => {
    qc.setQueryData(['me'], me);
    await qc.invalidateQueries();
    navigate(safeNext(params.get('next')), { replace: true });
  };
}

export function LoginPage() {
  const { data: me } = useMe();
  const done = useSessionDone();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof LoginSchema>>({ resolver: zodResolver(LoginSchema) });
  if (me) return <Navigate to={safeNext(params.get('next'))} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      done(await api.post<Me>('/auth/login', values));
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });

  return (
    <div className="auth">
      <AuthArt />
      <div className="auth-f">
        <form className="auth-c" onSubmit={onSubmit} noValidate>
          <h1>Entrar</h1>
          <FormError message={formError} />
          <TextField label="E-mail" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email} />
          <TextField
            label="Senha"
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
            error={form.formState.errors.password}
          />
          <button className="btn cue block" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="muted">
            Ainda não tem conta?{' '}
            <Link className="link" to={`/cadastro${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`}>
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { data: me } = useMe();
  const done = useSessionDone();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof RegisterSchema>>({ resolver: zodResolver(RegisterSchema) });
  if (me) return <Navigate to="/painel" replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      done(await api.post<Me>('/auth/register', values));
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });

  return (
    <div className="auth">
      <AuthArt />
      <div className="auth-f">
        <form className="auth-c" onSubmit={onSubmit} noValidate>
          <h1>Criar conta</h1>
          <p className="muted">
            Uma conta serve para tudo: seu perfil de músico, suas bandas e as casas de show que você administra.
          </p>
          <FormError message={formError} />
          <TextField label="Nome" autoComplete="name" {...form.register('name')} error={form.formState.errors.name} />
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            hint="Usado para entrar e para receber convites de bandas e casas. Não aparece no seu perfil público."
            {...form.register('email')}
            error={form.formState.errors.email}
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="new-password"
            hint="Mínimo de 8 caracteres."
            {...form.register('password')}
            error={form.formState.errors.password}
          />
          <button className="btn cue block" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Criando…' : 'Criar conta'}
          </button>
          <p className="muted">
            Já tem conta?{' '}
            <Link className="link" to="/entrar">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
