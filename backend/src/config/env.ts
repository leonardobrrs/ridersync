import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    COOKIE_SECURE: bool,
    SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24 * 90).default(168),
    STORAGE_DRIVER: z.enum(['local', 's3', 'vercel-blob']).default('local'),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool,
    THROTTLE_AUTH_LIMIT: z.coerce.number().int().positive().default(20),
    /** Origem pública da SPA, usada em links de e-mail e no redirect do OAuth (ex.: https://ridersync-front.vercel.app). */
    PUBLIC_APP_URL: z.url().default('http://localhost:5173'),
    /** Segredo para assinar links de descadastro e o estado do OAuth. Obrigatório em produção. */
    APP_SECRET: z.string().min(32).optional(),
    MAIL_DRIVER: z.enum(['brevo', 'resend', 'log', 'disabled']).optional(),
    BREVO_API_KEY: z.string().trim().optional(),
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().default('RiderSync <nao-responda@ridersync.app>'),
    /** Somente desenvolvimento/testes: grava os e-mails do driver "log" em arquivos JSON. */
    MAIL_DEV_OUTBOX_DIR: z.string().optional(),
    EMAIL_VERIFICATION_REQUIRED: bool,
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    CRON_SECRET: z.string().min(16).optional(),
    PRIVACY_CONTACT_EMAIL: z.string().default('privacidade@ridersync.app'),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
    /**
     * Painel de administração (/adm). Desativado (404) se faltar qualquer um dos dois. A senha nunca fica no código nem
     * no ambiente em texto puro: ADMIN_PASSWORD_HASH é um hash Argon2id (gere com `npm run admin:hash -w backend`).
     */
    ADMIN_USERNAME: z.string().trim().optional(),
    ADMIN_PASSWORD_HASH: z.string().trim().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_REGION'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} é obrigatória quando STORAGE_DRIVER=s3` });
      }
    }
    if (env.MAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'RESEND_API_KEY é obrigatória quando MAIL_DRIVER=resend' });
    }
    if (env.MAIL_DRIVER === 'brevo') {
      if (!env.BREVO_API_KEY) {
        ctx.addIssue({ code: 'custom', path: ['BREVO_API_KEY'], message: 'BREVO_API_KEY é obrigatória quando MAIL_DRIVER=brevo' });
      }
      if (!/^(.*<\S+@\S+>|\S+@\S+)$/.test(env.MAIL_FROM.trim())) {
        ctx.addIssue({ code: 'custom', path: ['MAIL_FROM'], message: 'MAIL_FROM deve ser "Nome <email>" com um remetente verificado na Brevo' });
      }
    }
    if (env.NODE_ENV === 'production' && env.MAIL_DRIVER === 'log') {
      ctx.addIssue({ code: 'custom', path: ['MAIL_DRIVER'], message: 'MAIL_DRIVER=log é exclusivo de desenvolvimento; use brevo, resend ou disabled' });
    }
    if (env.NODE_ENV === 'production' && !env.APP_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['APP_SECRET'], message: 'APP_SECRET é obrigatória em produção (mínimo 32 caracteres)' });
    }
    if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['GOOGLE_CLIENT_SECRET'], message: 'Informe GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET juntos' });
    }
  })
  // Na Vercel o Preview também roda com NODE_ENV=production: sem configuração explícita, e-mails ficam desativados
  // (registrados como SKIPPED) em vez de a API recusar a inicialização.
  .transform((env) => ({ ...env, MAIL_DRIVER: env.MAIL_DRIVER ?? (env.NODE_ENV === 'production' ? 'disabled' : 'log') }));

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Valida as variáveis de ambiente uma única vez; falha cedo com mensagem clara. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  // Variável definida com valor vazio (ex.: copiada do .env.example) equivale a não definida.
  const parsed = EnvSchema.safeParse(Object.fromEntries(Object.entries(source).filter(([, v]) => v !== '')));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${lines}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

/** Em desenvolvimento/testes sem APP_SECRET, usa um segredo efêmero por processo (links deixam de valer ao reiniciar). */
let devSecret: string | undefined;
export function appSecret(env: Env): string {
  if (env.APP_SECRET) return env.APP_SECRET;
  devSecret ??= randomBytes(32).toString('hex');
  return devSecret;
}

export const googleEnabled = (env: Env) => !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const escapeRegex = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/**
 * Verificador de origens permitidas (CORS e CSRF). Entradas exatas ou com curinga `*`, que casa
 * somente caracteres de UM rótulo DNS (`[a-z0-9-]+`, sem ponto) — ex.:
 * `https://ridersync-front-*-projetao2.vercel.app` aceita as URLs de Preview do projeto, mas não
 * `https://evil.com/x.vercel.app` nem subdomínios adicionais.
 */
export function originMatcher(patterns: string[]): (origin: string) => boolean {
  const exact = new Set(patterns.filter((p) => !p.includes('*')));
  const wildcards = patterns
    .filter((p) => p.includes('*'))
    .map((p) => new RegExp(`^${p.split('*').map(escapeRegex).join('[a-z0-9-]+')}$`));
  return (origin: string) => exact.has(origin) || wildcards.some((re) => re.test(origin));
}
