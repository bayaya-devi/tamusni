import { json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";

const supported = new Set(["en", "ar", "es", "pt"]);

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  if (!await requireSession(context)) return json({ error: "Connexion requise." }, 401);
  if (!context.env.AI) return json({ error: "Service de traduction indisponible." }, 503);
  try {
    const body = await readBody(context.request);
    const target = String(body.target || "");
    const texts = Array.isArray(body.texts) ? body.texts.map((value) => String(value).trim()).filter(Boolean) : [];
    if (!supported.has(target) || !texts.length || texts.length > 12 || texts.join("").length > 7_000) return json({ error: "Demande de traduction invalide." }, 400);
    const output = await Promise.all(texts.map(async text => {
      const result = await context.env.AI.run("@cf/meta/m2m100-1.2b", { text, source_lang: "fr", target_lang: target });
      const translated = String(result?.translated_text || result?.translation || "").trim();
      if (!translated) throw new Error("EMPTY_TRANSLATION");
      return translated;
    }));
    return json({ translations: output }, 200, { "Cache-Control": "private, max-age=86400" });
  } catch (error) { console.error("translation_failed", error); return json({ error: "Traduction temporairement indisponible." }, 502); }
}
