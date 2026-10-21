import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedTenant, useTestDb } from "../../test/db";
import { memberships, tenantDomains, user } from "./db/schema";

// Request headers and the Better Auth session are the only inputs; both are controlled here.
const req = vi.hoisted(() => ({ headers: new Headers(), userId: null as string | null }));
vi.mock("next/headers", () => ({ headers: async () => req.headers }));
vi.mock("./auth", () => ({
  getAuth: async () => ({ api: { getSession: async () => (req.userId ? { user: { id: req.userId, name: "Usuario" } } : null) } }),
}));

const tenantMod = () => import("./tenant");
const sessionMod = () => import("./session");

describe("normalizeHost", () => {
  it("lowercases, drops the port and a leading www.", async () => {
    const { normalizeHost } = await tenantMod();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost("Agente.EC")).toBe("agente.ec");
    expect(normalizeHost("www.agente.ec:443")).toBe("agente.ec");
    expect(normalizeHost("localhost:3000")).toBe("localhost");
    expect(normalizeHost("wwwagente.ec")).toBe("wwwagente.ec");
    expect(normalizeHost("[::1]:3000")).toBe("[::1]");
  });
});

describe("tenant and membership resolution by Host", () => {
  let piloto: string;
  let otra: string;

  beforeAll(async () => {
    const db = await useTestDb();
    piloto = (await seedTenant(db, "piloto")).tenant.id;
    otra = (await seedTenant(db, "otra")).tenant.id;
    await db.insert(tenantDomains).values({ domain: "otra-agente.ec", tenantId: otra });
    await db.insert(user).values({ id: "u-piloto", name: "Dueña piloto", email: "duena@piloto.test" });
    await db.insert(memberships).values({ tenantId: piloto, userId: "u-piloto", role: "owner" });
  });

  beforeEach(() => {
    req.headers = new Headers();
    req.userId = null;
  });

  const tenantFor = async (host?: string, extra: Record<string, string> = {}) => {
    req.headers = new Headers({ ...(host ? { host } : {}), ...extra });
    return (await (await tenantMod()).getCurrentTenant()).id;
  };

  it("maps a registered domain (any case, www., port) to its tenant", async () => {
    expect(await tenantFor("otra-agente.ec")).toBe(otra);
    expect(await tenantFor("WWW.Otra-Agente.EC:443")).toBe(otra);
  });

  it("unknown, missing or look-alike hosts fall back to the default tenant", async () => {
    expect(await tenantFor("localhost:3200")).toBe(piloto);
    expect(await tenantFor()).toBe(piloto);
    expect(await tenantFor("evil.otra-agente.ec")).toBe(piloto);
    expect(await tenantFor("otra-agente.ec.evil.com")).toBe(piloto);
    expect(await tenantFor("otra-agente.ec'--")).toBe(piloto);
  });

  it("ignores client-controlled forwarding headers", async () => {
    expect(await tenantFor("localhost", { "x-forwarded-host": "otra-agente.ec", "x-tenant-id": otra })).toBe(piloto);
  });

  it("a session is a member only of the tenant serving the Host", async () => {
    const { getMember } = await sessionMod();
    req.userId = "u-piloto";
    req.headers = new Headers({ host: "localhost:3200" });
    expect(await getMember()).toMatchObject({ tenantId: piloto, role: "owner", userId: "u-piloto" });
    // Same cookie on another tenant's domain: no membership there.
    req.headers = new Headers({ host: "otra-agente.ec" });
    expect(await getMember()).toBeNull();
    req.userId = null;
    req.headers = new Headers({ host: "localhost:3200" });
    expect(await getMember()).toBeNull();
  });
});
