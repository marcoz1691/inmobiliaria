import { errorInfo, log } from "@/lib/logger";
import { getDb } from "@/server/db/client";
import { withTenant } from "@/server/db/tenant-tx";
import { getMember } from "@/server/session";
import { audit } from "@/modules/audit/audit";
import { defaultDeps } from "@/modules/integrations/config";
import { exchangeCode, readOAuthState, saveConnection } from "@/modules/integrations/google";
import { GOOGLE_NONCE_COOKIE, googleRedirectUri, readCookie } from "../shared";

const clearNonce = `${GOOGLE_NONCE_COOKIE}=; Path=/api/integrations/google; HttpOnly; SameSite=Lax; Max-Age=0`;

function back(origin: string, result: string): Response {
  return new Response(null, { status: 303, headers: { location: `${origin}/panel/integraciones?google=${result}`, "set-cookie": clearNonce, "cache-control": "no-store" } });
}

/**
 * OAuth callback. Rejects a state that is unsigned, expired, not bound to this browser's nonce, or
 * minted for a different member than the one signed in. Tokens are stored encrypted.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const state = readOAuthState(url.searchParams.get("state"), readCookie(req, GOOGLE_NONCE_COOKIE));
  if (!state) return back(origin, "estado_invalido");
  const member = await getMember();
  if (!member || member.tenantId !== state.tenantId || member.userId !== state.userId || member.agentId !== state.agentId) {
    return back(origin, "estado_invalido");
  }
  if (url.searchParams.get("error")) return back(origin, "cancelado");
  const code = url.searchParams.get("code");
  if (!code || code.length > 2000) return back(origin, "error");

  try {
    const deps = defaultDeps();
    const tokens = await exchangeCode(deps, code, googleRedirectUri(req));
    const db = await getDb();
    await saveConnection(db, { tenantId: state.tenantId, agentId: state.agentId, tokens, now: deps.now() });
    await withTenant(db, state.tenantId, (tx) =>
      audit(tx, { tenantId: state.tenantId, actorUserId: state.userId, action: "integration.google.connect", entityType: "agent", entityId: state.agentId }),
    );
  } catch (err) {
    log.error("google oauth callback failed", errorInfo(err));
    return back(origin, "error");
  }
  return back(origin, "conectado");
}
