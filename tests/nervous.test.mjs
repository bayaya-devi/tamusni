import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedConfig, decay, diverseRank, isFrequencyAllowed, safeMetadata, trendScore } from '../functions/_lib/nervous-core.js';

test('interest scores decay and remain normalized through ranking',()=>{assert.ok(decay(8,'2026-09-25T00:00:00Z',Date.parse('2026-10-25T00:00:00Z'))<4.1);const ranked=diverseRank([{category:'IA',freshness_score:.8,editorial_importance:.8},{category:'IA',freshness_score:.7,editorial_importance:.7},{category:'Espace',freshness_score:.6,editorial_importance:.6}],{ia:.9},{},3);assert.equal(ranked[0].category,'IA');assert.ok(ranked.find(item=>item.category==='Espace').factors.diversity===1);});
test('algorithm parameters have safe bounds',()=>{assert.equal(allowedConfig('x',.4,{minimum:0,maximum:1}),.4);assert.equal(allowedConfig('x',2,{minimum:0,maximum:1}),null);});
test('frequency cap rejects repeat sponsored delivery',()=>{assert.equal(isFrequencyAllowed({sessionImpressions:1,dailyImpressions:2,sessionCap:2,dailyCap:3}),true);assert.equal(isFrequencyAllowed({sessionImpressions:2,dailyImpressions:2,sessionCap:2,dailyCap:3}),false);});
test('event metadata is controlled and trend score rewards distributed growth',()=>{assert.deepEqual(safeMetadata({query:'  IA  ',unsafe:{x:1},huge:'x'.repeat(400)}),{query:'IA',huge:'x'.repeat(160)});assert.ok(trendScore({recent:20,previous:2,uniqueActors:12,editorialImportance:.8})>trendScore({recent:3,previous:3,uniqueActors:1,editorialImportance:.2}));});
