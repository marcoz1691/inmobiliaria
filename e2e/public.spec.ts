import { expect as baseExpect, test } from "@playwright/test";

// `next dev` compiles each route on first hit; under load that can exceed the 5 s default.
const expect = baseExpect.configure({ timeout: 15_000 });
test.slow();

// Listings come from scripts/e2e-fixtures.ts (seeded only with SEED_E2E_FIXTURES=1).
const PUBLISHED = "Casa de prueba E2E en Cumbayá";
const ARCHIVED_SLUG = "terreno-de-prueba-e2e-archivado";

test("visitor filters the catalog, opens a listing and sends an inquiry", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/propiedades");
  await expect(page.getByRole("heading", { level: 1, name: "Propiedades" })).toBeVisible();

  // Mobile filters live in a disclosure; desktop shows the sidebar.
  const scope = isMobile ? page.locator("details") : page.locator("aside");
  if (isMobile) await page.getByText("Filtros", { exact: true }).click();
  await scope.getByLabel("Sector o ciudad").fill("Cumbayá");
  await scope.getByLabel("Operación").selectOption("sale");
  await scope.getByLabel("Dormitorios").selectOption("2");
  await scope.getByRole("button", { name: "Ver resultados" }).click();

  await expect(page).toHaveURL(/q=Cumbay/);
  await expect(page).not.toHaveURL(/maxPrice=/);
  await expect(page.getByText("1 propiedad con estos filtros")).toBeVisible();
  await expect(page.getByRole("link", { name: /Departamento de prueba/ })).toHaveCount(0);

  await page.getByRole("link", { name: PUBLISHED }).click();
  await expect(page.getByRole("heading", { level: 1, name: PUBLISHED })).toBeVisible();
  await expect(page.getByText("US$185.000").first()).toBeVisible();

  const form = page.locator("#consulta");
  await form.getByLabel("Nombre").fill("Visitante de Prueba");
  await form.getByLabel("Correo").fill("visitante@example.com");
  await form.getByLabel(/Acepto que mis datos/).check();
  // Real people take a few seconds; the form rejects instant (bot-like) submissions.
  await page.waitForTimeout(3200);
  await form.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(form.getByText("Mensaje enviado")).toBeVisible();
});

test("inquiry shows field errors without consent", async ({ page }) => {
  await page.goto("/contacto");
  await page.getByLabel("Nombre").fill("A");
  await page.waitForTimeout(3200);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByRole("alert").first()).toContainText("Revisa los campos");
  await expect(page.getByLabel("Nombre")).toHaveAttribute("aria-invalid", "true");
});

test("archived listing answers 410 and unknown listing 404", async ({ page }) => {
  const gone = await page.goto(`/propiedades/${ARCHIVED_SLUG}`);
  expect(gone?.status()).toBe(410);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Esta propiedad ya no está disponible");
  await expect(page.getByRole("link", { name: "Ver propiedades disponibles" })).toBeVisible();

  const missing = await page.goto("/propiedades/no-existe-esta-propiedad");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "No encontramos esta propiedad" })).toBeVisible();
});

test("robots and sitemap", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /panel");
  expect(robots).toContain("Disallow: /cita");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/propiedades/casa-de-prueba-e2e-en-cumbaya");
  expect(sitemap).toContain("/agenda/comprador");
  expect(sitemap).not.toContain(ARCHIVED_SLUG);
});
