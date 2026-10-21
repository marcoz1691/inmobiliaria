import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import { loginPatient as login, warmUp } from "./fixtures/warmup";

/**
 * Accessibility gate: WCAG 2.1 A/AA rules with axe; the build fails on `serious` or `critical`
 * violations. Every violation (any impact) is attached to the report for triage.
 */

const expect = baseExpect.configure({ timeout: 30_000 });
test.describe.configure({ timeout: 300_000 });

const PUBLIC_PAGES: { name: string; path: string; ready: (p: Page) => Promise<void> }[] = [
  { name: "inicio", path: "/", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "catálogo", path: "/propiedades", ready: (p) => expect(p.getByRole("heading", { level: 1, name: "Propiedades" })).toBeVisible() },
  {
    name: "ficha",
    path: "/propiedades/casa-de-prueba-e2e-en-cumbaya",
    ready: (p) => expect(p.getByRole("heading", { level: 1, name: "Casa de prueba E2E en Cumbayá" })).toBeVisible(),
  },
  { name: "contacto", path: "/contacto", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  { name: "embudo", path: "/agenda/comprador", ready: (p) => expect(p.getByText(/^Paso 1 de \d+$/)).toBeVisible() },
  { name: "login", path: "/panel/ingresar", ready: (p) => expect(p.getByRole("button", { name: "Ingresar" })).toBeVisible() },
];

const PANEL_PAGES = [
  "/panel",
  "/panel/propiedades",
  "/panel/propiedades/nueva",
  "/panel/prospectos",
  "/panel/agenda",
  "/panel/embudos",
  "/panel/importar",
  "/panel/perfil",
  "/panel/integraciones",
];

/**
 * Known violations of the design being replaced (round 3 redesign), excluded explicitly so the
 * gate still catches regressions everywhere else. Each entry: rule id + CSS selector + reason.
 * Remove an entry as soon as the redesign lands; the gate then enforces it.
 */
const KNOWN: { page: string; rule: string; target: string; reason: string }[] = [];

const BLOCKING = new Set(["serious", "critical"]);

type Finding = { page: string; rule: string; impact: string; help: string; targets: string[] };

async function audit(page: Page, name: string, info: TestInfo): Promise<Finding[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const findings: Finding[] = results.violations.map((v) => ({
    page: name,
    rule: v.id,
    impact: v.impact ?? "unknown",
    help: v.help,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  await info.attach(`axe-${name}-${info.project.name}.json`, { body: JSON.stringify(findings, null, 2), contentType: "application/json" });
  for (const f of findings) {
    const known = KNOWN.some((k) => k.page === name && k.rule === f.rule && f.targets.every((t) => t.includes(k.target)));
    const tag = known ? "known" : BLOCKING.has(f.impact) ? "BLOCKING" : "advisory";
    console.log(`[a11y ${info.project.name}] ${tag} ${name} · ${f.impact} · ${f.rule} · ${f.help} · ${f.targets.slice(0, 3).join(" | ")}`);
  }
  return findings.filter(
    (f) => BLOCKING.has(f.impact) && !KNOWN.some((k) => k.page === name && k.rule === f.rule && f.targets.every((t) => t.includes(k.target))),
  );
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(300_000);
  await warmUp(request, [...PUBLIC_PAGES.map((p) => p.path), "/api/auth/get-session", ...PANEL_PAGES]);
});

for (const p of PUBLIC_PAGES) {
  test(`a11y: ${p.name}`, async ({ page }, info) => {
    await page.goto(p.path);
    await p.ready(page);
    expect(await audit(page, p.name, info)).toEqual([]);
  });
}

test("a11y: panel", async ({ page }, info) => {
  // Nine pages in one session; each may compile on first visit under `next dev`.
  test.setTimeout(900_000);
  await login(page);
  const blocking: Finding[] = [];
  for (const path of PANEL_PAGES) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      blocking.push(...(await audit(page, path, info)));
    });
  }
  expect(blocking).toEqual([]);
});
