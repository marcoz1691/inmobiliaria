import { expect, type Locator, type Page } from "@playwright/test";

export async function login(page: Page) {
  await page.goto("/panel/ingresar");
  await page.getByLabel("Correo").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

/** Minimum fill time enforced by the public forms (src/app/(public)/_lib/guard.ts, `minMs`). */
const FORM_MIN_MS = 3000;

/**
 * Waits until a public form is old enough to be accepted. `from` is either the form (its signed
 * `form_token` carries the server's issue time) or a timestamp taken after the page loaded.
 * Returns immediately when the visitor already spent that long on the page.
 */
export async function waitForFormMinAge(from: Locator | number) {
  const issuedAt = typeof from === "number" ? from : Number((await from.locator('input[name="form_token"]').first().inputValue()).split(".")[0]);
  expect(Number.isFinite(issuedAt)).toBe(true);
  await expect.poll(() => Date.now() - issuedAt, { intervals: [100, 250], timeout: FORM_MIN_MS + 5_000 }).toBeGreaterThan(FORM_MIN_MS + 250);
}
