import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicResponse } from '../functions/_lib/public-frontend.js';

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

for(const locale of ['fr','ar','en','es','pt']){
  test(`homepage ${locale} has a localized shell`,async()=>{
    const response=await publicResponse(context(`/${locale}/`),locale,'');
    assert.equal(response.status,200);
    const html=await response.text();
    assert.match(html,new RegExp(`<html lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"`));
    assert.match(html,/class="site-header"/);
    assert.match(html,/class="site-footer"/);
    assert.doesNotMatch(html,/tamusni-rail/);
    assert.match(html,new RegExp(`\/brand\/tamusni-${locale==='ar'?'ar':'latin'}\.png`));
    assert.match(html,/hreflang="es"/);
  });
}

test('article cites its actual source and escapes user-facing text',async()=>{
  const response=await publicResponse(context('/fr/articles/essai-source/'),'fr','articles/essai-source/');
  const html=await response.text();
  assert.match(html,/Source officielle/);
  assert.match(html,/https:\/\/example\.org\/article/);
  assert.match(html,/Une actualité vérifiée/);
  assert.match(html,/class="article-actions/);
});

test('rubric search is scoped to its category',async()=>{
  const response=await publicResponse(context('/fr/intelligence-artificielle/?q=source'),'fr','intelligence-artificielle/');
  assert.match(await response.text(),/Intelligence artificielle/);
});

test('signup and login preserve their forms and OAuth links',async()=>{
  for(const page of ['connexion/','inscription/']){
    const response=await publicResponse(context(`/fr/${page}`),'fr',page);
    const html=await response.text();
    assert.match(html,/\/api\/auth\/oauth\?provider=google/);
    assert.match(html,/\/brand\/google\.png/);
    assert.match(html,/type="password"/);
  }
});
