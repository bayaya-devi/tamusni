export const NEWSLETTER_LOCALES=["fr","ar","en","es","pt"];

export function normalizeNewsletterLocale(value){
  const locale=String(value||"").toLowerCase().split(/[-_]/)[0];
  return NEWSLETTER_LOCALES.includes(locale)?locale:"fr";
}

export function newsletterClock(date=new Date(),timeZone="Africa/Casablanca"){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,weekday:parts.weekday,hour:Number(parts.hour),minute:Number(parts.minute)};
}

export function sundayCycle(date=new Date(),timeZone="Africa/Casablanca"){
  const clock=newsletterClock(date,timeZone); const noon=new Date(`${clock.date}T12:00:00Z`); const day=noon.getUTCDay();
  const end=new Date(noon); end.setUTCDate(noon.getUTCDate()+(7-day)%7);
  const start=new Date(end); start.setUTCDate(end.getUTCDate()-7);
  const iso=d=>d.toISOString().slice(0,10);
  const endDate=iso(end),startDate=iso(start); const year=Number(endDate.slice(0,4));
  const jan4=new Date(Date.UTC(year,0,4)); const week=Math.ceil((((end-new Date(Date.UTC(year,0,1)))/86400000)+new Date(Date.UTC(year,0,1)).getUTCDay()+1)/7);
  return {cycleKey:`newsletter_${year}-W${String(week).padStart(2,"0")}`,periodStart:`${startDate}T08:00:00`,periodEnd:`${endDate}T08:00:00`,localDate:endDate};
}

export function newsletterDue(date=new Date(),timeZone="Africa/Casablanca"){
  const clock=newsletterClock(date,timeZone); return clock.weekday==="Sun"&&clock.hour===8&&clock.minute<15;
}

export function canAcquireNewsletterRun(status,lockExpires,now=Date.now()){
  return !["SENT","NO_CONTENT"].includes(String(status||""))&&(!lockExpires||Date.parse(lockExpires)<now);
}

export function scoreNewsletterContent(item,periodEnd=Date.now()){
  const ageHours=Math.max(0,(Number(periodEnd)-Date.parse(item.published_at))/3600000);
  const freshness=Math.max(0,35-(ageHours/168)*35);
  const performance=Math.min(20,Math.log2(1+Number(item.views||0))*4)+Math.min(12,Number(item.likes||0)*4)+Math.min(10,Number(item.saves||0)*5);
  const quality=(item.type==="article"?12:7)+Math.min(10,Number(item.source_count||0)*4)+(item.cover_url?4:0)+(String(item.summary||item.excerpt||"").length>=80?4:0);
  return Math.round((freshness+performance+quality)*100)/100;
}

export function selectNewsletterItems(items,{periodEnd=Date.now(),limit=4,exceptionalThreshold=84}={}){
  const scored=items.map(item=>({...item,score:scoreNewsletterContent(item,periodEnd)})).sort((a,b)=>b.score-a.score||Date.parse(b.published_at)-Date.parse(a.published_at));
  const selected=[]; const categories=new Set();
  while(selected.length<limit&&scored.length){
    scored.sort((a,b)=>(b.score-(categories.has(b.category)?10:0))-(a.score-(categories.has(a.category)?10:0)));
    const item=scored.shift(); selected.push(item); categories.add(item.category);
  }
  const exceptional=scored.find(item=>item.score>=exceptionalThreshold&&item.fact_check_status==="verified")||null;
  return {items:selected,exceptional};
}

export const newsletterCopy={
  fr:{subject:"TAMUSNI — L’essentiel de la semaine",preheader:"Les informations technologiques à retenir cette semaine.",edition:"ÉDITION DE LA SEMAINE",read:"Lire l’article",highlight:"ÉVÉNEMENT MARQUANT",manage:"Ne plus recevoir cette revue",privacy:"Confidentialité",intro:"Technologies, sciences et futur — les sujets essentiels sélectionnés par TAMUSNI."},
  ar:{subject:"تاموسني — أهم أخبار الأسبوع",preheader:"أبرز أخبار التكنولوجيا التي تستحق المتابعة هذا الأسبوع.",edition:"إصدار الأسبوع",read:"اقرأ المقال",highlight:"حدث بارز",manage:"إلغاء الاشتراك في هذه النشرة",privacy:"الخصوصية",intro:"التكنولوجيا والعلوم والمستقبل — أهم المواضيع التي اختارتها تاموسني."},
  en:{subject:"TAMUSNI — The week’s essentials",preheader:"The technology stories worth knowing this week.",edition:"WEEKLY EDITION",read:"Read the story",highlight:"MAJOR EVENT",manage:"Unsubscribe from this review",privacy:"Privacy",intro:"Technology, science and the future — the essential stories selected by TAMUSNI."},
  es:{subject:"TAMUSNI — Lo esencial de la semana",preheader:"Las noticias tecnológicas que debes conocer esta semana.",edition:"EDICIÓN SEMANAL",read:"Leer el artículo",highlight:"EVENTO DESTACADO",manage:"Dejar de recibir esta revista",privacy:"Privacidad",intro:"Tecnología, ciencia y futuro: los temas esenciales seleccionados por TAMUSNI."},
  pt:{subject:"TAMUSNI — O essencial da semana",preheader:"As notícias tecnológicas essenciais desta semana.",edition:"EDIÇÃO DA SEMANA",read:"Ler o artigo",highlight:"EVENTO MARCANTE",manage:"Deixar de receber esta revista",privacy:"Privacidade",intro:"Tecnologia, ciência e futuro — os temas essenciais selecionados pela TAMUSNI."}
};
