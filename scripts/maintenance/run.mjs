import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const startedAt = new Date();
const outputDir = resolve(process.env.MAINTENANCE_OUTPUT_DIR || "artifacts/maintenance");
mkdirSync(outputDir, { recursive: true });
const npm = "npm";
const node = process.execPath;
const checks = [];

function execute(name, command, args, timeout = 20 * 60_000) {
  const windowsNpm = process.platform === "win32" && command === npm;
  const executable = windowsNpm ? process.env.ComSpec : command;
  const commandArgs = windowsNpm ? ["/d", "/s", "/c", "npm", ...args] : args;
  const result = spawnSync(executable, commandArgs, { cwd: resolve("."), env: process.env, encoding: "utf8", timeout, maxBuffer: 25 * 1024 * 1024 });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  writeFileSync(resolve(outputDir, `${name}.log`), `${stdout}\n${stderr}`);
  const check = { name, ok: result.status === 0, exitCode: result.status ?? -1, durationMs: 0, summary: `${result.error?.message || ""}\n${stdout}\n${stderr}`.trim().split(/\r?\n/).slice(-8).join("\n") };
  checks.push(check);
  return { ...result, stdout, stderr, check };
}

const commandStarted = Date.now();
for (const [name, command, args, timeout] of [
  ["unit", npm, ["test"]],
  ["typecheck", npm, ["run", "typecheck"]],
  ["lint", npm, ["run", "lint"]],
  ["build", npm, ["run", "build"], 25 * 60_000],
  ["runtime-audit", npm, ["audit", "--omit=dev", "--json"]],
  ["e2e-production", node, ["node_modules/@playwright/test/cli.js", "test", "--workers=2"], 25 * 60_000]
]) {
  const before = Date.now();
  const result = execute(name, command, args, timeout);
  result.check.durationMs = Date.now() - before;
}

async function fetchRecord(url, options = {}) {
  const before = performance.now();
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), ...options });
    const body = await response.text();
    return { url, status: response.status, ok: response.status >= 200 && response.status < 400, durationMs: Math.round(performance.now() - before), headers: Object.fromEntries(["content-type", "strict-transport-security", "content-security-policy"].map((key) => [key, response.headers.get(key)])), body: body.slice(0, 1000) };
  } catch (error) {
    return { url, status: 0, ok: false, durationMs: Math.round(performance.now() - before), error: String(error?.message || error) };
  }
}

const site = process.env.TAMUSNI_TEST_URL || "https://tamusni.pages.dev";
const routes = ["/fr/", "/en/", "/ar/", "/fr/intelligence-artificielle/", "/fr/connexion/", "/fr/a-propos/", "/fr/confidentialite/", "/robots.txt", "/sitemap.xml"];
const routeChecks = await Promise.all(routes.map((path) => fetchRecord(`${site}${path}`)));
const backend = await fetchRecord(`${site}/api/backend-status`);
const worker = await fetchRecord(process.env.EDITORIAL_HEALTH_URL || "https://tamusni-editorial-automation.aetbconseil.workers.dev/health");
const notFound = await fetchRecord(`${site}/fr/maintenance-url-inexistante/`);

let sitemap = { checked: 0, failures: [] };
const sitemapResponse = await fetch(`${site}/sitemap.xml`, { signal: AbortSignal.timeout(20_000) });
if (sitemapResponse.ok) {
  const xml = await sitemapResponse.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  let cursor = 0;
  const failures = [];
  async function sitemapWorker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      const result = await fetchRecord(url);
      if (result.status !== 200) failures.push({ url, status: result.status, error: result.error || null });
    }
  }
  await Promise.all(Array.from({ length: 8 }, sitemapWorker));
  sitemap = { checked: urls.length, failures };
}

const performanceResults = [];
try {
  const browser = await chromium.launch({ headless: true });
  for (const item of [{ name: "home-mobile", path: "/fr/", width: 390, height: 780 }, { name: "home-desktop", path: "/fr/", width: 1440, height: 900 }, { name: "home-ar", path: "/ar/", width: 390, height: 780 }]) {
    const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
    await page.addInitScript(() => { window.__tmVitals = { cls: 0, lcp: 0 }; new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__tmVitals.cls += entry.value; }).observe({ type: "layout-shift", buffered: true }); new PerformanceObserver((list) => { const entries = list.getEntries(); window.__tmVitals.lcp = entries.at(-1)?.startTime || 0; }).observe({ type: "largest-contentful-paint", buffered: true }); });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error.message || error)));
    const response = await page.goto(`${site}${item.path}`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(400);
    const metric = await page.evaluate(() => { const nav = performance.getEntriesByType("navigation")[0]; const resources = performance.getEntriesByType("resource"); return { ttfb: Math.round(nav.responseStart), load: Math.round(nav.loadEventEnd), lcp: Math.round(window.__tmVitals.lcp), cls: Number(window.__tmVitals.cls.toFixed(4)), transferKb: Math.round((nav.transferSize + resources.reduce((sum, entry) => sum + entry.transferSize, 0)) / 1024), overflow: document.documentElement.scrollWidth - innerWidth, dir: document.documentElement.dir }; });
    performanceResults.push({ ...item, status: response?.status() || 0, errors, ...metric });
    await page.close();
  }
  await browser.close();
} catch (error) {
  performanceResults.push({ name: "performance", status: 0, errors: [String(error?.message || error)] });
}

