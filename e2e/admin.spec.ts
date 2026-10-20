import { expect as baseExpect, test, type Page } from "@playwright/test";
import { makePhotos } from "./fixtures/images";
import { loginPatient as login, warmUp } from "./fixtures/warmup";

test.describe.configure({ timeout: 180_000 });
/** Dev server compiles on demand; give UI updates more room than the default 5 s. */
const expect = baseExpect.configure({ timeout: 15_000 });
test.beforeAll(async ({ request }) => {
  await warmUp(request, ["/api/auth/get-session", "/panel", "/panel/ingresar", "/panel/propiedades", "/panel/propiedades/nueva", "/panel/propiedades/00000000-0000-0000-0000-000000000000", "/propiedades"]);
});

/** The public catalog lives in another branch; skip those checks when the route is not there yet. */
async function catalogAvailable(page: Page) {
  const res = await page.request.get("/propiedades");
  return res.status() !== 404;
}

test("publish a property from the wizard, pause it, duplicate and archive", async ({ page }, info) => {
  const title = `Casa e2e ${info.project.name} ${Date.now().toString(36)}`;
  const photos = await makePhotos(3);
  await login(page);

  await page.getByRole("link", { name: "Publicar propiedad" }).first().click();
  await expect(page).toHaveURL(/\/panel\/propiedades\/nueva$/);

  // 1 · Básicos
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Tipo de propiedad").selectOption("house");
  await page.getByText("Venta", { exact: true }).click();
  await page.getByLabel("Precio (US$)").fill("185.000");
  await page.getByLabel("Ciudad").fill("Quito");
  await page.getByLabel("Sector o barrio (opcional)").fill("Cumbayá");
  await page.getByRole("button", { name: "Siguiente: Fotos" }).click();
  await expect(page).toHaveURL(/\/panel\/propiedades\/[0-9a-f-]{36}\?paso=fotos$/);
  const editUrl = page.url().split("?")[0]!;

  // 2 · Fotos
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles(photos);
  const list = page.getByTestId("photo-list").locator("li");
  await expect(list).toHaveCount(3, { timeout: 30_000 });
  const ids = await list.evaluateAll((els) => els.map((e) => e.getAttribute("data-photo-id")));
  await page.getByRole("button", { name: "Mover foto 3 antes" }).click();
  await expect.poll(() => list.evaluateAll((els) => els.map((e) => e.getAttribute("data-photo-id")))).toEqual([ids[0], ids[2], ids[1]]);
  await page.getByRole("button", { name: "Usar como portada (foto 3)" }).click();
  await expect.poll(() => list.first().getAttribute("data-photo-id")).toBe(ids[1]);
  await expect(list.first().getByText("Portada")).toBeVisible();
  await page.getByLabel("Descripción de la foto 1 (opcional)").fill("Fachada principal");
  await page.getByLabel("Descripción de la foto 1 (opcional)").blur();
  await page.getByRole("button", { name: "Siguiente: Detalles" }).click();

  // 3 · Detalles (autosave)
  await page.getByLabel("Dormitorios").fill("3");
  await page.getByLabel("Baños").fill("2,5");
  await page.getByLabel("Área de construcción (m²)").fill("180");
  await page.getByRole("button", { name: "Agregar Jardín" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Guardado" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Siguiente: Revisar y publicar" }).click();

  // 4 · Revisar y publicar
  await expect(page.getByRole("heading", { name: "Todo listo para publicar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Publicada/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver en el sitio" })).toBeVisible();

  // Data survived the round trip.
  await page.goto(`${editUrl}?paso=detalles`);
  await expect(page.getByLabel("Dormitorios")).toHaveValue("3");
  await expect(page.getByLabel("Baños")).toHaveValue("2.5");

  const hasCatalog = await catalogAvailable(page);
  if (hasCatalog) {
    await page.goto("/propiedades");
    await expect(page.getByText(title)).toBeVisible();
  } else info.annotations.push({ type: "skip-check", description: "/propiedades no existe en esta rama" });

  // Pause → leaves the catalog.
  await page.goto(`/panel/propiedades?q=${encodeURIComponent(title)}`);
  const row = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await row.getByText("Más acciones").click();
  await row.getByRole("button", { name: "Pausar" }).click();
  await expect(row.getByText("Pausada", { exact: true })).toBeVisible();
  if (hasCatalog) {
    await page.goto("/propiedades");
    await expect(page.getByText(title)).toHaveCount(0);
    await page.goto(`/panel/propiedades?q=${encodeURIComponent(title)}`);
  }

  // Duplicate with confirmation.
  await row.getByText("Más acciones").click();
  await row.getByRole("button", { name: "Duplicar" }).click();
  const dup = page.getByRole("dialog", { name: "¿Duplicar esta propiedad?" });
  await expect(dup).toBeVisible();
  await dup.getByRole("button", { name: "Duplicar" }).click();
  // The copy opens in the editor as a draft.
  await expect(page.getByLabel("Título")).toHaveValue(`${title} (copia)`);
  await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();
  await page.goto(`/panel/propiedades?q=${encodeURIComponent(title)}`);
  await expect(page.getByRole("heading", { name: `${title} (copia)` })).toBeVisible();

  // Archive with confirmation.
  const original = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await original.getByText("Más acciones").click();
  await original.getByRole("button", { name: "Archivar" }).click();
  const arch = page.getByRole("dialog", { name: "¿Archivar esta propiedad?" });
  await arch.getByRole("button", { name: "Archivar" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
  await page.goto(`/panel/propiedades?estado=archived&q=${encodeURIComponent(title)}`);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

test("autosave keeps edits and flags invalid numbers", async ({ page }) => {
  await login(page);
  await page.goto("/panel/propiedades/nueva");
  await page.getByLabel("Título").fill("Departamento de prueba autosave");
  await page.getByRole("button", { name: "Siguiente: Fotos" }).click();
  await expect(page).toHaveURL(/paso=fotos/);
  await page.getByRole("button", { name: "Paso 1: Básicos" }).click();
  await page.getByLabel("Precio (US$)").fill("abc");
  await expect(page.getByText("Escribe solo el número, por ejemplo 110000.")).toBeVisible();
  await expect(page.getByLabel("Precio (US$)")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Precio (US$)").fill("99000");
  await page.getByLabel("Ciudad").fill("Guayaquil");
  await expect(page.getByRole("status").filter({ hasText: "Guardado" })).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByLabel("Precio (US$)")).toHaveValue("99000");
  await expect(page.getByLabel("Ciudad")).toHaveValue("Guayaquil");
});
