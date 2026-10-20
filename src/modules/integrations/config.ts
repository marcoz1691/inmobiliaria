import { env } from "@/env";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Credentials and settings the adapters need. Built from `env`; tests inject their own. */
export type IntegrationConfig = {
  appUrl: string;
  /** NODE_ENV === "production". Webhook routing is strict there (see `resolveTenant`). */
  production?: boolean;
  resendApiKey?: string;
  emailFrom?: string;
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
  metaGraphVersion: string;
  metaPixelId?: string;
  metaCapiToken?: string;
  metaPageToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  /** Whether ENCRYPTION_KEY is configured (src/lib/crypto.ts reads it directly). */
  encryption: boolean;
};

/** Every external call goes through `fetch` so tests can replace it; nothing real runs in tests. */
export type IntegrationDeps = { fetch: FetchLike; config: IntegrationConfig; now: () => Date };

export function configFromEnv(): IntegrationConfig {
  return {
    appUrl: env.APP_URL,
    production: env.NODE_ENV === "production",
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.EMAIL_FROM,
    whatsappToken: env.WHATSAPP_TOKEN,
    whatsappPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    metaGraphVersion: env.META_GRAPH_VERSION,
    metaPixelId: env.META_PIXEL_ID,
    metaCapiToken: env.META_CAPI_TOKEN,
    metaPageToken: env.META_PAGE_TOKEN,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    encryption: Boolean(process.env.ENCRYPTION_KEY),
  };
}

export function defaultDeps(over: Partial<IntegrationDeps> = {}): IntegrationDeps {
  return { fetch: (input, init) => fetch(input, init), config: configFromEnv(), now: () => new Date(), ...over };
}

export const channelReady = {
  email: (c: IntegrationConfig) => Boolean(c.resendApiKey && c.emailFrom),
  whatsapp: (c: IntegrationConfig) => Boolean(c.whatsappToken && c.whatsappPhoneNumberId),
  capi: (c: IntegrationConfig) => Boolean(c.metaPixelId && c.metaCapiToken),
  pageMessaging: (c: IntegrationConfig) => Boolean(c.metaPageToken),
  google: (c: IntegrationConfig) => Boolean(c.googleClientId && c.googleClientSecret && c.encryption),
};

/** Honest reasons shown on blocked jobs. Never include credential values. */
export const blockedReason = {
  email: (c: IntegrationConfig) =>
    `Email no conectado: falta ${[!c.resendApiKey && "RESEND_API_KEY", !c.emailFrom && "EMAIL_FROM"].filter(Boolean).join(" y ")}`,
  whatsapp: (c: IntegrationConfig) =>
    `WhatsApp no conectado: falta ${[!c.whatsappToken && "WHATSAPP_TOKEN", !c.whatsappPhoneNumberId && "WHATSAPP_PHONE_NUMBER_ID"].filter(Boolean).join(" y ")}`,
  capi: (c: IntegrationConfig) =>
    `Conversions API no conectada: falta ${[!c.metaPixelId && "META_PIXEL_ID", !c.metaCapiToken && "META_CAPI_TOKEN"].filter(Boolean).join(" y ")}`,
};
