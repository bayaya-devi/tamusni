import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";

export type User = { id: string; name: string; email: string; password_hash: string; role: "USER" | "ADMIN"; status?: "ACTIVE" | "BANNED"; created_at: string };
type Subscriber = { id: string; email: string; locale: string; created_at: string };
type ResetToken = { token_hash: string; user_id: string; expires_at: string };
export type EditorialType = "ARTICLE" | "BREVE" | "VIDEO" | "INTERVIEW";
export type EditorialContent = { id: string; slug: string; type: EditorialType; category: string; title: string; subtitle: string; image_url: string | null; video_url: string | null; body: string; status: "DRAFT" | "PUBLISHED"; author_name: string; created_at: string; updated_at: string };
export type UserReport = { id: string; reporter_name: string; reporter_email: string; subject_type: string; subject_id: string; reason: string; status: "OPEN" | "RESOLVED"; created_at: string };
type Statement = { bind: (...values: unknown[]) => Statement; first: <T>() => Promise<T | null>; run: () => Promise<unknown>; all: <T>() => Promise<{ results: T[] }> };
type D1 = { prepare: (query: string) => Statement; batch: (statements: Statement[]) => Promise<unknown> };
type MemoryStore = { users: User[]; subscribers: Subscriber[]; resetTokens: ResetToken[]; contents: EditorialContent[]; reports: UserReport[] };

const memory = globalThis as typeof globalThis & { tamusniStore?: MemoryStore };
if (!memory.tamusniStore) memory.tamusniStore = { users: [], subscribers: [], resetTokens: [], contents: [], reports: [] };
const store = memory.tamusniStore;
if (!store.contents) store.contents = [];
if (!store.reports) store.reports = [];

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
    if (db) return db.prepare("SELECT id, name, email, password_hash, role, COALESCE(status, 'ACTIVE') AS status, created_at FROM users WHERE email = ? LIMIT 1").bind(email.toLowerCase()).first<User>();
    return store.users.find((user) => user.email === email.toLowerCase()) ?? null;
  },
  async findById(id: string) {
    const db = await database();
    if (db) return db.prepare("SELECT id, name, email, password_hash, role, COALESCE(status, 'ACTIVE') AS status, created_at FROM users WHERE id = ? LIMIT 1").bind(id).first<User>();
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
  async provisionAdmin(email: string, password: string) {
    const normal = email.toLowerCase(), existing = await this.findByEmail(normal), password_hash = await hashPassword(password), db = await database();
    if (existing) {
      if (db) await db.prepare("UPDATE users SET name = ?, password_hash = ?, role = 'ADMIN', status = 'ACTIVE' WHERE id = ?").bind("Administration TAMUSNI", password_hash, existing.id).run();
      else { existing.name = "Administration TAMUSNI"; existing.password_hash = password_hash; existing.role = "ADMIN"; existing.status = "ACTIVE"; }
      return { ...existing, name: "Administration TAMUSNI", password_hash, role: "ADMIN" as const, status: "ACTIVE" as const };
    }
    return this.create({ id: newId("adm"), name: "Administration TAMUSNI", email: normal, password_hash, role: "ADMIN", status: "ACTIVE", created_at: new Date().toISOString() });
  },
};

export const adminRepository = {
  async listUsers() {
    const db = await database();
    if (db) return (await db.prepare("SELECT id, name, email, role, COALESCE(status, 'ACTIVE') AS status, created_at FROM users ORDER BY created_at DESC LIMIT 200").all<Omit<User, "password_hash">>()).results;
    return store.users.map(({ password_hash, ...user }) => ({ ...user, status: user.status || "ACTIVE" }));
  },
  async setUserStatus(id: string, status: "ACTIVE" | "BANNED") {
    const db = await database();
    if (db) return db.prepare("UPDATE users SET status = ? WHERE id = ? AND role <> 'ADMIN'").bind(status, id).run();
    const user = store.users.find((item) => item.id === id && item.role !== "ADMIN"); if (user) user.status = status;
  },
  async createContent(input: Omit<EditorialContent, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString(), content: EditorialContent = { ...input, id: newId("cnt"), created_at: now, updated_at: now }, db = await database();
    if (db) { await db.prepare("INSERT INTO content_items (id, slug, type, category, title, subtitle, image_url, video_url, body, status, author_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(content.id, content.slug, content.type, content.category, content.title, content.subtitle, content.image_url, content.video_url, content.body, content.status, content.author_name, now, now).run(); return content; }
    store.contents.unshift(content); return content;
  },
  async listContent() {
    const db = await database();
    if (db) return (await db.prepare("SELECT id, slug, type, category, title, subtitle, image_url, video_url, body, status, author_name, created_at, updated_at FROM content_items ORDER BY created_at DESC LIMIT 100").all<EditorialContent>()).results;
    return store.contents;
  },
  async listReports() {
    const db = await database();
    if (db) return (await db.prepare("SELECT r.id, u.name AS reporter_name, u.email AS reporter_email, r.subject_type, r.subject_id, r.reason, r.status, r.created_at FROM user_reports r JOIN users u ON u.id = r.user_id ORDER BY CASE r.status WHEN 'OPEN' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 200").all<UserReport>()).results;
    return store.reports;
  },
  async createReport(user: Pick<User, "id" | "name" | "email">, subjectType: string, subjectId: string, reason: string) {
    const report: UserReport = { id: newId("rpt"), reporter_name: user.name, reporter_email: user.email, subject_type: subjectType, subject_id: subjectId, reason, status: "OPEN", created_at: new Date().toISOString() }, db = await database();
    if (db) { await db.prepare("INSERT INTO user_reports (id, user_id, subject_type, subject_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'OPEN', ?)").bind(report.id, user.id, subjectType, subjectId, reason, report.created_at).run(); return report; }
    store.reports.unshift(report); return report;
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
