import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { env, integrations } from "@/env";
import { defaultDeps } from "@/modules/integrations/config";
import { sendEmail } from "@/modules/integrations/email";
import { resetPasswordEmail } from "@/modules/agents/emails";
import { getDb } from "./db/client";
import { appSecret } from "./secrets";
import { account, session, user, verification } from "./db/schema";

function sameOrigin(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const local = /^(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost)(:\d+)?$/i.test(host);
  return `${local && env.NODE_ENV !== "production" ? "http" : "https"}://${host.toLowerCase()}`;
}

async function build() {
  const db = await getDb();
  return betterAuth({
    appName: env.PORTAL_NAME,
    baseURL: env.APP_URL,
    secret: appSecret(),
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    emailAndPassword: {
      enabled: true,
      // Agents sign up through /panel/registro (src/modules/agents/registration.ts), which also
      // creates their workspace; the generic Better Auth sign-up endpoint stays closed.
      disableSignUp: true,
      minPasswordLength: 10,
      // Recovery by email works only once Resend is connected; /panel/recuperar says so otherwise.
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!integrations.email) throw new Error("Email no conectado");
        await sendEmail(defaultDeps(), resetPasswordEmail(user.email, url));
      },
    },
    // The panel is served on the portal and on every agent's domain: a request is trusted when its
    // Origin is the very host it was sent to (same-origin), never any other site.
    trustedOrigins: (request?: Request) => {
      const origin = request ? sameOrigin(request) : null;
      return origin ? [origin] : [];
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    rateLimit: {
      // Production only: e2e suites log in repeatedly from one IP against `next dev`.
      enabled: env.NODE_ENV === "production",
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 }, "/request-password-reset": { window: 60 * 15, max: 3 } },
    },
    advanced: { useSecureCookies: env.NODE_ENV === "production" },
    plugins: [nextCookies()],
  });
}

type Auth = Awaited<ReturnType<typeof build>>;
const g = globalThis as unknown as { __auth?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  g.__auth ??= build();
  return g.__auth;
}
