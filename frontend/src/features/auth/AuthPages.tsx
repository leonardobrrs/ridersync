import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Dialog } from '../../components/Dialog';
import { applyServerErrors, FormError, TextField } from '../../components/Fields';
import { Icon } from '../../components/Icon';
import { PasswordField } from '../../components/PasswordField';
import { Poster } from '../../components/Poster';
import { Loading } from '../../components/States';
import { useToast } from '../../components/Toast';
import { api, ApiError } from '../../lib/api';
import { useMe } from '../../lib/hooks';
import { matchesWhenBothFilled, strongPassword } from '../../lib/password';
import type { AccountType, AuthConfig, Me } from '../../lib/types';

const LoginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

const RegisterSchema = z
  .object({
    accountType: z.enum(['ARTIST', 'CONTRACTOR'], { error: 'Escolha se você é artista ou contratante.' }),
    name: z.string().trim().min(2, 'Informe seu nome (mínimo 2 caracteres).').max(120),
    email: z.email('Informe um e-mail válido.'),
    password: strongPassword,
    passwordConfirmation: z.string().min(1, 'Confirme a senha.'),
    acceptTerms: z.literal(true, { error: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' }),
  })
  .refine((v) => v.password === v.passwordConfirmation, matchesWhenBothFilled('password', 'passwordConfirmation'));

const ResetSchema = z
  .object({ password: strongPassword, passwordConfirmation: z.string().min(1, 'Confirme a senha.') })
  .refine((v) => v.password === v.passwordConfirmation, matchesWhenBothFilled('password', 'passwordConfirmation'));

export function safeNext(next: string | null) {
  return next && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : '/painel';
}

export function useAuthConfig() {
  return useQuery({ queryKey: ['auth-config'], queryFn: () => api.get<AuthConfig>('/auth/config'), staleTime: Infinity });
}

function AuthArt() {
  return (
    <div className="auth-art">
      <p className="bigtitle">
        Do rider ao <em>palco</em>.
      </p>
      <p style={{ color: 'var(--case-muted)', maxWidth: '42ch' }}>
        Perfis profissionais, riders técnicos, oportunidades de apresentação e negociações entre artistas e contratantes de Alagoas.
      </p>
      <div className="auth-posters">
        <Poster name="Forró" top={['Maceió', 'Sex']} bottom={['Voz', 'Sanfona']} />
        <Poster name="MPB ao vivo" top={['Penedo', 'Sáb']} bottom={['Duo', '21h']} />
        <Poster name="Coco de roda" top={['Arapiraca', 'Dom']} bottom={['Trio', '19h']} />
      </div>
    </div>
  );
}

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/**
 * "Continuar com Google" — visível desde o primeiro render, sem depender de escolha de perfil.
 * Enquanto a configuração carrega o link já funciona (o backend redireciona com aviso se o Google
 * estiver desligado). Só fica indisponível quando o servidor informa que o Google não está configurado.
 */
function GoogleButton({ href, label = 'Continuar com Google' }: { href: string; label?: string }) {
  const cfg = useAuthConfig();
  if (cfg.data && !cfg.data.googleLogin) {
    return (
      <div className="stack-sm">
        <button type="button" className="btn block google" disabled aria-describedby="google-off">
          {GOOGLE_ICON}
          {label}
        </button>
        <span className="hint" id="google-off">
          O acesso com Google não está disponível neste ambiente. Use e-mail e senha.
        </span>
      </div>
    );
  }
  return (
    <div className="stack-sm">
      <a className="btn block google" href={href} aria-busy={cfg.isLoading || undefined}>
        {GOOGLE_ICON}
        {label}
      </a>
      {cfg.isError && <span className="hint">Não foi possível verificar o acesso com Google agora; você ainda pode tentar.</span>}
    </div>
  );
}

const googleHref = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  return `/api/auth/google/start?${q.toString()}`;
};

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'Não foi possível entrar com o Google. Tente novamente ou use e-mail e senha.',
  'google-indisponivel': 'O acesso com Google não está disponível neste ambiente. Use e-mail e senha.',
};

