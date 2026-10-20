import { existsSync } from "node:fs";
import { expect as baseExpect, test } from "@playwright/test";
import { loginPatient as login, warmUp } from "./fixtures/warmup";

const PDF = "assets-input/pdfs/Casa Pomasqui.pdf";

test.describe.configure({ timeout: 360_000 });
/** Dev server compiles on demand; give UI updates more room than the default 5 s. */
const expect = baseExpect.configure({ timeout: 30_000 });

test("import a property sheet PDF into a reviewable draft", async ({ page }, info) => {
  test.skip(!existsSync(PDF), "Falta assets-input/pdfs/Casa Pomasqui.pdf");
  await warmUp(page.request, ["/api/auth/get-session", "/panel", "/panel/importar", "/panel/importar/00000000-0000-0000-0000-000000000000", "/panel/propiedades/00000000-0000-0000-0000-000000000000"]);
  await login(page);
  await page.goto("/panel/importar");
  await page.locator('input[type="file"][accept^="application/pdf"]').setInputFiles(PDF);

  // The same file can be imported only once per tenant; the second project sees the dedupe message.
  const review = page.getByRole("link", { name: "Ver revisión" });
  await expect(review).toBeVisible({ timeout: 180_000 });
  if (info.project.name !== "desktop") await expect(page.getByText(/ya se importó antes/)).toBeVisible();
  // Navigate by href: a background router.refresh() can delay a client-side transition in dev.
  await page.goto((await review.getAttribute("href"))!);
  await expect(page).toHaveURL(/\/panel\/importar\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: /Abrir PDF original/ })).toBeVisible();
  await expect(page.getByText(/fotos? adjuntas?/)).toBeVisible();

  await page.getByRole("link", { name: /Revisar y editar/ }).first().click();
  await expect(page.getByRole("heading", { name: "Revisa los datos importados" })).toBeVisible();
  await expect(page.getByLabel("Precio (US$)")).toHaveValue("110000");

  await page.getByRole("button", { name: "Paso 4: Revisar y publicar" }).click();
  await expect(page.getByText("Revisa los datos importados y marca la revisión como completa.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Marcar revisión completa" }).click();
  await expect(page.getByText(/Revisión completa/)).toBeVisible();
  await expect(page.getByText("Revisa los datos importados y marca la revisión como completa.")).toHaveCount(0);
});
