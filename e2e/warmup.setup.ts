import { expect, test as setup } from "@playwright/test";
import { warmUp } from "./fixtures/warmup";

/**
 * `next dev` compiles each route (server and client chunks) on its first visit. Doing that once,
 * before the desktop and mobile projects, keeps first-hit compiles out of the tests' own
 * timeouts and avoids clicking before hydration on a cold page.
 */
const PUBLIC = ["/", "/propiedades", "/propiedades/casa-de-prueba-e2e-en-cumbaya", "/contacto", "/agenda/comprador"];
const SERVER_ONLY = ["/api/auth/get-session", "/panel", "/panel/propiedades", "/panel/importar", "/sitemap.xml", "/robots.txt"];

setup("warm up routes", async ({ page, request }) => {
  setup.setTimeout(900_000);
  await warmUp(request, [...PUBLIC, ...SERVER_ONLY]);
  for (const path of [...PUBLIC, "/panel/ingresar"]) {
    await page.goto(path, { timeout: 180_000 });
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("load", { timeout: 180_000 });
  }
});
