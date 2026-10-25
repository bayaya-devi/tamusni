import { cleanText, validEmail } from "./auth.js";

export const BUSINESS_PRICE_PER_DAY_CENTS = 100;
export const BUSINESS_MAX_DURATION_DAYS = 30;

export const BUSINESS_PROFILE_STATUSES = Object.freeze([
  "incomplete", "pending", "verified", "changes_requested", "refused", "suspended"
]);
export const BUSINESS_CAMPAIGN_STATUSES = Object.freeze([
  "draft", "submitted", "changes_requested", "approved", "awaiting_payment",
  "paid", "scheduled", "active", "suspended", "completed", "refused"
]);

const campaignTypes = new Set(["sponsored_distribution", "editorial_support"]);
const contentTypes = new Set(["product", "service", "offer", "solution", "project", "innovation", "event", "editorial_support", "other"]);
const startModes = new Set(["immediate", "scheduled"]);
const allowedLanguages = new Set(["fr", "ar", "en", "es", "pt"]);

export function parseStringList(value, maximumItems = 20, maximumLength = 80) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => cleanText(item, maximumLength)).filter(Boolean))].slice(0, maximumItems);
}

export function safeBusinessUrl(value, { required = true } = {}) {
  const raw = cleanText(value, 2_000);
  if (!raw && !required) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "0.0.0.0" || hostname === "::1") return null;
    if (/^(10|127)\./.test(hostname) || /^192\.168\./.test(hostname) || /^169\.254\./.test(hostname)) return null;
    const private172 = hostname.match(/^172\.(\d{1,3})\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function validateBusinessProfile(input = {}) {
  const profile = {
    legalName: cleanText(input.legalName, 160),
    tradingName: cleanText(input.tradingName, 120),
    description: cleanText(input.description, 2_000),
    industry: cleanText(input.industry, 100),
    country: cleanText(input.country, 80),
    city: cleanText(input.city, 100),
    websiteUrl: safeBusinessUrl(input.websiteUrl),
    professionalEmail: cleanText(input.professionalEmail, 254).toLowerCase(),
    phone: cleanText(input.phone, 40) || null,
    taxId: cleanText(input.taxId, 80) || null,
    contactName: cleanText(input.contactName, 120),
    contactRole: cleanText(input.contactRole, 120),
    logoUrl: safeBusinessUrl(input.logoUrl, { required: false })
  };
  const errors = [];
  if (profile.legalName.length < 2) errors.push("legalName");
  if (profile.tradingName.length < 2) errors.push("tradingName");
  if (profile.description.length < 40) errors.push("description");
  if (!profile.industry) errors.push("industry");
  if (!profile.country) errors.push("country");
  if (!profile.websiteUrl) errors.push("websiteUrl");
  if (!validEmail(profile.professionalEmail)) errors.push("professionalEmail");
  if (profile.contactName.length < 2) errors.push("contactName");
  if (!profile.contactRole) errors.push("contactRole");
  if (input.logoUrl && !profile.logoUrl) errors.push("logoUrl");
  return { ok: errors.length === 0, errors, profile };
}

export function validateBusinessCampaign(input = {}) {
  const durationDays = Number.parseInt(input.durationDays, 10);
  const scheduledDate = input.scheduledStartAt ? new Date(input.scheduledStartAt) : null;
  const campaign = {
    campaignType: campaignTypes.has(input.campaignType) ? input.campaignType : "",
    contentType: contentTypes.has(input.contentType) ? input.contentType : "",
    title: cleanText(input.title, 140),
    shortDescription: cleanText(input.shortDescription, 300),
    detailedDescription: cleanText(input.detailedDescription, 5_000),
    imageUrl: safeBusinessUrl(input.imageUrl, { required: false }),
    destinationUrl: safeBusinessUrl(input.destinationUrl),
    cta: cleanText(input.cta, 40) || "En savoir plus",
    industry: cleanText(input.industry, 100),
    objective: cleanText(input.objective, 300),
    audience: parseStringList(input.audience, 20, 80),
    countries: parseStringList(input.countries, 20, 80),
    languages: parseStringList(input.languages, 5, 5).filter((item) => allowedLanguages.has(item)),
    durationDays,
    startMode: startModes.has(input.startMode) ? input.startMode : "",
    scheduledStartAt: scheduledDate && Number.isFinite(scheduledDate.getTime()) ? scheduledDate.toISOString() : null
  };
  const errors = [];
  if (!campaign.campaignType) errors.push("campaignType");
  if (!campaign.contentType) errors.push("contentType");
  if (campaign.title.length < 5) errors.push("title");
  if (campaign.shortDescription.length < 20) errors.push("shortDescription");
  if (campaign.detailedDescription.length < 60) errors.push("detailedDescription");
  if (input.imageUrl && !campaign.imageUrl) errors.push("imageUrl");
  if (!campaign.destinationUrl) errors.push("destinationUrl");
  if (!campaign.industry) errors.push("industry");
  if (!campaign.objective) errors.push("objective");
  if (!campaign.audience.length) errors.push("audience");
  if (!campaign.countries.length) errors.push("countries");
  if (!campaign.languages.length) errors.push("languages");
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > BUSINESS_MAX_DURATION_DAYS) errors.push("durationDays");
  if (!campaign.startMode) errors.push("startMode");
  if (campaign.startMode === "scheduled" && (!campaign.scheduledStartAt || Date.parse(campaign.scheduledStartAt) <= Date.now())) errors.push("scheduledStartAt");
  return {
    ok: errors.length === 0,
    errors,
    campaign: { ...campaign, priceCents: Number.isInteger(durationDays) ? durationDays * BUSINESS_PRICE_PER_DAY_CENTS : 0, currency: "EUR" }
  };
}

export function businessRedirect(role, locale = "fr") {
  if (role === "ADMIN") return `/${locale}/admin/`;
  if (role === "CONTRIBUTOR") return `/${locale}/contributeur/`;
  if (role === "BUSINESS") return `/${locale}/business/espace/`;
  return `/${locale}/mon-espace/`;
}

export function campaignCanBeEdited(status) {
  return status === "draft" || status === "changes_requested";
}
