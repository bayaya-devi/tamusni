export const SOCIAL_PLATFORMS=['x','instagram','facebook','youtube'];
export const SOCIAL_STATUSES=['PENDING','PREPARING','READY','SCHEDULED','PUBLISHING','PUBLISHED','FAILED','CANCELLED','SKIPPED'];
export const PLATFORM_DELAYS={x:5,facebook:15,instagram:30,youtube:0};

const plain=(value,max=1000)=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const hashtag=value=>plain(value,50).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'');
export function trackedUrl(origin,slug,platform){const url=new URL(`/fr/articles/${encodeURIComponent(slug)}/`,origin);url.searchParams.set('utm_source',platform);url.searchParams.set('utm_medium','social');url.searchParams.set('utm_campaign','publication');return url.href}
export function formatSocialPost(item,platform,origin){
  const title=plain(item.title,220),excerpt=plain(item.excerpt||item.summary,360),category=hashtag(item.category)||'Technologie';
  const url=trackedUrl(origin,item.slug,platform);
  if(platform==='youtube')return {applicable:item.type==='video'&&Boolean(item.media_url),text:'',url,mediaUrl:item.media_url||null};
  if(platform==='x'){
    const tags=`#${category} #TAMUSNI`;
    const available=Math.max(40,270-url.length-tags.length);
    return {applicable:true,text:`${title.slice(0,available)}\n\n${url}\n${tags}`,url,mediaUrl:item.cover_url||null};
  }
  if(platform==='instagram')return {applicable:true,text:`${title}\n\n${excerpt}\n\nÀ lire sur TAMUSNI — lien dans la bio.\n\n#${category} #Technologie #Innovation #TAMUSNI`,url,mediaUrl:item.cover_url||null};
  return {applicable:true,text:`${title}\n\n${excerpt}\n\nLire l’article sur TAMUSNI : ${url}`,url,mediaUrl:item.cover_url||null};
}
export function nextAttemptAt(attempt,now=new Date()){const minutes=Math.min(240,5*(2**Math.max(0,attempt-1)));return new Date(now.getTime()+minutes*60000).toISOString()}
export function classifyFailure(status){return status===408||status===429||status>=500?'retry':'permanent'}
export function scheduleAt(platform,publishedAt=new Date()){return new Date(new Date(publishedAt).getTime()+(PLATFORM_DELAYS[platform]||0)*60000).toISOString()}
