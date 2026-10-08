import test from "node:test";
import assert from "node:assert/strict";
import { addLocalDays, allowedExternalUrl, editorialScoreBand, editorialScoreIssues, extractAiJson, isCompletePublication, isPublicationDue, localClock, normalizeEditorialScore, parseFeed, publicationQualityIssues, rankCandidates, safeJson, seoGeoPublicationIssues, slugify, titleSimilarity } from "../src/core.js";

test("rejects local and non-https source URLs", () => {
  assert.equal(allowedExternalUrl("http://example.com"), false);
  assert.equal(allowedExternalUrl("https://127.0.0.1/admin"), false);
  assert.equal(allowedExternalUrl("https://www.nasa.gov/news"), true);
});
test("uses Moroccan legal time instead of a hard-coded UTC offset", () => {
  const time = localClock(new Date("2026-10-01T07:00:00.000Z"), "Africa/Casablanca");
  assert.match(time.date, /^2026-10-01$/);
  assert.ok(Number.isInteger(time.hour));
});
test("keeps fresh https items while parsing a feed", () => {
  const now = Date.parse("2026-10-01T08:00:00.000Z");
  const xml = `<rss><channel><item><title>A verified update</title><link>https://example.org/update</link><pubDate>Wed, 30 Sep 2026 09:00:00 GMT</pubDate></item></channel></rss>`;
  assert.equal(parseFeed(xml, { publisher: "Example", category: "Innovation", tier: 1 }, now).length, 1);
});
test("creates stable public slugs", () => assert.equal(slugify("L’IA, aujourd’hui !"), "l-ia-aujourd-hui"));
test("blocks thin or placeholder automated publications", () => {
  const publication={factSheet:{event:"A sufficiently described verified event",claims:[{claim:"claim one",sourceIds:["S1"]},{claim:"claim two",sourceIds:["S1"]}]},sources:[{url:"https://example.org/source"}],imagePrompt:"A detailed realistic editorial image of the specific verified technology in a laboratory environment",translations:{}};
  for(const locale of ["fr","en","ar"])publication.translations[locale]={title:"A sufficiently precise editorial title",excerpt:"A sufficiently detailed excerpt that explains the central verified information.",body:"Lorem ipsum"};
  assert.equal(isCompletePublication(publication,"article"),false);
  assert.ok(publicationQualityIssues(publication,"article").some(issue=>issue.startsWith("invalid_body")));
});

test("blocks SEO/GEO publication metadata that cannot support a trustworthy public article", () => {
  const publication={factSheet:{event:"A sufficiently described verified event",claims:[{claim:"claim one",sourceIds:["S1"]},{claim:"claim two",sourceIds:["S1"]}]},sources:[{id:"S1",label:"Official source",url:"https://example.org/source"}],imagePrompt:"A detailed realistic editorial image of the specific verified technology in a laboratory environment",translations:{}};
  for(const locale of ["fr","en","ar"])publication.translations[locale]={title:"A sufficiently precise editorial title for a verified event",excerpt:"A sufficiently detailed excerpt that explains the central verified information.",body:"A ".repeat(700)};
  assert.deepEqual(seoGeoPublicationIssues(publication,"article"),[]);
  publication.sources[0].url="http://example.org/source";
  assert.ok(seoGeoPublicationIssues(publication,"article").includes("invalid_source_url"));
});

test("keeps a durable 48-hour local-date cadence", () => {
  assert.equal(addLocalDays("2026-10-09", 2), "2026-10-11");
  assert.equal(addLocalDays("2026-12-31", 2), "2027-01-02");
  assert.equal(isPublicationDue({ date: "2026-10-08" }, "2026-10-09"), false);
  assert.equal(isPublicationDue({ date: "2026-10-09" }, "2026-10-09"), true);
});

test("applies the complete TAMUSNI 5x10 editorial scale at every boundary", () => {
  assert.equal(editorialScoreBand(0), "ignore");
  assert.equal(editorialScoreBand(19), "ignore");
  assert.equal(editorialScoreBand(20), "monitor");
  assert.equal(editorialScoreBand(29), "monitor");
  assert.equal(editorialScoreBand(30), "flash");
  assert.equal(editorialScoreBand(37), "flash");
  assert.equal(editorialScoreBand(38), "focus");
  assert.equal(editorialScoreBand(43), "focus");
  assert.equal(editorialScoreBand(44), "priority");
  assert.equal(editorialScoreBand(50), "priority");
  assert.equal(editorialScoreBand(51), null);
});

test("rejects incomplete, inflated or format-ineligible editorial scores", () => {
  const score = { importance: 8, reliability: 8, potentialImpact: 8, publicInterest: 7, tamusniRelevance: 7, total: 50, reason: "The evidence supports a relevant and reliable technology story." };
  assert.deepEqual(normalizeEditorialScore(score), { importance: 8, reliability: 8, potentialImpact: 8, publicInterest: 7, tamusniRelevance: 7, total: 38, band: "focus", reason: score.reason });
  assert.deepEqual(editorialScoreIssues(score, "article"), []);
  assert.deepEqual(editorialScoreIssues({ ...score, potentialImpact: 0 }, "brief"), []);
  assert.ok(editorialScoreIssues({ ...score, potentialImpact: 0 }, "article").includes("editorial_score_below_article_threshold"));
  assert.deepEqual(editorialScoreIssues({ ...score, reliability: 11 }, "article"), ["invalid_editorial_score"]);
});

test("keeps Morocco calendar dates stable through legal-time changes", () => {
  const before = localClock(new Date("2026-02-14T05:30:00.000Z"), "Africa/Casablanca");
  const after = localClock(new Date("2026-03-22T05:30:00.000Z"), "Africa/Casablanca");
  assert.match(before.date, /^2026-02-14$/);
  assert.match(after.date, /^2026-03-22$/);
  assert.equal(addLocalDays("2026-02-28", 2), "2026-03-02");
});

test("prioritizes pending category order, trust tier and freshness", () => {
  const ranked=rankCandidates([
    {title:"B",category:"Espace",sourceTier:1,ageHours:1},
    {title:"C",category:"Innovation",sourceTier:4,ageHours:2},
    {title:"A",category:"Innovation",sourceTier:1,ageHours:8}
  ],["Innovation","Espace"]);
  assert.deepEqual(ranked.map(item=>item.title),["A","C","B"]);
});

test("detects related titles without treating separate stories as identical", () => {
  assert.ok(titleSimilarity("NASA confirms a new lunar mission schedule", "New lunar mission schedule confirmed by NASA") > .5);
  assert.ok(titleSimilarity("NASA confirms a new lunar mission schedule", "Cybersecurity agency publishes browser guidance") < .2);
});

test("accepts structured and fenced JSON returned by Workers AI", () => {
  assert.deepEqual(safeJson({ approved: true }), { approved: true });
  assert.deepEqual(safeJson('```json\n{"approved":true}\n```'), { approved: true });
  assert.deepEqual(safeJson('Result: {"approved":true}'), { approved: true });
  assert.deepEqual(extractAiJson({ response: { content: '```json\n{"approved":true}\n```' } }, ["approved"]), { approved: true });
  assert.deepEqual(extractAiJson({ choices: [{ message: { content: '{"factSheet":{}}' } }] }, ["factSheet"]), { factSheet: {} });
});
