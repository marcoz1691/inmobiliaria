import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("panel requires login and accepts valid credentials", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel\/ingresar$/);
  await page.getByLabel("Correo").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Contraseña").fill("incorrecta-123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
  await login(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola");
});
