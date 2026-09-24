import { json, requireSession } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await requireSession(context);
  if (!session) return json({ authenticated: false }, 401);
  return json({ authenticated: true, user: { id: session.sub, name: session.name, email: session.email, role: session.role } });
}
