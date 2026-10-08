import { hashToken, json, readBody } from "../../_lib/auth.js";
import { emailLayout, emailProvider, escapeHtml, sendEmail } from "../../_lib/email.js";

async function authorized(request, expected) {
  const provided = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !provided) return false;
  return await hashToken(provided) === await hashToken(expected);
}

export async function onRequestPost(context) {
  if (!await authorized(context.request, context.env.MAINTENANCE_REPORT_TOKEN)) return json({ error: "Not found" }, 404);
  if (!emailProvider(context.env)) return json({ error: "Email unavailable" }, 503);
  try {
    const body = await readBody(context.request, 7_500_000);
    const filename = String(body.filename || "");
    const content = String(body.pdfBase64 || "");
    const status = String(body.status || "INCONNU").slice(0, 80);
    const commit = String(body.commit || "non renseigné").slice(0, 80);
    const date = String(body.date || new Date().toISOString().slice(0, 10)).slice(0, 20);
    if (!/^TAMUSNI_Maintenance_\d{4}-\d{2}-\d{2}\.pdf$/.test(filename) || content.length < 1000 || content.length > 7_000_000 || !/^[A-Za-z0-9+/=]+$/.test(content)) return json({ error: "Invalid report" }, 400);
    if (!atob(content.slice(0, 16)).startsWith("%PDF-")) return json({ error: "Invalid PDF" }, 400);
    const subject = `TAMUSNI — Rapport de maintenance hebdomadaire — ${date}`;
    const text = `Bonjour,\n\nVeuillez trouver ci-joint le rapport de maintenance hebdomadaire de TAMUSNI.\n\nÉtat de la maintenance : ${status}\nVersion contrôlée : ${commit}\nSite : https://tamusni.pages.dev/\n\nCordialement,\nSystème de maintenance automatisée TAMUSNI`;
    const html = emailLayout("Rapport de maintenance hebdomadaire", `<p>Bonjour,</p><p>Veuillez trouver ci-joint le rapport de maintenance hebdomadaire de TAMUSNI.</p><p><strong>État :</strong> ${escapeHtml(status)}<br><strong>Version contrôlée :</strong> ${escapeHtml(commit)}</p><p><a href="https://tamusni.pages.dev/">Ouvrir TAMUSNI</a></p>`);
    const provider = await sendEmail(context.env, { to: context.env.MAINTENANCE_REPORT_TO || "aetbconseil@gmail.com", subject, html, text, attachments: [{ name: filename, content }] });
    return json({ ok: true, provider, accepted: true });
  } catch (error) {
    console.error("maintenance_report_email_failed", String(error?.message || error));
    return json({ error: "Report delivery failed" }, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 502);
  }
}
