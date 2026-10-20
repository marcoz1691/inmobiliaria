import type { APIRequestContext } from "@playwright/test";

/** `next dev` compiles routes on first hit; warming them keeps the 5 s expectations meaningful. */
export async function warmUp(request: APIRequestContext, paths: string[]) {
  for (const p of paths) await request.get(p, { timeout: 120_000, maxRedirects: 0 }).catch(() => undefined);
}

/** Same as helpers.login, with a longer wait: `next dev` may still be compiling the dashboard. */
export async function loginPatient(page: import("@playwright/test").Page) {
  const { expect } = await import("@playwright/test");
  await page.goto("/panel/ingresar");
  await page.getByLabel("Correo").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 60_000 });
}
