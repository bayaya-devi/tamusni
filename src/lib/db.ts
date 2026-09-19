import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "crypto";

type User = { id: string; name: string; email: string; password_hash: string; role: "USER" | "ADMIN"; created_at: string };
type Subscriber = { id: string; email: string; locale: string; created_at: string };
type ResetToken = { token: string; userId: string; expiresAt: number };
const state = globalThis as typeof globalThis & { tamusniStore?: { users: User[]; subscribers: Subscriber[]; resetTokens: ResetToken[] } };
const adminEmail = (process.env.ADMIN_EMAIL || "admin@tamusni.com").toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "TamusniAdmin2026!";
const hashSync = (password: string) => { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; };
if (!state.tamusniStore) state.tamusniStore = { users: [{ id: "usr_admin", name: "Administration TAMUSNI", email: adminEmail, password_hash: hashSync(adminPassword), role: "ADMIN", created_at: new Date().toISOString() }], subscribers: [], resetTokens: [] };
const store = state.tamusniStore;

export const newId = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
export const hashPassword = async (password: string) => hashSync(password);
export const verifyPassword = async (password: string, stored: string) => { const [salt, hash] = stored.split(":"); return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, "hex")); };
export const userRepository = { findByEmail: (email: string) => store.users.find(user => user.email === email.toLowerCase()), findById: (id: string) => store.users.find(user => user.id === id), create: (user: User) => { store.users.push(user); return user; }, updatePassword: (id: string, password_hash: string) => { const user = store.users.find(item => item.id === id); if (user) user.password_hash = password_hash; }, count: () => store.users.filter(user => user.role === "USER").length };
export const newsletterRepository = { create: (email: string) => { if (!store.subscribers.some(subscriber => subscriber.email === email.toLowerCase())) store.subscribers.push({ id: newId("sub"), email: email.toLowerCase(), locale: "fr", created_at: new Date().toISOString() }); }, count: () => store.subscribers.length };
export const resetRepository = { create: (userId: string, token: string) => { store.resetTokens = store.resetTokens.filter(item => item.userId !== userId); store.resetTokens.push({ userId, token, expiresAt: Date.now() + 30 * 60_000 }); }, consume: (token: string) => { const item = store.resetTokens.find(entry => entry.token === token && entry.expiresAt > Date.now()); store.resetTokens = store.resetTokens.filter(entry => entry.token !== token); return item?.userId; } };
