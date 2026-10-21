import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseStorage } from "./storage";

/** In-memory stand-in for the Supabase Storage API, recording which bucket each call hits. */
function fakeSupabase() {
  const objects = new Map<string, Buffer>();
  const calls: string[] = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: async (key: string, body: Buffer) => {
          calls.push(`upload ${bucket}/${key}`);
          objects.set(`${bucket}/${key}`, body);
          return { error: null };
        },
        download: async (key: string) => {
          calls.push(`download ${bucket}/${key}`);
          const body = objects.get(`${bucket}/${key}`);
          return body ? { data: new Blob([new Uint8Array(body)]), error: null } : { data: null, error: { message: "Object not found" } };
        },
        remove: async (keys: string[]) => {
          for (const k of keys) objects.delete(`${bucket}/${k}`);
          return { error: null };
        },
      }),
    },
  };
  return { objects, calls, factory: async () => client as unknown as SupabaseClient };
}

describe("SupabaseStorage", () => {
  it("reads private objects through the authenticated download API, never a public URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const fake = fakeSupabase();
    const store = new SupabaseStorage("private", fake.factory);
    await store.put("tenants/t/imports/k.pdf", Buffer.from("%PDF-1.4"), "application/pdf");
    expect((await store.get("tenants/t/imports/k.pdf"))?.toString()).toBe("%PDF-1.4");
    expect(await store.get("tenants/t/imports/otro.pdf")).toBeNull();
    expect(fake.calls).toEqual([
      "upload private/tenants/t/imports/k.pdf",
      "download private/tenants/t/imports/k.pdf",
      "download private/tenants/t/imports/otro.pdf",
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
