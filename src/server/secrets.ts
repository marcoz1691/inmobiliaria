import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { env } from "@/env";

let cached: string | undefined;

/**
 * Secret for sessions and HMAC signatures. Production requires BETTER_AUTH_SECRET (enforced in
 * src/env.ts); dev/test generate a random one stored in .data/ (gitignored), never in source.
 */
export function appSecret(): string {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_INFRA !== "1") throw new Error("BETTER_AUTH_SECRET is required in production");
  if (cached) return cached;
  const file = path.join(process.cwd(), ".data", "dev-secret");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, randomBytes(32).toString("base64url"), { mode: 0o600 });
  }
  cached = readFileSync(file, "utf8").trim();
  return cached;
}
