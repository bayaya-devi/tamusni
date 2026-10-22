import { hashToken, json, readBody } from "../../_lib/auth.js";
import { claimPersistentMaintenance, maintenanceAutomationStatus, settlePersistentMaintenance } from "../../_lib/maintenance-automation.js";

async function authorized(request,expected){
  const value=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||"";
  return Boolean(expected&&value)&&await hashToken(value)===await hashToken(expected);
}

export async function onRequestPost(context){
  if(!await authorized(context.request,context.env.MAINTENANCE_RUN_TOKEN))return json({error:"Not found"},404);
  const mode=new URL(context.request.url).searchParams.get("mode")||"claim";
  try{
    if(mode==="claim"){
      const result=await claimPersistentMaintenance(context.env);
      return json({ok:true,localDate:result.localDate,job:result.job?{id:result.job.id,lockToken:result.job.lock_token,attemptCount:result.job.attempt_count,scheduledFor:result.job.scheduled_for}:null});
    }
    if(mode==="status")return json({ok:true,jobs:await maintenanceAutomationStatus(context.env.DB)});
    if(mode!=="complete")return json({error:"Invalid mode"},400);
    const body=await readBody(context.request);
    const result=await settlePersistentMaintenance(context.env,{jobId:String(body.jobId||""),lockToken:String(body.lockToken||""),ok:body.ok===true,result:body.result,error:String(body.error||"")});
    return json({ok:true,result});
  }catch(error){
    console.error("maintenance_job_failed",error?.message||error);
    return json({ok:false,error:"Maintenance job unavailable",code:String(error?.message||"UNKNOWN").slice(0,120)},500);
  }
}
