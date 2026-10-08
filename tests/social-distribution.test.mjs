import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure,formatSocialPost,nextAttemptAt,scheduleAt,trackedUrl } from '../functions/_lib/social-core.js';
const item={slug:'ia-verifiee',type:'article',title:'Une avancée documentée en intelligence artificielle',excerpt:'Un résumé factuel qui présente le contexte et les limites de cette information.',category:'Intelligence artificielle',cover_url:'/media/test.jpg'};
test('social links are canonical TAMUSNI links with per-platform UTM',()=>{assert.match(trackedUrl('https://tamusni.pages.dev',item.slug,'facebook'),/utm_source=facebook/)});
test('formatters adapt copy without inventing facts',()=>{const x=formatSocialPost(item,'x','https://tamusni.pages.dev');assert.ok(x.text.length<=280);assert.match(x.text,/#TAMUSNI/);const ig=formatSocialPost(item,'instagram','https://tamusni.pages.dev');assert.match(ig.text,/lien dans la bio/i);assert.doesNotMatch(ig.text,/https:\/\//);const fb=formatSocialPost(item,'facebook','https://tamusni.pages.dev');assert.match(fb.text,/Lire l’article/)});
test('YouTube is not applicable to an article',()=>assert.equal(formatSocialPost(item,'youtube','https://tamusni.pages.dev').applicable,false));
test('delays and bounded retries are deterministic',()=>{const start=new Date('2026-10-09T10:00:00Z');assert.equal(scheduleAt('instagram',start),'2026-10-09T10:30:00.000Z');assert.equal(classifyFailure(429),'retry');assert.equal(classifyFailure(401),'permanent');assert.equal(nextAttemptAt(1,start),'2026-10-09T10:05:00.000Z')});
