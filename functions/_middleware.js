import { requireAdmin, requireContributor } from "./_lib/auth.js";
import { locales, publicResponse, roleResponse } from "./_lib/public-frontend.js";

const preferredLocale=request=>{
  const language=(request.headers.get('accept-language')||'fr').split(',')[0].split('-')[0].toLowerCase();
  return locales.includes(language)?language:'fr';
};

export async function onRequest(context){
  const requestUrl=new URL(context.request.url);
  const pathname=requestUrl.pathname;
  const readable=context.request.method==='GET'||context.request.method==='HEAD';

  if(readable&&pathname.endsWith('/index.html'))return Response.redirect(new URL(pathname.slice(0,-10)||'/',requestUrl.origin),308);
  if(readable&&(pathname==='/'||pathname==='/index.html'))return Response.redirect(new URL(`/${preferredLocale(context.request)}/`,requestUrl.origin),302);

  const localizedRole=pathname.match(/^\/(fr|ar|en|es|pt)\/(admin|contributeur)\/?$/);
  if(readable&&localizedRole){
    const [,locale,area]=localizedRole;
    if(!pathname.endsWith('/'))return Response.redirect(new URL(`${pathname}/${requestUrl.search}`,requestUrl.origin),308);
    const session=area==='admin'?await requireAdmin(context):await requireContributor(context);
    if(!session)return Response.redirect(new URL(`/${locale}/connexion/?next=${encodeURIComponent(pathname)}`,requestUrl.origin),302);
    return roleResponse(locale,area==='admin'?'ADMIN':'CONTRIBUTOR',session,requestUrl.origin);
  }

  if(readable&&(pathname==='/admin/'||pathname==='/admin')){
    const session=await requireAdmin(context);
    const locale=preferredLocale(context.request);
    if(!session)return Response.redirect(new URL(`/${locale}/connexion/?next=${encodeURIComponent(`/${locale}/admin/`)}`,requestUrl.origin),302);
    return Response.redirect(new URL(`/${locale}/admin/${requestUrl.search}`,requestUrl.origin),308);
  }
  if(readable&&(pathname==='/contributeur/'||pathname==='/contributeur')){
    const session=await requireContributor(context);
    const locale=preferredLocale(context.request);
    if(!session)return Response.redirect(new URL(`/${locale}/connexion/?next=${encodeURIComponent(`/${locale}/contributeur/`)}`,requestUrl.origin),302);
    return Response.redirect(new URL(`/${locale}/contributeur/${requestUrl.search}`,requestUrl.origin),308);
  }

  if(readable){
    const match=pathname.match(/^\/(fr|ar|en|es|pt)(?:\/(.*))?$/);
    if(match){
      const locale=match[1];const rest=match[2]||'';
      const path=rest&&!rest.endsWith('/')?`${rest}/`:rest;
      if(rest&&!rest.endsWith('/')&&!rest.includes('.'))return Response.redirect(new URL(`/${locale}/${path}${requestUrl.search}`,requestUrl.origin),308);
      const rendered=await publicResponse(context,locale,path);
      if(rendered)return rendered;
    }
    const legacy=pathname.match(/^\/(intelligence-artificielle|innovation|robotique|cybersecurite|espace|articles\/[^/]+|a-propos|contact|methodologie-editoriale|politique-ia|politique-corrections|mentions-legales|confidentialite|cookies|conditions-utilisation|mon-espace)\/?$/);
    if(legacy)return Response.redirect(new URL(`/fr/${legacy[1]}/`,requestUrl.origin),308);
    if(pathname==='/connexion/'||pathname==='/inscription/')return publicResponse(context,'fr',pathname.slice(1));
    if(pathname==='/compte/')return Response.redirect(new URL('/fr/mon-espace/',requestUrl.origin),308);
    if(pathname==='/mot-de-passe-oublie/')return Response.redirect(new URL('/fr/connexion/',requestUrl.origin),308);
    if(pathname==='/reinitialiser-mot-de-passe/'||pathname==='/verifier-email/')return Response.redirect(new URL(`/fr${pathname}${requestUrl.search}`,requestUrl.origin),308);
    if(pathname==='/forums/'||pathname==='/recherche/'||pathname==='/404.html'||pathname==='/500.html')return publicResponse(context,'fr',pathname.slice(1));
  }

  const response=await context.next();
  if(!response.headers.get('content-type')?.includes('text/html'))return response;
  const headers=new Headers(response.headers);
  headers.set('Strict-Transport-Security','max-age=31536000');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