function useSessionDone() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return async (me: Me, to?: string) => {
    qc.setQueryData(['me'], me);
    await qc.invalidateQueries();
    navigate(to ?? safeNext(params.get('next')), { replace: true });
  };
}

export function LoginPage() {
  const { data: me } = useMe();
  const done = useSessionDone();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(GOOGLE_ERRORS[params.get('erro') ?? ''] ?? null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const form = useForm<z.infer<typeof LoginSchema>>({ resolver: zodResolver(LoginSchema) });
  if (me) return <Navigate to={safeNext(params.get('next'))} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setUnverified(null);
    try {
      done(await api.post<Me>('/auth/login', values));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') setUnverified(values.email);
      setFormError(applyServerErrors(e, form.setError));
    }
  });
  const next = params.get('next');

  return (
    <div className="auth">
      <AuthArt />
      <div className="auth-f">
        <form className="auth-c" onSubmit={onSubmit} noValidate>
          <h1>Entrar</h1>
          <FormError message={formError} />
          {unverified && (
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                await api.post('/auth/email-verification/request', { email: unverified }).catch(() => undefined);
                setFormError('Se a conta existir, enviamos um novo link de confirmação.');
                setUnverified(null);
              }}
            >
              Reenviar link de confirmação
            </button>
          )}
          <TextField label="E-mail" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email} />
          <PasswordField label="Senha" autoComplete="current-password" {...form.register('password')} error={form.formState.errors.password} />
          <Link className="link small" to="/esqueci-senha">
            Esqueci minha senha
          </Link>
          <button className="btn cue block" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
          <div className="or">
            <span>ou</span>
          </div>
          <GoogleButton href={googleHref({ intent: 'login', next: next ? safeNext(next) : undefined })} label="Entrar com Google" />
          <p className="muted">
            Ainda não tem conta?{' '}
            <Link className="link" to={`/cadastro${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const ACCOUNT_KIND: Record<AccountType, { title: string; text: string; icon: string; modalTitle: string; nameHint: string; next: string }> = {
  ARTIST: {
    title: 'Sou artista',
    text: 'Músico, cantor ou integrante de banda: perfil profissional, portfólio, rider técnico, candidaturas e propostas.',
    icon: 'mic',
    modalTitle: 'Criar conta de artista',
    nameHint: 'Seu nome pessoal. O nome artístico e a foto você define depois, no seu perfil.',
    next: '/painel/perfil',
  },
  CONTRACTOR: {
    title: 'Sou contratante',
    text: 'Casa de show, bar, teatro, produtora ou pessoa que contrata música para um evento.',
    icon: 'venue',
    modalTitle: 'Criar conta de contratante',
    nameHint: 'Seu nome pessoal. O nome e a foto da casa ou organização você define depois.',
    next: '/painel',
  },
};

export function RegisterPage() {
  const { data: me } = useMe();
  const done = useSessionDone();
  const toast = useToast();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(
    params.get('google') === 'sem-conta' ? 'Não encontramos uma conta para este Google. Escolha como vai usar o RiderSync ou continue com o Google para criar a conta.' : null,
  );
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof RegisterSchema>>({ resolver: zodResolver(RegisterSchema), defaultValues: { acceptTerms: undefined } });
  const accountType = useWatch({ control: form.control, name: 'accountType' }) as AccountType | undefined;
  const acceptTerms = useWatch({ control: form.control, name: 'acceptTerms' });
  const password = useWatch({ control: form.control, name: 'password' }) ?? '';
  if (me && !pendingVerification) return <Navigate to="/painel" replace />;

  if (pendingVerification) {
    return (
      <div className="wrap page narrow">
        <div className="box stack" role="status">
          <h1>Confirme seu e-mail</h1>
          <p>
            Enviamos um link de confirmação para <strong>{pendingVerification}</strong>. Abra o e-mail e clique no link para ativar a conta; depois,
            entre normalmente.
          </p>
          <Link className="btn cue" to="/entrar">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  /** Escolher (ou trocar) o tipo de conta. Os campos já digitados são preservados. */
  const choose = (type: AccountType) => {
    form.setValue('accountType', type, { shouldValidate: form.formState.isSubmitted });
    setFormError(null);
    setOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await api.post<{ verificationRequired: boolean; session: Me | null }>('/auth/register', values);
      if (!res.session) {
        setOpen(false);
        setPendingVerification(values.email);
        return;
      }
      toast('Conta criada! Enviamos um link para confirmar seu e-mail.');
      done(res.session, ACCOUNT_KIND[values.accountType].next);
    } catch (e) {
      setFormError(applyServerErrors(e, form.setError));
    }
  });

  const kind = accountType ? ACCOUNT_KIND[accountType] : null;
  const other: AccountType = accountType === 'ARTIST' ? 'CONTRACTOR' : 'ARTIST';

  return (
    <div className="auth">
      <AuthArt />
      <div className="auth-f">
        <div className="auth-c wide">
          <div className="stack-sm">
            <h1>Criar conta</h1>
            <p className="muted">Como você vai usar o RiderSync?</p>
          </div>
          {!open && <FormError message={formError} />}
          <div className="signup-kinds" role="group" aria-label="Tipo de conta">
            {(Object.keys(ACCOUNT_KIND) as AccountType[]).map((t) => (
              <button key={t} type="button" className="signup-kind" onClick={() => choose(t)} aria-haspopup="dialog">
                <span className="signup-kind-ico" aria-hidden="true">
                  <Icon name={ACCOUNT_KIND[t].icon} size={28} />
                </span>
                <strong>{ACCOUNT_KIND[t].title}</strong>
                <span>{ACCOUNT_KIND[t].text}</span>
              </button>
            ))}
          </div>
          <div className="or">
            <span>ou</span>
          </div>
          <GoogleButton href={googleHref({ intent: 'signup' })} />
          <p className="hint">Com o Google, você escolhe o tipo de conta e aceita os termos logo no primeiro acesso.</p>
          <p className="muted">
            Já tem conta?{' '}
            <Link className="link" to="/entrar">
              Entrar
            </Link>
          </p>
        </div>
      </div>

      <Dialog open={open && !!kind} onClose={() => setOpen(false)} title={kind?.modalTitle ?? 'Criar conta'}>
        {kind && (
          <form className="form" onSubmit={onSubmit} noValidate aria-label={kind.modalTitle}>
            <p className="hint">{kind.text}</p>
            <FormError message={formError} />
            <TextField label="Nome" autoComplete="name" hint={kind.nameHint} {...form.register('name')} error={form.formState.errors.name} />
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              hint="Usado para entrar, confirmar a conta e receber notificações. Não aparece no seu perfil público."
              {...form.register('email')}
              error={form.formState.errors.email}
            />
            <PasswordField label="Senha" autoComplete="new-password" showRules watchValue={password} {...form.register('password')} error={form.formState.errors.password} />
            <PasswordField
              label="Confirme a senha"
              autoComplete="new-password"
              {...form.register('passwordConfirmation')}
              error={form.formState.errors.passwordConfirmation}
            />
            <label className="check">
              <input type="checkbox" {...form.register('acceptTerms')} />
              <span>
                Li e aceito os{' '}
                <Link className="link" to="/termos" target="_blank">
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link className="link" to="/privacidade" target="_blank">
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
            {form.formState.errors.acceptTerms && <span className="err">{form.formState.errors.acceptTerms.message}</span>}
            <button className="btn cue block" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Criando…' : 'Criar conta'}
            </button>
            <div className="or">
              <span>ou</span>
            </div>
            <GoogleButton href={googleHref({ intent: 'signup', accountType, acceptTerms: acceptTerms ? '1' : undefined })} />
            <div className="row between">
              <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
                <Icon name="arrowLeft" size={16} /> Voltar
              </button>
              <button type="button" className="link" onClick={() => choose(other)}>
                {other === 'ARTIST' ? 'Sou artista' : 'Sou contratante'} — trocar
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.email('Informe um e-mail válido.') })) });
  const [error, setError] = useState<string | null>(null);
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post('/auth/password/forgot', v);
      setSent(true);
    } catch (e) {
      setError(applyServerErrors(e, form.setError));
    }
  });
  return (
    <div className="wrap page narrow">
      <form className="box stack" onSubmit={onSubmit} noValidate>
        <h1>Recuperar senha</h1>
        {sent ? (
          <p role="status">Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. O link vale por 1 hora.</p>
        ) : (
          <>
            <p className="muted">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
            <FormError message={error} />
            <TextField label="E-mail" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email} />
            <button className="btn cue" type="submit" disabled={form.formState.isSubmitting}>
              Enviar link
            </button>
          </>
        )}
        <Link className="link" to="/entrar">
          Voltar para o login
        </Link>
      </form>
    </div>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(token ? null : 'Link inválido. Peça um novo link de redefinição.');
  const form = useForm<z.infer<typeof ResetSchema>>({ resolver: zodResolver(ResetSchema) });
  const password = useWatch({ control: form.control, name: 'password' }) ?? '';
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post('/auth/password/reset', { token, ...v });
      toast('Senha alterada. Entre com a nova senha.');
      navigate('/entrar', { replace: true });
    } catch (e) {
      setError(applyServerErrors(e, form.setError));
    }
  });
  return (
    <div className="wrap page narrow">
      <form className="box stack" onSubmit={onSubmit} noValidate>
        <h1>Criar nova senha</h1>
        <FormError message={error} />
        <PasswordField label="Nova senha" autoComplete="new-password" showRules watchValue={password} {...form.register('password')} error={form.formState.errors.password} />
        <PasswordField label="Confirme a nova senha" autoComplete="new-password" {...form.register('passwordConfirmation')} error={form.formState.errors.passwordConfirmation} />
        <button className="btn cue" type="submit" disabled={!token || form.formState.isSubmitting}>
          Salvar nova senha
        </button>
        <Link className="link" to="/esqueci-senha">
          Pedir um novo link
        </Link>
      </form>
    </div>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const qc = useQueryClient();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState('Link de confirmação inválido.');
  const started = useRef(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .post('/auth/email-verification/confirm', { token })
      .then(async () => {
        setState('ok');
        await qc.invalidateQueries({ queryKey: ['me'] });
      })
      .catch((e) => {
        setMessage(e instanceof ApiError ? e.message : 'Não foi possível confirmar o e-mail.');
        setState('error');
      });
  }, [token, qc]);
  if (state === 'loading') return <Loading label="Confirmando seu e-mail…" />;
  return (
    <div className="wrap page narrow">
      <div className="box stack" role="status">
        <h1>{state === 'ok' ? 'E-mail confirmado' : 'Não foi possível confirmar'}</h1>
        <p>{state === 'ok' ? 'Pronto! Sua conta está ativa.' : message}</p>
        <Link className="btn cue" to="/painel">
          Ir para o painel
        </Link>
      </div>
    </div>
  );
}

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle');
  const u = params.get('u') ?? '';
  const t = params.get('t') ?? '';
  return (
    <div className="wrap page narrow">
      <div className="box stack">
        <h1>Notificações por e-mail</h1>
        {state === 'ok' ? (
          <p role="status">Pronto: você não receberá mais e-mails de notificação. Avisos de segurança da conta continuam sendo enviados.</p>
        ) : (
          <>
            <p>Deseja parar de receber e-mails de notificação do RiderSync? As notificações continuarão disponíveis no sino do sistema.</p>
            {state === 'error' && <FormError message="Link inválido ou expirado. Ajuste suas preferências pelo painel." />}
            <button
              type="button"
              className="btn cue"
              disabled={!u || !t}
              onClick={() =>
                api
                  .post('/notifications/unsubscribe', { u, t })
                  .then(() => setState('ok'))
                  .catch(() => setState('error'))
              }
            >
              Desativar e-mails de notificação
            </button>
          </>
        )}
        <Link className="link" to="/painel/notificacoes/preferencias">
          Gerenciar preferências no painel
        </Link>
      </div>
    </div>
  );
}
