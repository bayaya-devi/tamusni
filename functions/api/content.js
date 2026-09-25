import { cleanText, json, requireSession, sameOrigin } from "../_lib/auth.js";

const allowedTypes = new Set(["article", "video", "podcast"]);
const allowedSorts = new Set(["recent", "popular"]);

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const query = cleanText(url.searchParams.get("q"), 120);
  const category = cleanText(url.searchParams.get("category"), 80);
  const author = cleanText(url.searchParams.get("author"), 100);
  const type = cleanText(url.searchParams.get("type"), 20);
  const tag = cleanText(url.searchParams.get("tag"), 80);
  const from = cleanText(url.searchParams.get("from"), 10);
  const to = cleanText(url.searchParams.get("to"), 10);
  const sort = allowedSorts.has(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "recent";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
  const where = ["c.status = 'published'", "c.published_at <= ?"];
  const values = [new Date().toISOString()];
  if (query) { where.push("(LOWER(c.title) LIKE ? OR LOWER(c.excerpt) LIKE ? OR LOWER(c.body) LIKE ?)"); const term = `%${query.toLowerCase()}%`; values.push(term, term, term); }
  if (category) { where.push("LOWER(c.category) = ?"); values.push(category.toLowerCase()); }
  if (author) { where.push("LOWER(c.author_name) LIKE ?"); values.push(`%${author.toLowerCase()}%`); }
  if (allowedTypes.has(type)) { where.push("c.type = ?"); values.push(type); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where.push("c.published_at >= ?"); values.push(`${from}T00:00:00Z`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where.push("c.published_at <= ?"); values.push(`${to}T23:59:59Z`); }
  if (tag) { where.push("EXISTS (SELECT 1 FROM content_tags ct JOIN tags t ON t.id=ct.tag_id WHERE ct.content_id=c.id AND t.slug=?)"); values.push(tag.toLowerCase()); }
  const order = sort === "popular" ? "views DESC, c.published_at DESC" : "c.published_at DESC";
  const sql = `SELECT c.id,c.slug,c.type,c.title,c.excerpt,c.summary,c.category,c.author_name,c.cover_url,c.media_url,c.fact_check_status,c.sponsored,c.sponsor_name,c.published_at,COUNT(DISTINCT v.id) AS views,COUNT(DISTINCT l.actor_key) AS likes FROM content_items c LEFT JOIN content_views v ON v.content_id=c.id LEFT JOIN content_likes l ON l.content_id=c.id WHERE ${where.join(" AND ")} GROUP BY c.id ORDER BY ${order} LIMIT ?`;
  values.push(limit);
  const result = await context.env.DB.prepare(sql).bind(...values).all();
  return json({ items: result.results || [], filters: { query, category, author, type, tag, from, to, sort } });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await context.request.json();
  const query = cleanText(body.query, 120);
  if (!query) return json({ error: "Recherche invalide." }, 400);
  await context.env.DB.prepare("INSERT INTO search_history(id,user_id,query,searched_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(), session.sub, query, new Date().toISOString()).run();
  return json({ ok: true }, 201);
}
