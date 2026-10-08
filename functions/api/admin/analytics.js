import { json, requireAdmin } from "../../_lib/auth.js";

const periods=new Set(["1d","7d","30d","90d"]);
export async function onRequestGet(context) {
  if(!await requireAdmin(context))return json({error:"Accès réservé à l’administration."},403);
  const url=new URL(context.request.url);const period=periods.has(url.searchParams.get("period"))?url.searchParams.get("period"):"30d";
  const days=Number(period.slice(0,-1));const from=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
  const [topViews,topLikes,topSaves,leastViews,trend,totalViews,totalLikes,totalSaves] = await Promise.all([
    context.env.DB.prepare("SELECT c.id,c.slug,c.title,c.type,c.category,COUNT(v.content_id) AS value FROM content_items c LEFT JOIN content_view_sessions v ON v.content_id=c.id AND v.viewed_on>=? WHERE c.status='published' GROUP BY c.id ORDER BY value DESC LIMIT 10").bind(from).all(),
    context.env.DB.prepare("SELECT c.id,c.slug,c.title,c.type,c.category,COUNT(l.content_id) AS value FROM content_items c LEFT JOIN content_likes l ON l.content_id=c.id AND l.created_at>=? WHERE c.status='published' GROUP BY c.id ORDER BY value DESC LIMIT 10").bind(new Date(from).toISOString()).all(),
    context.env.DB.prepare("SELECT c.id,c.slug,c.title,c.type,c.category,COUNT(s.item_id) AS value FROM content_items c LEFT JOIN saved_items s ON s.item_id=c.id AND s.created_at>=? WHERE c.status='published' GROUP BY c.id ORDER BY value DESC LIMIT 10").bind(new Date(from).toISOString()).all(),
    context.env.DB.prepare("SELECT c.id,c.slug,c.title,c.type,c.category,COUNT(v.content_id) AS value FROM content_items c LEFT JOIN content_view_sessions v ON v.content_id=c.id AND v.viewed_on>=? WHERE c.status='published' GROUP BY c.id ORDER BY value ASC,c.published_at DESC LIMIT 10").bind(from).all(),
    context.env.DB.prepare("SELECT viewed_on AS date,COUNT(*) AS views FROM content_view_sessions WHERE viewed_on>=? GROUP BY viewed_on ORDER BY viewed_on").bind(from).all(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM content_view_sessions WHERE viewed_on>=?").bind(from).first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM content_likes WHERE created_at>=?").bind(new Date(from).toISOString()).first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM saved_items WHERE created_at>=?").bind(new Date(from).toISOString()).first()
  ]);
  return json({period,from,totals:{views:Number(totalViews?.count||0),likes:Number(totalLikes?.count||0),favorites:Number(totalSaves?.count||0)},topViews:topViews.results||[],topLikes:topLikes.results||[],topFavorites:topSaves.results||[],leastViews:leastViews.results||[],viewsByDay:trend.results||[]});
}
