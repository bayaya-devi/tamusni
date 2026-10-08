import { readFileSync } from "node:fs";
import { basename } from "node:path";

const [pdfPath, jsonPath] = process.argv.slice(2);
if (!pdfPath || !jsonPath) throw new Error("PDF and JSON paths are required");
const endpoint = process.env.MAINTENANCE_EMAIL_ENDPOINT || "https://tamusni.pages.dev/api/maintenance/report";
const token = process.env.MAINTENANCE_REPORT_TOKEN;
if (!token) throw new Error("MAINTENANCE_REPORT_TOKEN is missing");
const report = JSON.parse(readFileSync(jsonPath, "utf8"));
const pdfBase64 = readFileSync(pdfPath).toString("base64");
const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ filename: basename(pdfPath), pdfBase64, status: report.status, commit: report.versionFinal, date: report.date }), signal: AbortSignal.timeout(60_000) });
const result = await response.json().catch(() => ({}));
if (!response.ok || result.accepted !== true) throw new Error(`Report delivery failed (${response.status}): ${result.error || "unknown"}`);
console.log(JSON.stringify({ accepted: true, provider: result.provider }));
