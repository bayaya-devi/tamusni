import { cleanText, json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const now = new Date().toISOString();
  const polls = await context.env.DB.prepare("SELECT id,question,options_json,closes_at FROM polls WHERE active=1 AND (closes_at IS NULL OR closes_at>?) ORDER BY created_at DESC LIMIT 10").bind(now).all();
  const items = [];
  for (const poll of polls.results || []) {
    const votes = await context.env.DB.prepare("SELECT option_index,COUNT(*) AS count FROM poll_votes WHERE poll_id=? GROUP BY option_index").bind(poll.id).all();
    const counts = Object.fromEntries((votes.results || []).map((vote) => [Number(vote.option_index), Number(vote.count)]));
    let options = [];
    try { options = JSON.parse(poll.options_json); } catch {}
    items.push({ id: poll.id, question: poll.question, options: options.map((label, index) => ({ index, label, votes: counts[index] || 0 })), closesAt: poll.closes_at });
  }
  return json({ items });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise pour voter." }, 401);
  const body = await readBody(context.request);
  const pollId = cleanText(body.pollId, 160);
  const optionIndex = Number(body.optionIndex);
  const poll = await context.env.DB.prepare("SELECT options_json,active,closes_at FROM polls WHERE id=?").bind(pollId).first();
  if (!poll || !poll.active || (poll.closes_at && poll.closes_at <= new Date().toISOString())) return json({ error: "Sondage fermé." }, 400);
  let options = [];
  try { options = JSON.parse(poll.options_json); } catch {}
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) return json({ error: "Réponse invalide." }, 400);
  await context.env.DB.prepare("INSERT INTO poll_votes(poll_id,user_id,option_index,created_at) VALUES(?,?,?,?) ON CONFLICT(poll_id,user_id) DO UPDATE SET option_index=excluded.option_index,created_at=excluded.created_at").bind(pollId, session.sub, optionIndex, new Date().toISOString()).run();
  return json({ ok: true });
}
