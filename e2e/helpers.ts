import { expect, type Page } from "@playwright/test";

export async function login(page: Page) {
  await page.goto("/panel/ingresar");
  await page.getByLabel("Correo").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}
