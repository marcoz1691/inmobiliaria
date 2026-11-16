import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { account, agentProfiles, memberships, tenants, user } from "@/server/db/schema";
import { registerAgent, registrationSchema } from "./registration";

describe("agent sign-up", () => {
  let db: Db;
  beforeAll(async () => {
    db = await useTestDb();
  });

  const input = (over: Record<string, unknown> = {}) =>
    registrationSchema.parse({ name: "María Pérez", email: "Maria@Correo.ec", password: "una-clave-larga", whatsapp: "+593 99 123 4567", city: "ruminahui", ...over });

  it("creates the login, an owned workspace and a public profile", async () => {
    const r = await registerAgent(input());
    expect(r.tenantSlug).toBe("maria-perez");
    const [u] = await db.select().from(user).where(eq(user.id, r.userId));
    expect(u?.email).toBe("maria@correo.ec");
    const [acc] = await db.select().from(account).where(eq(account.userId, r.userId));
    expect(acc?.providerId).toBe("credential");
    expect(acc?.password).not.toContain("una-clave-larga");
    expect(await db.select().from(memberships).where(eq(memberships.userId, r.userId))).toEqual([
      expect.objectContaining({ tenantId: r.tenantId, role: "owner" }),
    ]);
    const [profile] = await db.select().from(agentProfiles).where(eq(agentProfiles.tenantId, r.tenantId));
    expect(profile).toMatchObject({ displayName: "María Pérez", whatsapp: "+593 99 123 4567", city: "Rumiñahui", isPrimary: true, email: null });
  });

  it("rejects a second account with the same email and keeps slugs unique", async () => {
    await expect(registerAgent(input({ email: "maria@correo.ec" }))).rejects.toMatchObject({ code: "conflict" });
    const other = await registerAgent(input({ email: "otra@correo.ec" }));
    expect(other.tenantSlug).toBe("maria-perez-2");
    expect((await registerAgent(input({ name: "Panel", email: "p@correo.ec" }))).tenantSlug).toBe("panel-2");
    expect(await db.select().from(tenants)).toHaveLength(3);
  });

  it("validates input", () => {
    const bad = registrationSchema.safeParse({ name: "A", email: "x", password: "corta", city: "narnia", whatsapp: "abc" });
    expect(bad.success).toBe(false);
    expect(Object.keys(bad.error!.flatten().fieldErrors).sort()).toEqual(["city", "email", "name", "password", "whatsapp"]);
  });
});
