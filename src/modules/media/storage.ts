import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, integrations } from "@/env";

export interface MediaStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
  /** Public URL for a stored object. */
  url(key: string): string;
}

const LOCAL_ROOT = path.join(process.cwd(), ".data", "media");

/** Dev/test storage on disk, served by src/app/media/[...key]/route.ts. */
class LocalDiskStorage implements MediaStorage {
  async put(key: string, body: Buffer) {
    const file = resolveLocal(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  async remove(keys: string[]) {
    await Promise.all(keys.map((k) => rm(resolveLocal(k), { force: true })));
  }
  url(key: string) {
    return `/media/${key}`;
  }
}

export function resolveLocal(key: string): string {
  const file = path.resolve(LOCAL_ROOT, key);
  if (!file.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid media key");
  return file;
}

export async function readLocal(key: string): Promise<Buffer> {
  return readFile(resolveLocal(key));
}

class SupabaseStorage implements MediaStorage {
  private client = import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }),
  );
  private bucket = env.SUPABASE_STORAGE_BUCKET;

  async put(key: string, body: Buffer, contentType: string) {
    const { error } = await (await this.client).storage
      .from(this.bucket)
      .upload(key, body, { contentType, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }
  async remove(keys: string[]) {
    if (!keys.length) return;
    const { error } = await (await this.client).storage.from(this.bucket).remove(keys);
    if (error) throw new Error(`Storage remove failed: ${error.message}`);
  }
  url(key: string) {
    return `${env.SUPABASE_URL}/storage/v1/object/public/${this.bucket}/${key}`;
  }
}

let instance: MediaStorage | undefined;
export function getStorage(): MediaStorage {
  instance ??= integrations.supabaseStorage ? new SupabaseStorage() : new LocalDiskStorage();
  return instance;
}