const anomalies = [];
const roleSecrets = ["TAMUSNI_USER_EMAIL", "TAMUSNI_USER_PASSWORD", "TAMUSNI_CONTRIBUTOR_EMAIL", "TAMUSNI_CONTRIBUTOR_PASSWORD", "TAMUSNI_ADMIN_EMAIL", "TAMUSNI_ADMIN_PASSWORD"];
if (roleSecrets.some((name) => !process.env[name])) anomalies.push({ id: "ROLE-CREDENTIALS", service: "Tests des rôles", severity: "P2", description: "Un ou plusieurs comptes de recette ne sont pas configurés dans la CI.", cause: "Secret GitHub absent", status: "OUVERT" });
for (const check of checks.filter((item) => !item.ok)) anomalies.push({ id: `CHECK-${check.name.toUpperCase()}`, service: check.name, severity: ["unit", "build", "e2e-production"].includes(check.name) ? "P1" : "P2", description: "Contrôle automatisé en échec.", cause: check.summary.slice(0, 600), status: "OUVERT" });
for (const route of routeChecks.filter((item) => !item.ok)) anomalies.push({ id: "HTTP-ROUTE", service: route.url, severity: "P1", description: `Route indisponible (${route.status}).`, cause: route.error || "Réponse HTTP inattendue", status: "OUVERT" });
if (backend.status !== 200) anomalies.push({ id: "BACKEND-HEALTH", service: "Cloudflare/Supabase", severity: "P1", description: "Backend dégradé.", cause: backend.body || backend.error, status: "OUVERT" });
if (worker.status !== 200) anomalies.push({ id: "EDITORIAL-HEALTH", service: "TAMUSNI WATCH", severity: "P1", description: "Worker éditorial indisponible.", cause: worker.body || worker.error, status: "OUVERT" });
if (notFound.status !== 404) anomalies.push({ id: "HTTP-404", service: "Page d’erreur", severity: "P2", description: `Une URL inconnue retourne ${notFound.status} au lieu de 404.`, cause: "Routage", status: "OUVERT" });
for (const failure of sitemap.failures.slice(0, 30)) anomalies.push({ id: "SITEMAP-URL", service: failure.url, severity: "P2", description: `URL du sitemap en statut ${failure.status}.`, cause: failure.error || "Statut HTTP inattendu", status: "OUVERT" });
for (const metric of performanceResults) {
  if (metric.overflow > 1 || metric.errors?.length) anomalies.push({ id: "FRONTEND-RUNTIME", service: metric.name, severity: "P2", description: "Débordement ou exception JavaScript détecté.", cause: JSON.stringify({ overflow: metric.overflow, errors: metric.errors }), status: "OUVERT" });
}

const commit = execute("git-version", "git", ["rev-parse", "HEAD"]).stdout.trim();
const status = anomalies.some((item) => item.severity === "P0" || item.severity === "P1") ? "MAINTENANCE PARTIELLEMENT RÉUSSIE" : anomalies.length ? "MAINTENANCE RÉUSSIE AVEC RÉSERVES" : "MAINTENANCE RÉUSSIE";
const report = { schemaVersion: 1, date: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(startedAt), startedAt: startedAt.toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt.getTime(), versionInitial: commit, versionFinal: commit, status, deployment: { environment: "production", site, verified: routeChecks.every((item) => item.ok), commitAssociation: "non vérifiable sans API Cloudflare dans la CI" }, checks, routes: routeChecks, backend, worker, notFound: { status: notFound.status }, sitemap, performance: performanceResults, anomalies, corrections: [], limitations: ["Aucun agent de correction de code autonome n’est configuré dans GitHub Actions.", "Les tests agressifs et destructifs sont exclus de la production."] };
writeFileSync(resolve(outputDir, "maintenance.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status, anomalies: anomalies.length, checks: checks.length, sitemap: sitemap.checked, durationMs: Date.now() - commandStarted }));
