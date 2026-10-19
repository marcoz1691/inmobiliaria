import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/env";
import { getDb } from "./db/client";
import { account, session, user, verification } from "./db/schema";

async function build() {
  const db = await getDb();
  return betterAuth({
    appName: "Inmobiliaria",
    baseURL: env.APP_URL,
    // Dev/test fallback only; env.ts refuses to boot production without BETTER_AUTH_SECRET.
    secret: env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me-dev-only-secret",
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    emailAndPassword: {
      enabled: true,
      // Accounts are provisioned by an owner (scripts/seed.ts or the team screen), never self-service.
      disableSignUp: true,
      minPasswordLength: 10,
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
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
