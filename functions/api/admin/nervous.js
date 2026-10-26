import { cleanText, json, readBody, requireAdmin, sameOrigin } from '../../_lib/auth.js';
import { allowedConfig } from '../../_lib/nervous-core.js';
const empty = () => ({ results: [] });
const quietly = async (statement) => {
  try { return await statement.all(); } catch { return empty(); }
};

export async function onRequestGet(context){
  if(!await requireAdmin(context))return json({error:'Accès réservé à l’administration.'},403);
  const db=context.env.DB;
  const now=new Date();
  const staleAt=new Date(now.getTime()-10*60*1000).toISOString();
  const [events,signals,config,decisions,runs,metrics,campaigns,jobs,heartbeats,lastPublication]=await Promise.all([
    db.prepare('SELECT event_type,COUNT(*) count FROM nervous_events WHERE created_at>=? GROUP BY event_type ORDER BY count DESC LIMIT 12').bind(new Date(now.getTime()-86400000).toISOString()).all(),
    db.prepare("SELECT * FROM radar_signals WHERE status<>'resolved' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,detected_at DESC LIMIT 30").all(),
    db.prepare('SELECT * FROM algorithm_config ORDER BY config_key').all(),
    db.prepare('SELECT engine,version,decision_type,score,reason_json,created_at FROM algorithm_decisions ORDER BY created_at DESC LIMIT 25').all(),
    db.prepare('SELECT * FROM nervous_system_runs ORDER BY started_at DESC LIMIT 15').all(),
    db.prepare('SELECT * FROM nervous_daily_metrics ORDER BY metric_date DESC,value DESC LIMIT 60').all(),
    db.prepare('SELECT status,COUNT(*) count FROM business_campaigns GROUP BY status').all(),
    quietly(db.prepare("SELECT status,waiting_reason,claimed_by,scheduled_for,lock_expires_at,completed_at FROM automation_jobs WHERE job_type='editorial_publication' ORDER BY scheduled_for ASC LIMIT 500")),
    quietly(db.prepare('SELECT * FROM automation_agent_heartbeats ORDER BY last_seen_at DESC LIMIT 5')),
    quietly(db.prepare("SELECT scheduled_for,completed_at,generation_source FROM automation_jobs WHERE job_type='editorial_publication' AND status='completed' ORDER BY completed_at DESC LIMIT 1")),
  ]);
  const editorialJobs=jobs.results||[];
  const newestAgent=(heartbeats.results||[])[0]||null;
  const onlineAgent=Boolean(newestAgent&&newestAgent.status!=='offline'&&newestAgent.last_seen_at>=staleAt);
  const waiting=editorialJobs.filter(job=>job.status!=='completed');
  const locked=waiting.filter(job=>job.status==='running'&&job.lock_expires_at>now.toISOString()).length;
  const quotaBlocked=waiting.filter(job=>job.waiting_reason==='AI_QUOTA_EXHAUSTED').length;
  const cloudStatus=quotaBlocked?'Limité':'Disponible';
  return json({
    events:events.results||[],signals:signals.results||[],config:config.results||[],decisions:decisions.results||[],runs:runs.results||[],metrics:metrics.results||[],campaigns:campaigns.results||[],
    automationCapacity:{
      cloudStatus,
      localAgent:onlineAgent?'En ligne':'Hors ligne',
      localAgentLastSeen:newestAgent?.last_seen_at||null,
      queueCount:waiting.length,
      oldestOverdue:waiting[0]?.scheduled_for||null,
      lockedCount:locked,
      waitingAiCount:quotaBlocked,
      lastPublication:(lastPublication.results||[])[0]||null,
    },
  });
}
export async function onRequestPatch(context){if(!sameOrigin(context.request))return json({error:'Origine refusée.'},403);const admin=await requireAdmin(context);if(!admin)return json({error:'Accès réservé à l’administration.'},403);const body=await readBody(context.request);if(body.action==='config'){const key=cleanText(body.key,80),row=await context.env.DB.prepare('SELECT * FROM algorithm_config WHERE config_key=?').bind(key).first(),value=allowedConfig(key,body.value,row);if(value===null)return json({error:'Valeur hors limites.'},400);await context.env.DB.batch([context.env.DB.prepare('UPDATE algorithm_config SET numeric_value=?,updated_at=? WHERE config_key=?').bind(value,new Date().toISOString(),key),context.env.DB.prepare('INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),admin.sub,'nervous_config_updated','algorithm_config',key,JSON.stringify({value}),new Date().toISOString())]);return json({ok:true});}if(body.action==='signal'){const id=cleanText(body.id,100),status=['acknowledged','resolved'].includes(body.status)?body.status:'';if(!id||!status)return json({error:'Action invalide.'},400);await context.env.DB.prepare("UPDATE radar_signals SET status=?,resolved_at=CASE WHEN ?='resolved' THEN ? ELSE resolved_at END WHERE id=?").bind(status,status,new Date().toISOString(),id).run();return json({ok:true});}return json({error:'Action invalide.'},400);}
