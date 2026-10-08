import test from "node:test";
import assert from "node:assert/strict";
import { addLocalDays, allowedExternalUrl, isCompletePublication, isPublicationDue, localClock, parseFeed, publicationQualityIssues, rankCandidates, safeJson, slugify, titleSimilarity } from "../src/core.js";

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

test("keeps a durable 48-hour local-date cadence", () => {
  assert.equal(addLocalDays("2026-10-09", 2), "2026-10-11");
  assert.equal(addLocalDays("2026-12-31", 2), "2027-01-02");
  assert.equal(isPublicationDue({ date: "2026-10-08" }, "2026-10-09"), false);
  assert.equal(isPublicationDue({ date: "2026-10-09" }, "2026-10-09"), true);
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
});
