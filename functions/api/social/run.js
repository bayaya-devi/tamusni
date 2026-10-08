import { json } from '../../_lib/auth.js';
import { runSocialDistribution } from '../../_lib/social-service.js';
export async function onRequestPost(context){
  const expected=context.env.SOCIAL_RUN_TOKEN;if(!expected||context.request.headers.get('authorization')!==`Bearer ${expected}`)return json({error:'Introuvable.'},404);
  try{return json({ok:true,result:await runSocialDistribution(context.env)})}catch(error){console.error('social_run_failed',{name:error?.name,message:error?.message});return json({ok:false,error:'SOCIAL_RUN_FAILED'},500)}
}
