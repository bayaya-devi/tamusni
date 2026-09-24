import { json, sameOrigin } from "../../_lib/auth.js";
export function onRequestPost(context) { if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403); return json({ ok: true, redirect: "/" }, 200, { "Set-Cookie": "tamusni_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" }); }
