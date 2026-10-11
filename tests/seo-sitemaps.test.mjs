import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as newsSitemap } from '../functions/news-sitemap.xml.js';
import { publicResponse } from '../functions/_lib/public-frontend.js';

test('Google News sitemap contains only recent, public canonical stories', async () => {
  let parameters;
  const db = { prepare(sql) { assert.match(sql, /status='published'/); return { bind(...values) { parameters = values; return { async all() { return { results: [{ slug: 'actualite-verifiee', title: 'Une actualité & vérifiée', published_at: '2026-10-11T06:00:00.000Z' }] }; } }; } }; } };
  const response = await newsSitemap({ request: new Request('https://tamusni.pages.dev/news-sitemap.xml'), env: { DB: db, PUBLIC_SITE_URL: 'https://tamusni.pages.dev' } });
  const xml = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/xml/);
  assert.equal(parameters.length, 2);
  assert.match(xml, /xmlns:news=/);
  assert.match(xml, /https:\/\/tamusni\.pages\.dev\/fr\/articles\/actualite-verifiee\//);
  assert.match(xml, /Une actualité &amp; vérifiée/);
  assert.match(xml, /<news:language>fr<\/news:language>/);
});

test('the Search Console verification token is server-rendered only when configured', async () => {
  const db = { prepare() { return { bind() { return { async first() { return null; }, async all() { return { results: [] }; } }; } }; } };
  const context = { request: new Request('https://tamusni.pages.dev/fr/'), env: { DB: db, PUBLIC_SITE_URL: 'https://tamusni.pages.dev', GOOGLE_SITE_VERIFICATION: 'official-token-123' } };
  const response = await publicResponse(context, 'fr', '');
  const html = await response.text();
  assert.match(html, /<meta name="google-site-verification" content="official-token-123">/);
});
