export async function onRequestGet(context) {
  const key = String(context.params.key || "");
  if (!/^[a-z0-9-]{8,160}\.jpg$/i.test(key)) return new Response("Not found", { status: 404 });
  const media = await context.env.DB.prepare("SELECT content_type,data_base64 FROM editorial_media WHERE media_key=?").bind(key).first();
  if (!media) return new Response("Not found", { status: 404 });
  try {
    const binary = atob(media.data_base64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new Response(bytes, { headers: { "Content-Type": media.content_type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Invalid media", { status: 500 });
  }
}
