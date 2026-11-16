/**
 * Activates a plan for an agent's workspace until online payments are connected.
 *   npm run plan:set -- <workspace-slug> <free|agente|pro|inmobiliaria> [months]
 * Months default to 1 for paid plans; "free" clears the expiry.
 */
import { PLAN_IDS, type PlanId } from "../src/modules/billing/plans";
import { setPlan } from "../src/modules/billing/service";
import { createDb } from "../src/server/db/create";

const [slug, plan, monthsArg] = process.argv.slice(2);
if (!slug || !plan || !(PLAN_IDS as readonly string[]).includes(plan)) {
  console.error(`Uso: npm run plan:set -- <slug> <${PLAN_IDS.join("|")}> [meses]`);
  process.exit(1);
}
const db = await createDb({ migrate: true });
(globalThis as unknown as { __db?: Promise<typeof db> }).__db = Promise.resolve(db);
const months = monthsArg ? Number(monthsArg) : 1;
const r = await setPlan(slug, plan as PlanId, plan === "free" ? null : months);
console.log(JSON.stringify({ level: "info", msg: "plan set", slug, plan, expiresAt: r.expiresAt?.toISOString() ?? null }));
process.exit(0);
