import { expect as baseExpect, test, type Page } from "@playwright/test";
import { waitForFormMinAge } from "./helpers";

// `next dev` compiles each route on first hit; under load that can exceed the 5 s default.
const expect = baseExpect.configure({ timeout: 15_000 });
test.slow();

// Funnel "comprador" (template real_estate_buyer) and Mon–Sat 09:00–18:00 availability are
// created by scripts/e2e-fixtures.ts.

/** A pointer tap on a single-choice option advances to the next step by itself. */
async function answer(page: Page, option: string) {
  const step = await page.getByText(/^Paso \d+ de \d+$/).textContent();
  await page.getByRole("radio", { name: option }).check();
  await expect(page.getByText(/^Paso \d+ de \d+$/)).not.toHaveText(step!);
}

/** `openedAt`: taken once the funnel page loaded, i.e. after the server signed its form token. */
async function fillContact(page: Page, email: string, openedAt: number) {
  await expect(page.getByRole("heading", { name: "¿A quién le confirmamos la cita?" })).toBeVisible();
  await page.getByLabel("Nombre").fill("Prospecto Prueba");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Teléfono o WhatsApp").fill("0991234567");
  await page.getByLabel(/Acepto que mis datos/).check();
  // Minimum fill time guard (bots submit instantly).
  await waitForFormMinAge(openedAt);
  await page.getByRole("button", { name: "Ver horarios disponibles" }).click();
}

test("qualified lead from a Meta ad books the first available slot", async ({ page }, info) => {
  await page.goto("/agenda/comprador?utm_source=facebook&utm_campaign=e2e&fbclid=test");
  const openedAt = Date.now();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Paso 1 de 6")).toBeVisible();

  // Required answers are enforced before moving on.
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Elige una opción para continuar.")).toBeVisible();

  await answer(page, "Comprar para vivir");
  await answer(page, "US$150.000 – 300.000");
  // Back keeps previous answers; "Siguiente" also works (keyboard users).
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(page.getByRole("radio", { name: "US$150.000 – 300.000" })).toBeChecked();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Paso 3 de 6")).toBeVisible();
  await answer(page, "De contado");
  await answer(page, "Este mes");
  await page.getByLabel("¿En qué ciudad o sector?").fill("Cumbayá");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await fillContact(page, `comprador-${info.project.name}@example.com`, openedAt);

  await expect(page.getByRole("heading", { name: "Elige un horario para tu cita" })).toBeVisible({ timeout: 20_000 });
  const firstSlot = page.locator('input[type="radio"]').first();
  await firstSlot.locator("..").click();
  const confirm = page.getByRole("button", { name: /^Confirmar:/ });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // Generous timeout: the first booking compiles the action in `next dev`.
  await expect(page.getByText("Cita confirmada")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /^Te espero el/ })).toBeVisible();
  const ics = page.getByRole("link", { name: "Añadir a mi calendario" });
  const href = await ics.getAttribute("href");
  const file = await page.request.get(href!);
  expect(file.headers()["content-type"]).toContain("text/calendar");
  expect(await file.text()).toContain("BEGIN:VEVENT");

  // The manage link shows the appointment and lets the visitor cancel it.
  const manage = await page.getByRole("link", { name: "Gestionar mi cita" }).getAttribute("href");
  await page.goto(manage!);
  await expect(page.getByText("Confirmada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar la cita" }).click();
  await page.getByRole("button", { name: "Sí, cancelar la cita" }).click();
  await expect(page.getByText("Esta cita fue cancelada.")).toBeVisible();
});

test("unqualified lead never sees the calendar", async ({ page }, info) => {
  await page.goto("/agenda/comprador?utm_source=facebook&fbclid=test");
  const openedAt = Date.now();
  await answer(page, "Comprar para invertir");
  await answer(page, "Menos de US$60.000");
  await answer(page, "Aún no lo sé");
  await answer(page, "Solo estoy explorando");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await fillContact(page, `explorando-${info.project.name}@example.com`, openedAt);

  await expect(page.getByRole("heading", { name: "Por ahora no es el mejor momento para una cita" })).toBeVisible();
  await expect(page.getByText("te enviamos opciones por correo", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver propiedades" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Elige un horario para tu cita" })).toHaveCount(0);
  await expect(page.locator('input[type="radio"]')).toHaveCount(0);
});
