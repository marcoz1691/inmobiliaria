import { describe, expect, it } from "vitest";
import { ilikeContains } from "./domain";

describe("ilikeContains", () => {
  it("escapes %, _ and backslash so they are literal in ILIKE", () => {
    expect(ilikeContains("%")).toBe("%\\%%");
    expect(ilikeContains("_")).toBe("%\\_%");
    expect(ilikeContains("a\\b")).toBe("%a\\\\b%");
    expect(ilikeContains("Nayón")).toBe("%Nayón%");
  });
});
