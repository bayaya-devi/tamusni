import { json, readBody, sameOrigin } from "../_lib/auth.js";

const supported = new Set(["en", "ar"]);
const marker = (index) => `<<<TAMUSNI_${index}>>>`;

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  if (!context.env.AI) return json({ error: "Service de traduction indisponible." }, 503);
  try {
    const body = await readBody(context.request);
    const target = String(body.target || "");
    const texts = Array.isArray(body.texts) ? body.texts.map((value) => String(value).trim()).filter(Boolean) : [];
    if (!supported.has(target) || !texts.length || texts.length > 50 || texts.join("").length > 7_000) return json({ error: "Demande de traduction invalide." }, 400);
    const source = texts.map((text, index) => `${marker(index)}\n${text}`).join("\n");
    const result = await context.env.AI.run("@cf/meta/m2m100-1.2b", { text: source, source_lang: "fr", target_lang: target });
    const translated = String(result?.translated_text || result?.translation || "");
    const output = texts.map((original, index) => {
      const start = translated.indexOf(marker(index));
      const next = index + 1 < texts.length ? translated.indexOf(marker(index + 1)) : translated.length;
      return start >= 0 && next > start ? translated.slice(start + marker(index).length, next).trim() : original;
    });
    return json({ translations: output }, 200, { "Cache-Control": "private, max-age=86400" });
  } catch (error) { console.error("translation_failed", error); return json({ error: "Traduction temporairement indisponible." }, 502); }
}
