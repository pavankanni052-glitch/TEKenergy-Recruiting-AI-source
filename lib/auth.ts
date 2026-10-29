import crypto from "node:crypto";
import { cookies } from "next/headers";
import { newId, now, one, run } from "./db";
import type { Role } from "./types";

const COOKIE = "tekenergy_session";
const secret = process.env.SESSION_SECRET || "local-demo-only-change-this-before-deployment";
export type SessionUser = { id: string; name: string; email: string; role: Role };

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex"); return `${salt}:${hash}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":"); if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
function sign(payload: string) { return crypto.createHmac("sha256", secret).update(payload).digest("base64url"); }
function encode(user: SessionUser) { const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url"); return `${payload}.${sign(payload)}`; }
function decode(token?: string): SessionUser | undefined {
  if (!token) return; const [payload, signature] = token.split("."); if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return;
  try { const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionUser & { exp: number }; return value.exp > Date.now() ? { id: value.id, name: value.name, email: value.email, role: value.role } : undefined; } catch { return; }
}

export function ensureDemoUser() {
  const existing = one<{ id: string }>("SELECT id FROM users WHERE email=?", "recruiter@tekenergy.demo");
  if (!existing) { const id = "user_demo_recruiter"; run("INSERT INTO users (id,name,email,password_hash,role,active,created_at,updated_at) VALUES (?, ?, ?, ?, 'ADMIN', 1, ?, ?)", id, "Demo Recruiter", "recruiter@tekenergy.demo", hashPassword("TEKenergyDemo!2026"), now(), now()); }
}
export async function getCurrentUser(): Promise<SessionUser | undefined> { ensureDemoUser(); return decode((await cookies()).get(COOKIE)?.value); }
export async function requireUser(): Promise<SessionUser> { const user = await getCurrentUser(); if (!user) throw new Error("Authentication required"); return user; }
export async function requireRecruiter(): Promise<SessionUser> { const user = await requireUser(); if (user.role === "VIEWER") throw new Error("This action requires recruiter or administrator permission."); return user; }
export function authenticate(email: string, password: string): SessionUser | undefined { ensureDemoUser(); const user = one<SessionUser & { password_hash: string; active: number }>("SELECT id,name,email,role,password_hash,active FROM users WHERE lower(email)=lower(?)", email.trim()); if (!user || !user.active || !verifyPassword(password, user.password_hash)) return; return { id: user.id, name: user.name, email: user.email, role: user.role }; }
export async function startSession(user: SessionUser) { (await cookies()).set(COOKIE, encode(user), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12, path: "/" }); }
export async function endSession() { (await cookies()).delete(COOKIE); }
export function can(user: SessionUser, action: "manage" | "review" | "view") { return action === "view" || user.role === "ADMIN" || (user.role === "RECRUITER" && action === "review"); }
