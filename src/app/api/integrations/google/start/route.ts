import { randomToken } from "@/lib/crypto";
import { getMember } from "@/server/session";
import { channelReady, configFromEnv } from "@/modules/integrations/config";
import { authorizationUrl, createOAuthState } from "@/modules/integrations/google";
import { GOOGLE_NONCE_COOKIE, googleRedirectUri } from "../shared";

/** Starts Google Calendar OAuth for the signed-in agent. The state is signed and bound to a browser cookie. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const member = await getMember();
  if (!member) return Response.redirect(`${origin}/panel/ingresar`, 303);
  const config = configFromEnv();
  if (!channelReady.google(config)) return Response.redirect(`${origin}/panel/integraciones?google=no_configurado`, 303);
  if (!member.agentId) return Response.redirect(`${origin}/panel/integraciones?google=sin_perfil`, 303);

  const nonce = randomToken(16);
  const state = createOAuthState({ tenantId: member.tenantId, userId: member.userId, agentId: member.agentId, nonce });
  const secure = origin.startsWith("https:") ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      location: authorizationUrl(config.googleClientId!, googleRedirectUri(req), state),
      "set-cookie": `${GOOGLE_NONCE_COOKIE}=${nonce}; Path=/api/integrations/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
      "cache-control": "no-store",
    },
  });
}
