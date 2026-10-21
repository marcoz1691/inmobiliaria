import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, integrations } from "@/env";
import { log } from "@/lib/logger";

export interface MediaStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
  /** Public URL for a stored object. */
  url(key: string): string;
  /** Reads an object through the authenticated API (never its public URL); null when absent. */
  get(key: string): Promise<Buffer | null>;
}

/** Objects that must never be reachable without a session (e.g. imported source PDFs). No public URL. */
export type PrivateStorage = Omit<MediaStorage, "url">;

const LOCAL_ROOT = path.join(process.cwd(), ".data", "media");
const LOCAL_PRIVATE_ROOT = path.join(process.cwd(), ".data", "private");

function resolveIn(root: string, key: string): string {
  const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) throw new Error("Invalid media key");
  return file;
}

/** Dev/test storage on disk. The public root is served by src/app/media/[...key]/route.ts; the private one never is. */
class LocalDiskStorage implements MediaStorage {
  constructor(private root: string) {}
  async put(key: string, body: Buffer) {
    const file = resolveIn(this.root, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  async remove(keys: string[]) {
    await Promise.all(keys.map((k) => rm(resolveIn(this.root, k), { force: true })));
  }
  async get(key: string) {
    return readFile(resolveIn(this.root, key)).catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return null;
      throw err;
    });
  }
  url(key: string) {
    return `/media/${key}`;
  }
}

export function resolveLocal(key: string): string {
  return resolveIn(LOCAL_ROOT, key);
}

export async function readLocal(key: string): Promise<Buffer> {
  return readFile(resolveLocal(key));
}

type ClientFactory = () => Promise<SupabaseClient>;

const supabaseClient: ClientFactory = (() => {
  let client: Promise<SupabaseClient> | undefined;
  return () =>
    (client ??= import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }),
    ));
})();

/** Supabase Storage with the service-role key (server only). `bucket` is public or private per its Supabase setting. */
export class SupabaseStorage implements MediaStorage {
  constructor(
    private bucket: string,
    private client: ClientFactory = supabaseClient,
  ) {}

  async put(key: string, body: Buffer, contentType: string) {
    const { error } = await (await this.client()).storage
      .from(this.bucket)
      .upload(key, body, { contentType, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }
  async remove(keys: string[]) {
    if (!keys.length) return;
    const { error } = await (await this.client()).storage.from(this.bucket).remove(keys);
    if (error) throw new Error(`Storage remove failed: ${error.message}`);
  }
  async get(key: string) {
    const { data, error } = await (await this.client()).storage.from(this.bucket).download(key);
    if (error) log.warn("storage download failed", { bucket: this.bucket, error: error.message });
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  url(key: string) {
    return `${env.SUPABASE_URL}/storage/v1/object/public/${this.bucket}/${key}`;
  }
}

let instance: MediaStorage | undefined;
export function getStorage(): MediaStorage {
  instance ??= integrations.supabaseStorage ? new SupabaseStorage(env.SUPABASE_STORAGE_BUCKET) : new LocalDiskStorage(LOCAL_ROOT);
  return instance;
}

let privateInstance: PrivateStorage | undefined;
export function getPrivateStorage(): PrivateStorage {
  privateInstance ??= integrations.supabaseStorage
    ? new SupabaseStorage(env.SUPABASE_PRIVATE_BUCKET)
    : new LocalDiskStorage(LOCAL_PRIVATE_ROOT);
  return privateInstance;
}
