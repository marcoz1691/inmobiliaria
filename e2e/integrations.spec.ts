import { expect, test } from "@playwright/test";

// The e2e server runs without third-party credentials: every integration must say so honestly.

test("chat API reports the assistant as unavailable without an API key", async ({ request }) => {
  expect(await (await request.get("/api/chat")).json()).toEqual({ available: false });
  const res = await request.post("/api/chat", { data: { message: "Hola" } });
  expect(await res.json()).toEqual({ status: "unavailable" });
});

test("Meta webhooks answer 503 when not configured", async ({ request }) => {
  expect((await request.get("/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1")).status()).toBe(503);
  expect((await request.post("/api/webhooks/meta", { data: { object: "page", entry: [] } })).status()).toBe(503);
});

test("opt-out with an invalid link shows a clear 400 page", async ({ page }) => {
  const res = await page.goto("/api/opt-out?t=invalido.token");
  expect(res?.status()).toBe(400);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Enlace no válido");
});

// Only the anonymous branch: sign-in is rate limited (5/min per IP) and other specs already log in.
test("Google Calendar connect requires a panel session", async ({ page }) => {
  await page.goto("/api/integrations/google/start");
  await expect(page).toHaveURL(/\/panel\/ingresar$/);
});
