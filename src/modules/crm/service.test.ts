import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { member, seedTenant, useTestDb } from "../../../test/db";
import type { Db } from "@/server/db/create";
import { contacts, jobs, properties } from "@/server/db/schema";
import { captureInquiry, getDeal, inquirySchema, listDeals, moveDeal, normalizePhone } from "./service";

describe("crm", () => {
  let db: Db;
  let A: Awaited<ReturnType<typeof seedTenant>>;
  let B: Awaited<ReturnType<typeof seedTenant>>;

  beforeAll(async () => {
    db = await useTestDb();
    A = await seedTenant(db, "a");
    B = await seedTenant(db, "b");
  });

  it("validates consent and a way to reach the person", () => {
    expect(inquirySchema.safeParse({ name: "Ana", phone: "0991234567", consent: false }).success).toBe(false);
    expect(inquirySchema.safeParse({ name: "Ana", consent: true }).success).toBe(false);
    expect(inquirySchema.safeParse({ name: "Ana", phone: "0991234567", consent: true }).success).toBe(true);
  });

  it("normalizes Ecuadorian phones", () => {
    expect(normalizePhone("099 123 4567")).toBe("+593991234567");
    expect(normalizePhone("+593 99 123 4567")).toBe("+593991234567");
  });

  it("creates a deal linked to the property, dedupes the contact and queues one notification", async () => {
    const [p] = await db.insert(properties).values({ tenantId: A.tenant.id, slug: "casa", title: "Casa" }).returning();
    const input = inquirySchema.parse({ name: "Ana", phone: "0991234567", consent: true, propertyId: p!.id, message: "¿Sigue disponible?" });
    const first = await captureInquiry(A.tenant.id, input, { source: "property_form" });
    const second = await captureInquiry(A.tenant.id, { ...input, email: "ana@correo.ec" }, { source: "property_form" });
    expect(second.contactId).toBe(first.contactId);
    const contactRows = await db.select().from(contacts).where(eq(contacts.tenantId, A.tenant.id));
    expect(contactRows).toHaveLength(1);
    expect(contactRows[0]).toMatchObject({ phone: "+593991234567", email: "ana@correo.ec" });
    expect(contactRows[0]!.consentAt).toBeInstanceOf(Date);
    const deals = await listDeals(member(A.tenant.id));
    expect(deals[0]).toMatchObject({ propertyTitle: "Casa" });
    expect(await db.select().from(jobs).where(eq(jobs.tenantId, A.tenant.id))).toHaveLength(2);
  });

  it("ignores a property id from another tenant and isolates deals", async () => {
    const [foreign] = await db.insert(properties).values({ tenantId: B.tenant.id, slug: "ajena", title: "Ajena" }).returning();
    const r = await captureInquiry(A.tenant.id, inquirySchema.parse({ name: "Luis", email: "l@x.ec", consent: true, propertyId: foreign!.id }), { source: "form" });
    const d = await getDeal(member(A.tenant.id), r.dealId);
    expect(d.deal.propertyId).toBeNull();
    await expect(getDeal(member(B.tenant.id), r.dealId)).rejects.toMatchObject({ code: "not_found" });
    await expect(moveDeal(member(B.tenant.id), r.dealId, "won")).rejects.toMatchObject({ code: "not_found" });
  });
});
