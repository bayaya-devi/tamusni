type Mail = { to: string | string[]; subject: string; html: string };
export async function sendEmail({ to, subject, html }: Mail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.info(`[email preview] ${subject} -> ${Array.isArray(to) ? to.join(", ") : to}`); return { skipped: true }; }
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM || "TAMUSNI <onboarding@resend.dev>", to, subject, html }) });
  if (!response.ok) throw new Error("Le service d’e-mail n’a pas accepté l’envoi.");
  return response.json();
}
export const escape = (value: string) => value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
