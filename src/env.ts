import { z } from "zod";

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  /** Tenant served when the Host header does not match any tenant domain (single-tenant deploys, localhost). */
  DEFAULT_TENANT_SLUG: z.string().min(1).default("piloto"),

  /** Postgres (Supabase pooler). When absent, an embedded PGlite database is used (dev/test only). */
  DATABASE_URL: optional,
  PGLITE_DIR: z.string().default(".data/pglite"),

  BETTER_AUTH_SECRET: z.string().min(32).optional(),

  /** Media storage: Supabase Storage in production, local disk otherwise. */
  SUPABASE_URL: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  SUPABASE_STORAGE_BUCKET: z.string().default("media"),
  /** Private bucket (no public access) for imported source PDFs; read with the service-role key. */
  SUPABASE_PRIVATE_BUCKET: z.string().default("private"),

  /** 32-byte key (base64) used to encrypt third-party OAuth tokens at rest. */
  ENCRYPTION_KEY: optional,

  ANTHROPIC_API_KEY: optional,
  CLAUDE_MODEL: z.string().default("claude-sonnet-5-5"),

  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,

  WHATSAPP_TOKEN: optional,
  WHATSAPP_PHONE_NUMBER_ID: optional,
  META_APP_SECRET: optional,
  META_VERIFY_TOKEN: optional,
  META_GRAPH_VERSION: z.string().default("v23.0"),
  META_PIXEL_ID: optional,
  META_CAPI_TOKEN: optional,
  META_PAGE_TOKEN: optional,

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  CRON_SECRET: optional,
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment variables: ${issues}`);
  }
  const env = parsed.data;
  if (env.SUPABASE_PRIVATE_BUCKET === env.SUPABASE_STORAGE_BUCKET) {
    throw new Error("Invalid environment variables: SUPABASE_PRIVATE_BUCKET must differ from the public SUPABASE_STORAGE_BUCKET");
  }
  if (env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    const missing = (["DATABASE_URL", "BETTER_AUTH_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY"] as const).filter(
      (k) => !env[k],
    );
    if (missing.length && process.env.ALLOW_LOCAL_INFRA !== "1") {
      throw new Error(`Missing required production variables: ${missing.join(", ")}`);
    }
  }
  return env;
}

export const env = load();

/** Which optional integrations have credentials. Used to show "not connected" honestly in the panel. */
export const integrations = {
  ai: Boolean(env.ANTHROPIC_API_KEY),
  email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  whatsapp: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
  metaWebhooks: Boolean(env.META_APP_SECRET && env.META_VERIFY_TOKEN),
  metaCapi: Boolean(env.META_PIXEL_ID && env.META_CAPI_TOKEN),
  metaMessaging: Boolean(env.META_PAGE_TOKEN && env.META_APP_SECRET),
  googleCalendar: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.ENCRYPTION_KEY),
  supabaseStorage: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
} as const;
