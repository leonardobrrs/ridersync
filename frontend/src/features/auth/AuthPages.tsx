import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { applyServerErrors, FormError, TextField } from '../../components/Fields';
import { Poster } from '../../components/Poster';
import { API_BASE, api } from '../../lib/api';
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

const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelado: 'Login com Google cancelado.',
  google_email_nao_verificado: 'Seu e-mail do Google não está verificado. Verifique-o no Google e tente de novo.',
  google_sessao_expirada: 'A tentativa de login com Google expirou. Tente novamente.',
  google_indisponivel: 'O login com Google não está disponível no momento.',
};

/** Botão "Continuar com Google": navegação de página inteira para a API (mesma origem via /api). */
function GoogleLogin({ next }: { next: string | null }) {
  const { data } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => api.get<{ google: boolean }>('/auth/providers'),
    staleTime: Infinity,
  });
  if (!data?.google) return null;
  const href = `${API_BASE}/auth/google?next=${encodeURIComponent(safeNext(next))}`;
  return (
    <>
      <div className="or">ou</div>
      <a className="btn block" href={href}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Continuar com Google
      </a>
    </>
  );
}

export function LoginPage() {
  const { data: me } = useMe();
  const done = useSessionDone();
  const [params] = useSearchParams();
  const googleError = params.get('erro')?.startsWith('google_')
    ? (GOOGLE_ERRORS[params.get('erro')!] ?? 'Não foi possível entrar com Google. Tente novamente.')
    : null;
  const [formError, setFormError] = useState<string | null>(googleError);
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
          <GoogleLogin next={params.get('next')} />
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
          <GoogleLogin next={null} />
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
