function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

export function emailProvider(env) {
  if (env.BREVO_API_KEY) return "brevo";
  if (env.RESEND_API_KEY) return "resend";
  return null;
}

function safeAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : []).filter((item) => /^[A-Za-z0-9._-]{1,120}$/.test(String(item?.name || "")) && /^[A-Za-z0-9+/=]+$/.test(String(item?.content || "")) && String(item.content).length <= 7_000_000).slice(0, 3);
}

export async function sendEmail(env, { to, subject, html, text, attachments = [] }) {
  const provider = emailProvider(env);
  if (!provider) throw new Error("EMAIL_NOT_CONFIGURED");
  const files = safeAttachments(attachments);
  if (provider === "brevo") {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: { name: env.BREVO_SENDER_NAME || "TAMUSNI", email: env.BREVO_SENDER_EMAIL || "aetbconseil@gmail.com" }, replyTo: { name: "TAMUSNI", email: "aetbconseil@gmail.com" }, to: [{ email: to }], subject, htmlContent: html, textContent: text || "", ...(files.length ? { attachment: files } : {}) })
    });
    if (!response.ok) throw new Error("EMAIL_REJECTED");
    return "brevo";
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM || "TAMUSNI <aetbconseil@gmail.com>", to: [to], subject, html, text, ...(files.length ? { attachments: files.map((item) => ({ filename: item.name, content: item.content })) } : {}) })
  });
  if (!response.ok) throw new Error("EMAIL_REJECTED");
  return "resend";
}

export function emailLayout(title, content, options = {}) {
  const locale = ["fr", "ar", "en", "es", "pt"].includes(options.locale) ? options.locale : "fr";
  const direction = options.direction === "rtl" ? "rtl" : "ltr";
  return `<!doctype html><html lang="${locale}" dir="${direction}"><body style="margin:0;background:#f8fafc;color:#111a2e;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;background:#fff;padding:36px;border:1px solid #dce1e8;border-radius:16px"><p style="font-size:24px;font-weight:700;letter-spacing:-.03em;margin:0 0 24px;color:#111a2e">TAMUSNI</p><h1 style="font-size:22px;color:#111a2e">${escapeHtml(title)}</h1>${content}<p style="font-size:12px;color:#5c6678;margin-top:28px;border-top:1px solid #dce1e8;padding-top:18px">TAMUSNI · A&amp;B TECHNOLOGIES</p></main></body></html>`;
}

export { escapeHtml };
