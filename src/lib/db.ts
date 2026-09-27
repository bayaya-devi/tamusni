import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";

export type User = { id: string; name: string; email: string; password_hash: string; role: "USER" | "ADMIN"; created_at: string };
type Subscriber = { id: string; email: string; locale: string; created_at: string };
type ResetToken = { token_hash: string; user_id: string; expires_at: string };
type Statement = { bind: (...values: unknown[]) => Statement; first: <T>() => Promise<T | null>; run: () => Promise<unknown>; all: <T>() => Promise<{ results: T[] }> };
type D1 = { prepare: (query: string) => Statement; batch: (statements: Statement[]) => Promise<unknown> };
type MemoryStore = { users: User[]; subscribers: Subscriber[]; resetTokens: ResetToken[] };

const memory = globalThis as typeof globalThis & { tamusniStore?: MemoryStore };
if (!memory.tamusniStore) memory.tamusniStore = { users: [], subscribers: [], resetTokens: [] };
const store = memory.tamusniStore;

const database = async (): Promise<D1 | null> => {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return ((await getCloudflareContext({ async: true })).env as unknown as { DB: D1 }).DB;
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return null;
  }
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const hashSync = (password: string) => { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; };
export const newId = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
export const hashPassword = async (password: string) => hashSync(password);
export const verifyPassword = async (password: string, stored: string) => {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const userRepository = {
  async findByEmail(email: string) {
    const db = await database();
    if (db) return db.prepare("SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ? LIMIT 1").bind(email.toLowerCase()).first<User>();
    return store.users.find((user) => user.email === email.toLowerCase()) ?? null;
  },
  async findById(id: string) {
    const db = await database();
    if (db) return db.prepare("SELECT id, name, email, password_hash, role, created_at FROM users WHERE id = ? LIMIT 1").bind(id).first<User>();
    return store.users.find((user) => user.id === id) ?? null;
  },
  async create(user: User) {
    const db = await database();
    if (db) { await db.prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(user.id, user.name, user.email, user.password_hash, user.role, user.created_at).run(); return user; }
    store.users.push(user); return user;
  },
  async updatePassword(id: string, passwordHash: string) {
    const db = await database();
    if (db) return db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, id).run();
    const user = store.users.find((item) => item.id === id); if (user) user.password_hash = passwordHash;
  },
  async count() {
    const db = await database();
    if (db) return (await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'USER'").first<{ count: number }>())?.count ?? 0;
    return store.users.filter((user) => user.role === "USER").length;
  },
};

export const newsletterRepository = {
  async create(email: string) {
    const normal = email.toLowerCase(), db = await database();
    if (db) return db.prepare("INSERT OR IGNORE INTO newsletter_subscribers (id, email, locale, created_at) VALUES (?, ?, 'fr', ?)").bind(newId("sub"), normal, new Date().toISOString()).run();
    if (!store.subscribers.some((subscriber) => subscriber.email === normal)) store.subscribers.push({ id: newId("sub"), email: normal, locale: "fr", created_at: new Date().toISOString() });
  },
  async count() {
    const db = await database();
    if (db) return (await db.prepare("SELECT COUNT(*) AS count FROM newsletter_subscribers").first<{ count: number }>())?.count ?? 0;
    return store.subscribers.length;
  },
};

export const resetRepository = {
  async create(userId: string, token: string) {
    const tokenHash = hashToken(token), expiry = new Date(Date.now() + 30 * 60_000).toISOString(), db = await database();
    if (db) return db.batch([db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(userId), db.prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(tokenHash, userId, expiry, new Date().toISOString())]);
    store.resetTokens = store.resetTokens.filter((item) => item.user_id !== userId); store.resetTokens.push({ token_hash: tokenHash, user_id: userId, expires_at: expiry });
  },
  async consume(token: string) {
    const tokenHash = hashToken(token), now = new Date().toISOString(), db = await database();
    if (db) { const found = await db.prepare("SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ? LIMIT 1").bind(tokenHash, now).first<{ user_id: string }>(); await db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").bind(tokenHash).run(); return found?.user_id; }
    const found = store.resetTokens.find((item) => item.token_hash === tokenHash && item.expires_at > now); store.resetTokens = store.resetTokens.filter((item) => item.token_hash !== tokenHash); return found?.user_id;
  },
};
