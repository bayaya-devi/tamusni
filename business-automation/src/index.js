async function processCampaigns(env, now = new Date()) {
  const iso = now.toISOString();
  const due = await env.DB.prepare("SELECT id,duration_days FROM business_campaigns WHERE status='scheduled' AND scheduled_start_at<=? ORDER BY scheduled_start_at LIMIT 100").bind(iso).all();
  const expiring = await env.DB.prepare("SELECT id FROM business_campaigns WHERE status='active' AND ends_at<=? ORDER BY ends_at LIMIT 100").bind(iso).all();
  const statements = [];
  for (const campaign of due.results || []) {
    const endsAt = new Date(now.getTime() + Number(campaign.duration_days) * 86_400_000).toISOString();
    statements.push(
      env.DB.prepare("UPDATE business_campaigns SET status='active',started_at=?,ends_at=?,updated_at=? WHERE id=? AND status='scheduled'").bind(iso,endsAt,iso,campaign.id),
      env.DB.prepare("INSERT INTO business_campaign_events(id,campaign_id,event_type,detail_json,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),campaign.id,"activated",JSON.stringify({endsAt}),iso)
    );
  }
  for (const campaign of expiring.results || []) {
    statements.push(
      env.DB.prepare("UPDATE business_campaigns SET status='completed',updated_at=? WHERE id=? AND status='active'").bind(iso,campaign.id),
      env.DB.prepare("INSERT INTO business_campaign_events(id,campaign_id,event_type,detail_json,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),campaign.id,"completed","{}",iso)
    );
  }
  const yesterday = new Date(now.getTime()-86_400_000).toISOString().slice(0,10);
  statements.push(env.DB.prepare("UPDATE business_campaign_metrics SET impressions_consolidated=impressions_provisional,clicks_consolidated=clicks_provisional,consolidated_at=?,updated_at=? WHERE metric_date<=? AND consolidated_at IS NULL").bind(iso,iso,yesterday));
  if(statements.length)await env.DB.batch(statements);
  return {activated:(due.results||[]).length,completed:(expiring.results||[]).length,consolidatedThrough:yesterday};
}

const worker = {
  async scheduled(_controller,env,ctx){ctx.waitUntil(processCampaigns(env));},
  async fetch(request,env){
    const url=new URL(request.url);if(url.pathname!=="/health")return new Response("Not found",{status:404});
    return Response.json({ok:true,worker:"tamusni-business-automation",time:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
  }
};

export { processCampaigns };
export default worker;
