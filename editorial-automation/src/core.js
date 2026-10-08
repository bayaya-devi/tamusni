export const LOCALES = ["fr", "en", "ar"];
export const START_DATE = "2026-10-01";
export const ACTIVE_CATEGORIES = ["Intelligence", "Innovation", "Robotique", "Cybersécurité", "Espace"];

const forbiddenHosts = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1", "metadata.google.internal"]);

export function localClock(date = new Date(), timeZone = "Africa/Casablanca") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

export function addLocalDays(localDate, days) {
  const match = String(localDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("INVALID_LOCAL_DATE");
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days)));
  return shifted.toISOString().slice(0, 10);
}

export function isPublicationDue(clock, nextLocalDate) {
  return Boolean(nextLocalDate && clock?.date >= nextLocalDate);
}

export function allowedExternalUrl(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || forbiddenHosts.has(host)) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    if (host.includes(":")) return false;
    return true;
  } catch { return false; }
}

export function plainText(value, maximum = 12_000) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/(?:nav|footer|header|aside)>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/<!\[CDATA\[|\]\]>/g, " ")
    .replace(/&(?:amp|#38);/g, "&").replace(/&(?:lt|#60);/g, "<").replace(/&(?:gt|#62);/g, ">")
    .replace(/&(?:quot|#34);/g, '"').replace(/&#(?:39|x27);/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function normalizeCandidate(candidate, now = Date.now()) {
  if (!candidate?.title || !allowedExternalUrl(candidate.url)) return null;
  const published = candidate.publishedAt ? Date.parse(candidate.publishedAt) : NaN;
  const ageHours = Number.isFinite(published) ? (now - published) / 3_600_000 : Infinity;
  return { ...candidate, title: plainText(candidate.title, 240), url: new URL(candidate.url).toString(), publishedAt: Number.isFinite(published) ? new Date(published).toISOString() : null, ageHours };
}

export function parseFeed(xml, metadata, now = Date.now()) {
  const candidates = [];
  const blocks = String(xml || "").match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
  for (const block of blocks.slice(0, 16)) {
    const tag = names => {
      for (const name of names) {
        const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
        if (match) return plainText(match[1], 800);
      }
      return "";
    };
    const explicitLink = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
    const normalized = normalizeCandidate({ title: tag(["title"]), url: explicitLink || tag(["link", "guid", "id"]), publishedAt: tag(["pubDate", "published", "updated", "dc:date"]), summary: tag(["description", "summary", "content:encoded"]), publisher: metadata.publisher, category: metadata.category, sourceTier: metadata.tier }, now);
    if (normalized && normalized.ageHours >= -1 && normalized.ageHours <= 72.5) candidates.push(normalized);
  }
  return candidates;
}

export function sourceDigest(sourcePage, sourceId = "S1") {
  return `UNTRUSTED_SOURCE_${sourceId}_START\n${plainText(sourcePage, 11_000)}\nUNTRUSTED_SOURCE_${sourceId}_END`;
}

export function aiDisclosure(locale) {
  return ({ fr: "Contenu rédigé avec l’aide de l’intelligence artificielle par TAMUSNI.", en: "Content produced with the assistance of artificial intelligence by TAMUSNI.", ar: "تم إعداد هذا المحتوى بمساعدة الذكاء الاصطناعي من طرف تاموسني." })[locale] || "";
}

export function slugify(value) {
  return plainText(value, 160).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export function safeJson(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  const raw = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  }
}

export function extractAiJson(result, expectedKeys = []) {
  const queue = [result];
  const seen = new Set();
  while (queue.length) {
    const candidate = queue.shift();
    if (candidate == null || seen.has(candidate)) continue;
    seen.add(candidate);
    const parsed = typeof candidate === "string" ? safeJson(candidate) : candidate;
    if (!parsed || typeof parsed !== "object") continue;
    if (!expectedKeys.length || expectedKeys.some(key => Object.prototype.hasOwnProperty.call(parsed, key))) return parsed;
    for (const key of ["response", "result", "content", "output_text", "text", "message"]) {
      if (parsed[key] != null) queue.push(parsed[key]);
    }
    if (Array.isArray(parsed.choices)) {
      for (const choice of parsed.choices) queue.push(choice?.message?.content, choice?.text);
    }
  }
  return null;
}

function tokenSet(value) {
  return new Set(plainText(value, 400).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(token => token.length > 3));
}

export function titleSimilarity(left, right) {
  const a = tokenSet(left), b = tokenSet(right);
  const shared = [...a].filter(token => b.has(token)).length;
  return shared / Math.max(1, new Set([...a, ...b]).size);
}

export function rankCandidates(candidates, categoryOrder = ACTIVE_CATEGORIES) {
  const order = new Map(categoryOrder.map((category, index) => [category, index]));
  return [...candidates].sort((left, right) => (order.get(left.category) ?? 999) - (order.get(right.category) ?? 999) || Number(left.sourceTier || 9) - Number(right.sourceTier || 9) || Number(left.ageHours || 999) - Number(right.ageHours || 999));
}

export function publicationQualityIssues(publication, type = "article") {
  const issues = [];
  if (!publication || typeof publication !== "object") return ["missing_publication"];
  if (!publication.factSheet || typeof publication.factSheet.event !== "string" || publication.factSheet.event.trim().length < 20) issues.push("incomplete_fact_sheet");
  if (!Array.isArray(publication.factSheet?.claims) || publication.factSheet.claims.length < 2) issues.push("insufficient_claims");
  if (publication.factSheet?.claims?.some(claim => typeof claim !== "object" || !plainText(claim.claim, 500) || !Array.isArray(claim.sourceIds) || !claim.sourceIds.length)) issues.push("uncited_claim");
  if (!Array.isArray(publication.sources) || publication.sources.length < 1) issues.push("missing_source");
  const minimumBody = type === "brief" ? 350 : 1200;
  for (const locale of LOCALES) {
    const entry = publication.translations?.[locale];
    if (!entry) { issues.push(`missing_${locale}`); continue; }
    const title = plainText(entry.title, 500), excerpt = plainText(entry.excerpt, 1000), body = plainText(entry.body, 20_000);
    if (title.length < 20 || title.length > 180) issues.push(`invalid_title_${locale}`);
    if (excerpt.length < 60 || excerpt.length > 420) issues.push(`invalid_excerpt_${locale}`);
    if (body.length < minimumBody || body.length > 12_000) issues.push(`invalid_body_${locale}`);
    if (body === excerpt || /(?:lorem ipsum|texte à venir|coming soon|placeholder)/i.test(`${title} ${excerpt} ${body}`)) issues.push(`placeholder_${locale}`);
  }
  if (plainText(publication.imagePrompt, 1200).length < 60) issues.push("missing_image_prompt");
  return [...new Set(issues)];
}

export function isCompletePublication(publication, type = "article") {
  return publicationQualityIssues(publication, type).length === 0;
}

export function seoGeoPublicationIssues(publication, type = "article") {
  const issues = [];
  const qualityIssues = publicationQualityIssues(publication, type);
  if (qualityIssues.length) issues.push(...qualityIssues);
  const french = publication?.translations?.fr;
  const slug = slugify(french?.title || "");
  if (!slug || slug.length < 8) issues.push("invalid_public_slug");
  for (const source of publication?.sources || []) {
    if (!allowedExternalUrl(source?.url)) issues.push("invalid_source_url");
    if (plainText(source?.label, 240).length < 3) issues.push("invalid_source_label");
  }
  const claims = publication?.factSheet?.claims || [];
  const sourceIds = new Set((publication?.sources || []).map((source) => source.id));
  if (claims.some((claim) => !claim?.sourceIds?.every((id) => sourceIds.has(id)))) issues.push("unknown_fact_sheet_source");
  return [...new Set(issues)];
}
