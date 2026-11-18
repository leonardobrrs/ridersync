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
    // Login com Google (opcional): as três juntas ou nenhuma.
    GOOGLE_CLIENT_ID: z.string().trim().optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
    GOOGLE_REDIRECT_URI: z.string().trim().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_REGION'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} é obrigatória quando STORAGE_DRIVER=s3` });
      }
    }
    const google = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const;
    const present = google.filter((k) => env[k]);
    if (present.length > 0 && present.length < google.length) {
      for (const k of google.filter((k) => !env[k])) {
        ctx.addIssue({ code: 'custom', path: [k], message: `${k} é obrigatória quando o login com Google está configurado` });
      }
    }
    if (env.GOOGLE_REDIRECT_URI) {
      try {
        const u = new URL(env.GOOGLE_REDIRECT_URI);
        const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        if (u.pathname !== '/api/auth/google/callback' || (u.protocol !== 'https:' && !local) || u.search || u.hash) throw new Error();
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_REDIRECT_URI'],
          message: 'GOOGLE_REDIRECT_URI deve ser https://<domínio-do-front>/api/auth/google/callback (http só em localhost)',
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Valida as variáveis de ambiente uma única vez; falha cedo com mensagem clara. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${lines}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

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
