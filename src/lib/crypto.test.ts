import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt, randomToken, safeEqual, sha256 } from "./crypto";

const KEY = randomBytes(32).toString("base64");

describe("crypto", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = saved;
  });

  it("round-trips unicode, empty and long payloads with a fresh IV each time", () => {
    for (const plain of ["", "ya29.a0AfB_token-de-google", "Ñandú · 🏠 · árbol", "x".repeat(10_000)]) {
      const a = encrypt(plain);
      const b = encrypt(plain);
      expect(a).not.toBe(b);
      expect(a.split(".")).toHaveLength(3);
      expect(decrypt(a)).toBe(plain);
      if (plain) expect(a).not.toContain(plain.slice(0, 8));
    }
  });

  it("rejects any tampering with IV, tag or ciphertext", () => {
    const [iv, tag, data] = encrypt("refresh-token-secreto").split(".") as [string, string, string];
    const flip = (s: string) => {
      const b = Buffer.from(s, "base64url");
      b[0] = b[0]! ^ 0x01;
      return b.toString("base64url");
    };
    expect(() => decrypt([flip(iv), tag, data].join("."))).toThrow();
    expect(() => decrypt([iv, flip(tag), data].join("."))).toThrow();
    expect(() => decrypt([iv, tag, flip(data)].join("."))).toThrow();
    expect(() => decrypt([iv, tag, `${data}AA`].join("."))).toThrow();
    expect(() => decrypt([iv, tag.slice(0, 8), data].join("."))).toThrow();
  });

  it("rejects malformed payloads", () => {
    for (const bad of ["", "abc", "a.b", "...", "no.es.cifrado"]) expect(() => decrypt(bad), bad).toThrow();
  });

  it("a different key cannot decrypt", () => {
    const c = encrypt("secreto");
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decrypt(c)).toThrow();
  });

  it("requires a configured 32-byte key", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/not configured/);
    process.env.ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });

  it("safeEqual, sha256 and randomToken", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("ñ", "n")).toBe(false);
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256(Buffer.from("abc"))).toBe(sha256("abc"));
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(t);
    expect(randomToken(8)).toHaveLength(11);
  });
});
