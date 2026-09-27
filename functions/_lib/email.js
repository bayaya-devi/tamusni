function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

export function emailProvider(env) {
  if (env.BREVO_API_KEY) return "brevo";
  if (env.RESEND_API_KEY) return "resend";
  return null;
}

export async function sendEmail(env, { to, subject, html, text }) {
  const provider = emailProvider(env);
  if (!provider) throw new Error("EMAIL_NOT_CONFIGURED");
  if (provider === "brevo") {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: { name: env.BREVO_SENDER_NAME || "TAMUSNI", email: env.BREVO_SENDER_EMAIL || "aetbconseil@gmail.com" }, to: [{ email: to }], subject, htmlContent: html, textContent: text || "" })
    });
    if (!response.ok) throw new Error("EMAIL_REJECTED");
    return "brevo";
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM || "TAMUSNI <aetbconseil@gmail.com>", to: [to], subject, html, text })
  });
  if (!response.ok) throw new Error("EMAIL_REJECTED");
  return "resend";
}

export function emailLayout(title, content) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f0ed;color:#323232;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;background:#fff;padding:36px;border:1px solid #ddd0c8"><p style="font-family:Georgia,serif;font-size:24px;margin:0 0 24px">TAMUSNI</p><h1 style="font-size:22px">${escapeHtml(title)}</h1>${content}<p style="font-size:12px;color:#666;margin-top:28px">TAMUSNI · A&amp;B TECHNOLOGIES</p></main></body></html>`;
}

export { escapeHtml };
