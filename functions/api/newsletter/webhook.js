import { hashToken, json } from "../../_lib/auth.js";

const EVENT_ALIASES = new Map([
  ["unsubscribe", "unsubscribed"],
  ["unsubscribed", "unsubscribed"],
  ["clicked", "click"],
  ["hardbounce", "hard_bounce"],
  ["hard_bounce", "hard_bounce"],
  ["softbounce", "soft_bounce"],
  ["soft_bounce", "soft_bounce"],
]);

function normalizedEvent(payload) {
  const raw = String(payload.event || payload.msg_status || "").trim().toLowerCase();
  return EVENT_ALIASES.get(raw) || raw;
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const authorization = context.request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || null;
  const provided = context.request.headers.get("x-tamusni-webhook-secret") || bearer || url.searchParams.get("token");
  if (!context.env.BREVO_WEBHOOK_SECRET || provided !== context.env.BREVO_WEBHOOK_SECRET) {
    return json({ error: "Not found" }, 404);
  }

  const payload = await context.request.json().catch(() => null);
  if (!payload) return json({ error: "Invalid payload" }, 400);

  const event = normalizedEvent(payload);
  if (!event) return json({ error: "Invalid event" }, 400);

  const campaignId = String(payload.camp_id || payload.campaign_id || "");
  const email = String(payload.email || "").trim().toLowerCase();
  const eventAt = payload.ts_event
    ? new Date(Number(payload.ts_event) * 1000).toISOString()
    : new Date().toISOString();
  const explicitEventId = payload.event_id || payload.eventId || payload.uuid;
  const eventKey = explicitEventId
    ? String(explicitEventId)
    : await hashToken(JSON.stringify([
        payload.id || "",
        campaignId,
        event,
        email,
        payload.ts_event || "",
        payload.URL || "",
      ]));

  const inserted = await context.env.DB.prepare(
    "INSERT OR IGNORE INTO newsletter_events(event_key,campaign_id,event_type,email_hash,url,event_at,created_at) VALUES(?,?,?,?,?,?,?)",
  )
    .bind(
      eventKey,
      campaignId,
      event,
      email ? await hashToken(email) : null,
      String(payload.URL || "").slice(0, 1000) || null,
      eventAt,
      new Date().toISOString(),
    )
    .run();

  const duplicate = Number(inserted.meta?.changes || 0) === 0;
  if (!duplicate && event === "unsubscribed" && email) {
    await context.env.DB.prepare(
      "UPDATE newsletter_subscribers SET status='unsubscribed',unsubscribed_at=?,updated_at=?,brevo_sync_status='unsubscribed' WHERE lower(email)=?",
    )
      .bind(eventAt, new Date().toISOString(), email)
      .run();
  }

  return json({ ok: true, duplicate });
}
