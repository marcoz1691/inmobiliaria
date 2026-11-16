import { expect as baseExpect, test } from "@playwright/test";
import { makePhotos } from "./fixtures/images";
import { waitForFormMinAge } from "./helpers";

// The pilot agent's site is on localhost (SEED_TENANT_DOMAINS); any other host is the portal.
const expect = baseExpect.configure({ timeout: 15_000 });
const PORTAL = `http://127.0.0.1:${process.env.E2E_PORT ?? 3200}`;
test.slow();

test("visitor searches the portal by province and city and writes to the agent", async ({ page }) => {
  await page.goto(`${PORTAL}/`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("todo Ecuador");
  const search = page.getByRole("form", { name: "Buscar propiedades" });
  // Every province of Ecuador is offered, with or without listings.
  await expect(search.getByLabel("Provincia").locator("option")).toHaveCount(25);
  await search.getByLabel("Provincia").selectOption("pichincha");
  await expect(search.getByLabel("Ciudad").locator("option")).toHaveCount(9);
  await search.getByLabel("Ciudad").selectOption("quito");
  await search.getByRole("button", { name: "Buscar" }).click();

  await expect(page).toHaveURL(/province=pichincha/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Quito");
  await expect(page.getByRole("link", { name: /Departamento de prueba/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Casa de prueba E2E en Cumbayá" }).click();

  await expect(page.getByText("Publicado por")).toBeVisible();
  const form = page.locator("#consulta");
  await form.getByLabel("Nombre").fill("Visitante del Portal");
  await form.getByLabel("Correo").fill("portal@example.com");
  await form.getByLabel(/Acepto que mis datos/).check();
  await waitForFormMinAge(form);
  await form.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(form.getByText("El agente recibió tu mensaje")).toBeVisible();
});

test("portal search pages cover every canton; agent-only pages are not on the portal", async ({ page, request }) => {
  expect((await page.goto(`${PORTAL}/venta/casas/quito`))?.status()).toBe(200);
  // A real canton with no listings yet: the page exists but stays out of the index.
  expect((await page.goto(`${PORTAL}/venta/casas/zamora`))?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect((await page.goto(`${PORTAL}/venta/casas/narnia`))?.status()).toBe(404);
  expect((await page.goto(`${PORTAL}/contacto`))?.status()).toBe(404);
  expect((await page.goto(`${PORTAL}/agenda/comprador`))?.status()).toBe(404);
  const sitemap = await (await request.get(`${PORTAL}/sitemap.xml`)).text();
  expect(sitemap).toContain("/agentes/piloto");
  expect(sitemap).toContain("/propiedades/casa-de-prueba-e2e-en-cumbaya");
});

test("an agent signs up on the portal and lands in their own panel", async ({ page }) => {
  const email = `agente-${Date.now()}@example.com`;
  await page.goto(`${PORTAL}/panel/registro`);
  const loadedAt = Date.now();
  await page.getByLabel("Nombre y apellido").fill("Agente Nuevo E2E");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill("clave-segura-e2e");
  await page.getByLabel("WhatsApp (opcional)").fill("+593 99 000 0000");
  await page.getByLabel("Provincia").selectOption("azuay");
  await page.getByLabel("Ciudad donde trabajas").selectOption("cuenca");
  await waitForFormMinAge(loadedAt);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // New agents land on the plans, already on Gratis.
  await expect(page).toHaveURL(/\/panel\/plan\?bienvenida=1$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Elige cómo empezar" })).toBeVisible();
  await expect(page.getByText("Tu plan actual")).toBeVisible();
  // A brand-new workspace: none of the pilot's listings.
  await page.goto(`${PORTAL}/panel/propiedades`);
  await expect(page.getByText("Casa de prueba E2E en Cumbayá")).toHaveCount(0);

  // Same email again is refused.
  await page.context().clearCookies();
  await page.goto(`${PORTAL}/panel/registro`);
  const again = Date.now();
  await page.getByLabel("Nombre y apellido").fill("Otra Persona");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill("otra-clave-larga");
  await waitForFormMinAge(again);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  // Scoped to the form: Next's route announcer is also a role="alert".
  await expect(page.locator("form").getByRole("alert")).toContainText("Ya existe una cuenta");
});

test("a free agent who reaches the plan limit is offered the paid plans", async ({ page }) => {
  test.setTimeout(400_000);
  const photos = await makePhotos(1);
  await page.goto(`${PORTAL}/panel/registro`);
  const loadedAt = Date.now();
  await page.getByLabel("Nombre y apellido").fill("Agente Plan Gratis");
  await page.getByLabel("Correo").fill(`gratis-${Date.now()}@example.com`);
  await page.getByLabel("Contraseña").fill("clave-segura-e2e");
  await waitForFormMinAge(loadedAt);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel\/plan/, { timeout: 60_000 });

  async function createAndPublish(title: string) {
    await page.goto(`${PORTAL}/panel/propiedades/nueva`);
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Tipo de propiedad").selectOption("house");
    await page.getByText("Venta", { exact: true }).click();
    await page.getByLabel("Precio (US$)").fill("120000");
    await page.getByLabel("Provincia").selectOption({ label: "Azuay" });
    await page.getByLabel("Ciudad o cantón").selectOption("cuenca");
    await page.getByRole("button", { name: "Siguiente: Fotos" }).click();
    await expect(page).toHaveURL(/paso=fotos$/, { timeout: 60_000 });
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles(photos);
    await expect(page.getByTestId("photo-list").locator("li")).toHaveCount(1, { timeout: 30_000 });
    await page.getByRole("button", { name: "Siguiente: Detalles" }).click();
    await page.getByRole("button", { name: "Siguiente: Revisar y publicar" }).click();
    await expect(page.getByRole("heading", { name: "Todo listo para publicar" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
  }

  await createAndPublish("Casa de prueba gratis número uno");
  await expect(page.getByRole("heading", { name: /Publicada/ })).toBeVisible({ timeout: 30_000 });

  // At the limit, the plans show up as soon as the agent starts a new listing, before any typing.
  await page.goto(`${PORTAL}/panel/propiedades/nueva`);
  await expect(page.getByLabel("Título")).toHaveCount(0);
  const sheet = page.getByRole("dialog", { name: "Publica más con un plan pagado" });
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet).toContainText("Tu plan Gratis permite 1 propiedad publicada");
  await expect(sheet.getByText("Pro", { exact: true })).toBeVisible();
  await sheet.getByRole("link", { name: "Ver planes y mejorar" }).click();
  await expect(page).toHaveURL(/\/panel\/plan$/);
});
