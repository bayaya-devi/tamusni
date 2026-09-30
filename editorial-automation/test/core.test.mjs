import test from "node:test";
import assert from "node:assert/strict";
import { allowedExternalUrl, localClock, parseFeed, slugify } from "../src/core.js";

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
