import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicResponse, roleResponse } from '../functions/_lib/public-frontend.js';
import { emailLayout } from '../functions/_lib/email.js';
import { onRequestGet as publicContent } from '../functions/api/content.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import { adsEnabled, adsenseClient, adsensePublisher } from '../functions/_lib/ads-config.js';
import { onRequestGet as adsTxt } from '../functions/ads.txt.js';

test('transactional emails use the new brand palette', () => {
  const html=emailLayout('Confirmer mon adresse','<p>Essai</p>');
  assert.match(html, /#111a2e/);
  assert.match(html, /#f8fafc/);
  assert.doesNotMatch(html, /#ddd0c8|#f4f0ed/i);
});

test('legacy Pages and www hosts redirect public paths to the canonical domain', async () => {
  for (const origin of ['https://tamusni.pages.dev', 'https://www.tamusni.science']) {
    const response = await middleware({ request: new Request(`${origin}/fr/articles/essai-source/?ref=legacy`), env: { PUBLIC_SITE_URL: 'https://tamusni.science' } });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), 'https://tamusni.science/fr/articles/essai-source/?ref=legacy');
  }
});

test('AdSense uses one Cloudflare configuration and stays off until explicitly enabled', async () => {
  const env = { ADSENSE_CLIENT_ID: 'ca-pub-6628181824999575' };
  assert.equal(adsenseClient(env), 'ca-pub-6628181824999575');
  assert.equal(adsensePublisher(env), 'pub-6628181824999575');
  assert.equal(adsEnabled(env), false);
  assert.equal(adsEnabled({ ...env, ADS_ENABLED: 'true' }), true);
  assert.equal(adsenseClient({ ADSENSE_CLIENT_ID: 'invalid' }), '');
  const configured = await adsTxt({ env });
  assert.equal(await configured.text(), 'google.com, pub-6628181824999575, DIRECT, f08c47fec0942fa0\n');
  const missing = await adsTxt({ env: {} });
  assert.match(await missing.text(), /not configured/i);
});

test('public content lists use safe localized translations and include all editorial formats', async () => {
  const statements=[];
  const DB={prepare(sql){return{bind(...values){statements.push({sql,values});return this;},async all(){return{results:[]};}};}};
  const request=new Request('https://tamusni.pages.dev/api/content?lang=es&type=brief&q=ciencia');
  const response=await publicContent({request,env:{DB}});
  assert.equal(response.status,200);
  const statement=statements.find(item=>item.sql.startsWith('SELECT c.id,c.slug,c.type'));
  assert.ok(statement);
  assert.match(statement.sql,/content_translations_extra t ON t\.content_id=c\.id AND t\.locale=\?/);
  assert.match(statement.sql,/COALESCE\(t\.title,c\.title\) AS title/);
  assert.match(statement.sql,/c\.type = \?/);
  assert.equal(statement.values[0],'es');
  assert.ok(statement.values.includes('brief'));
});

const sample = {id:'content-1',slug:'essai-source',type:'article',title:'Une actualité vérifiée',excerpt:'Un résumé sourcé.',body:'Un contenu sourcé.',summary:'',category:'Intelligence',author_name:'Rédigé par IA',cover_url:'/images/editorial-ai-space.svg',published_at:'2026-10-06T12:00:00.000Z',views:10,likes:2};
function context(path) {
  const db = {prepare(sql) { return { bind(...values) { return {
    async first() {
      if(sql.includes('FROM content_items WHERE slug=')) return values[0]===sample.slug?sample:null;
      if(sql.includes('FROM content_translations')) return values[1]==='fr'?{title:sample.title,excerpt:sample.excerpt,body:sample.body,summary:''}:null;
      if(sql.includes('AS views')) return {views:10,likes:2};
      return null;
    },
    async all() {
      if(sql.includes('FROM content_sources')) return {results:[{label:'Source officielle',url:'https://example.org/article',publisher:'Exemple'}]};
      if(sql.includes('FROM content_items c LEFT JOIN')) return {results:[{...sample,localized_title:sample.title,localized_excerpt:sample.excerpt}]};
      return {results:[]};
    }
  }; } }; }};
  return {request:new Request(`https://tamusni.pages.dev${path}`),env:{DB:db,PUBLIC_SITE_URL:'https://tamusni.pages.dev'}};
}

test('AdSense markup is opt-in and its runtime requires an external TCF consent signal', async () => {
  const disabled = await publicResponse(context('/fr/'), 'fr', '');
  const disabledHtml = await disabled.text();
  assert.doesNotMatch(disabledHtml, /google-adsense-account|data-ad-slot|ads-client\.js|consent\.js/);
  assert.doesNotMatch(disabled.headers.get('content-security-policy'), /googlesyndication/);
  assert.match(disabled.headers.get('content-security-policy'), /challenges\.cloudflare\.com/);

  const enabledContext = context('/fr/');
  enabledContext.env = { ...enabledContext.env, ADSENSE_CLIENT_ID: 'ca-pub-6628181824999575', ADS_ENABLED: 'true' };
  const enabled = await publicResponse(enabledContext, 'fr', '');
  const enabledHtml = await enabled.text();
  assert.match(enabledHtml, /google-adsense-account" content="ca-pub-6628181824999575/);
  assert.match(enabledHtml, /data-ad-slot="mid-page"/);
  assert.match(enabledHtml, /consent\.js\?v=3/);
  assert.match(enabledHtml, /ads-client\.js\?v=3/);
  assert.match(enabled.headers.get('content-security-policy'), /pagead2\.googlesyndication\.com/);

  const consentSource = await (await import('node:fs/promises')).readFile(new URL('../Site web/consent.js', import.meta.url), 'utf8');
  const adsClientSource = await (await import('node:fs/promises')).readFile(new URL('../Site web/ads-client.js', import.meta.url), 'utf8');
  assert.match(consentSource, /__tcfapi/);
  assert.doesNotMatch(consentSource, /localStorage/);
  assert.match(adsClientSource, /tamusni-consent-ready/);
  assert.doesNotMatch(adsClientSource, /localStorage/);
});

for(const locale of ['fr','ar','en','es','pt']){
  test(`homepage ${locale} has a localized shell`,async()=>{
    const response=await publicResponse(context(`/${locale}/`),locale,'');
    assert.equal(response.status,200);
    const html=await response.text();
    assert.match(html,new RegExp(`<html lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"`));
    assert.match(html,/class="site-header"/);
    assert.match(html,/class="site-footer"/);
    assert.doesNotMatch(html,/tamusni-rail/);
    assert.doesNotMatch(html,/theme-toggle|tamusni-theme/);
    assert.match(html,/matchMedia\('\(prefers-color-scheme:dark\)'\)/);
    assert.match(html,new RegExp(`\/brand\/tamusni-${locale==='ar'?'ar':'latin'}\.png`));
    assert.match(html,/hreflang="es"/);
    assert.doesNotMatch(html,/data-ad-slot|ads-client\.js|consent\.js/);
    assert.equal((html.match(/type="email"/g)||[]).length,0);
    assert.doesNotMatch(html,/newsletter-form|newsletter-section|newsletter-honeypot/);
  });
}

for(const locale of ['fr','ar','en','es','pt']){
  for(const role of ['ADMIN','CONTRIBUTOR']){
    test(`${role.toLowerCase()} shell is shared and localized in ${locale}`,async()=>{
      const response=roleResponse(locale,role,{sub:'test',email:'test@example.com',role},'https://tamusni.pages.dev');
      assert.equal(response.status,200);
      assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
      const html=await response.text();
      assert.match(html,new RegExp(`<html lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"`));
      assert.match(html,/class="site-header"/);
      assert.match(html,/class="site-footer"/);
      assert.match(html,/role-frontend\.css/);
      assert.match(html,new RegExp(`/${locale}/${role==='ADMIN'?'admin':'contributeur'}/`));
      assert.doesNotMatch(html,/tamusni-rail|site-shell\.css/);
    });
  }
}

test('article cites its actual source and escapes user-facing text',async()=>{
  const response=await publicResponse(context('/fr/articles/essai-source/'),'fr','articles/essai-source/');
  const html=await response.text();
  assert.match(html,/Source officielle/);
  assert.match(html,/https:\/\/example\.org\/article/);
  assert.match(html,/Une actualité vérifiée/);
  assert.match(html,/class="article-actions/);
  assert.match(html,/application\/ld\+json/);
  assert.match(html,/"@type":"Article"/);
});

test('institutional pages and localized 404 are rendered by the shared shell',async()=>{
  const about=await publicResponse(context('/fr/a-propos/'),'fr','a-propos/');
  assert.equal(about.status,200);
  assert.match(await about.text(),/À propos de TAMUSNI/);
  const missing=await publicResponse(context('/fr/introuvable/'),'fr','introuvable/');
  assert.equal(missing.status,404);
  assert.match(await missing.text(),/noindex,follow/);
});

test('rubric search is scoped to its category',async()=>{
  const response=await publicResponse(context('/fr/intelligence-artificielle/?q=source'),'fr','intelligence-artificielle/');
  assert.match(await response.text(),/Intelligence artificielle/);
});

test('global search is localized, searchable and uses the shared shell',async()=>{
  const response=await publicResponse(context('/fr/recherche/?q=actualite'),'fr','recherche/');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/id="global-query"/);
  assert.match(html,/action="\/fr\/recherche\/"/);
  assert.match(html,/class="site-header"/);
  assert.match(html,/class="site-footer"/);
  assert.match(html,/noindex,follow/);
});

test('signup and login preserve their forms and OAuth links',async()=>{
  for(const page of ['connexion/','inscription/']){
    const response=await publicResponse(context(`/fr/${page}`),'fr',page);
    const html=await response.text();
    assert.match(html,/\/api\/auth\/oauth\?provider=google/);
    assert.match(html,/locale=fr/);
    assert.match(html,/\/brand\/google\.png/);
    assert.match(html,/type="password"/);
  }
});

test('authentication is independent of newsletter consent',async()=>{
  const signup=await publicResponse(context('/fr/inscription/?newsletter=1'),'fr','inscription/');
  const login=await publicResponse(context('/fr/connexion/?newsletter=1'),'fr','connexion/');
  for(const response of [signup,login]){
    const html=await response.text();
    assert.doesNotMatch(html,/newsletterConsent|newsletter=1|tamusni_newsletter_intent/);
  }
});

test('signup supports multiple preferred topics',async()=>{
  const response=await publicResponse(context('/fr/inscription/'),'fr','inscription/');
  const html=await response.text();
  assert.match(html,/name="preferredTopics"/);
  assert.doesNotMatch(html,/name="preferredTopic"/);
  assert.match(html,/Choisissez au moins une rubrique/);
});

test('the shared client exposes only the official social accounts',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../Site web/frontend.js',import.meta.url),'utf8'));
  assert.match(source,/https:\/\/x\.com\/getbnhdh89514/);
  assert.match(source,/https:\/\/www\.instagram\.com\/tam\.usni\//);
  assert.match(source,/https:\/\/web\.facebook\.com\/profile\.php\?id=61595345005345/);
  assert.match(source,/https:\/\/www\.youtube\.com\/@Tamusni-i7h/);
});

test('shared navigation keeps native links deterministic and preserves article identity across languages',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../Site web/frontend.js',import.meta.url),'utf8'));
  const css=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../Site web/frontend.css',import.meta.url),'utf8'));
  assert.doesNotMatch(source,/document\.addEventListener\('click',event=>/);
  assert.doesNotMatch(source,/navigationTimer/);
  assert.match(source,/location\.assign\(next\.href\)/);
  assert.match(source,/preserveScroll:true/);
  assert.match(css,/--motion-base:220ms/);
  assert.doesNotMatch(css,/html\.is-page-leaving #main/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('back-to-top resets the document scrolling element directly',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../Site web/frontend.js',import.meta.url),'utf8'));
  assert.match(source,/function returnToTop\(\)\{root\.scrollTop=0;document\.body\.scrollTop=0;document\.scrollingElement\?\.scrollTo\(\{top:0,behavior:'instant'\}\)/);
  assert.match(source,/topButton\?\.addEventListener\('click',returnToTop\)/);
});

test('content interactions use lifetime-unique views and unique like keys',async()=>{
  const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../functions/api/content/[slug].js',import.meta.url),'utf8'));
  assert.match(source,/INSERT OR IGNORE INTO content_unique_views/);
  assert.match(source,/content_likes WHERE actor_key=\? AND content_id=\?/);
});
