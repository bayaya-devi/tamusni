export const LOCALES = ["fr", "en", "ar"];
export const START_DATE = "2026-10-01";
const forbiddenHosts = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1", "metadata.google.internal"]);

export function localClock(date = new Date(), timeZone = "Africa/Casablanca") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
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
  return String(value || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&(?:amp|#38);/g, "&").replace(/&(?:lt|#60);/g, "<").replace(/&(?:gt|#62);/g, ">").replace(/&(?:quot|#34);/g, '"').replace(/&#(?:39|x27);/gi, "'").replace(/\s+/g, " ").trim().slice(0, maximum);
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
  for (const block of blocks.slice(0, 20)) {
    const tag = (names) => {
      for (const name of names) {
        const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
        if (match) return plainText(match[1], 600);
      }
      return "";
    };
    const title = tag(["title"]);
    const explicitLink = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
    const url = explicitLink || tag(["link", "guid", "id"]);
    const publishedAt = tag(["pubDate", "published", "updated", "dc:date"]);
    const normalized = normalizeCandidate({ title, url, publishedAt, publisher: metadata.publisher, category: metadata.category, sourceTier: metadata.tier }, now);
    if (normalized && normalized.ageHours <= 72.5) candidates.push(normalized);
  }
  return candidates;
}

export function sourceDigest(sourcePage) {
  const text = plainText(sourcePage, 10_000);
  // External pages are untrusted data. Explicit delimiters stop them becoming
  // instructions in a later model prompt.
  return `UNTRUSTED_SOURCE_TEXT_START\n${text}\nUNTRUSTED_SOURCE_TEXT_END`;
}

export function aiDisclosure(locale) {
  return ({ fr: "Contenu rédigé avec l’aide de l’intelligence artificielle par TAMUSNI.", en: "Content produced with the assistance of artificial intelligence by TAMUSNI.", ar: "تم إعداد هذا المحتوى بمساعدة الذكاء الاصطناعي من طرف تاموسني." })[locale] || "";
}

export function categoryCover(category) {
  return ({ Intelligence: "editorial-ai-space.svg", Innovation: "editorial-battery.svg", Robotique: "editorial-launcher.svg", Cybersécurité: "editorial-cyber-threat.svg", Espace: "editorial-mars-network.svg" })[category] || "editorial-ai-space.svg";
}

export function slugify(value) {
  return plainText(value, 160).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export function safeJson(value) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(String(value || "")); } catch { return null; }
}

export function isCompletePublication(publication) {
  if (!publication || typeof publication !== "object") return false;
  if (!publication.factSheet || !Array.isArray(publication.sources) || publication.sources.length < 1) return false;
  return LOCALES.every((locale) => {
    const entry = publication.translations?.[locale];
    return entry && typeof entry.title === "string" && entry.title.length >= 12 && typeof entry.excerpt === "string" && entry.excerpt.length >= 30 && typeof entry.body === "string" && entry.body.length >= 150;
  });
}
