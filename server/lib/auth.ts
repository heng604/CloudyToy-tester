import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { User } from "@supabase/supabase-js";
import { db } from "./db";
import { can, type Perm, type Role } from "../../shared/roles";
import { roleFor, touchStaff } from "./staff";
/** Token check results are remembered for up to 60 s (never longer than the token itself lives), so a page that fires 5 API calls verifies the token once, not 5 times over the network. */
const verified = new Map<string, { user: User; until: number }>(); const checking = new Map<string, Promise<User | null>>();
const jwtExpiryMs = (token: string) => { try { const p = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: unknown }; return typeof p.exp === "number" ? p.exp * 1000 : 0; } catch { return 0; } };
async function verifyToken(token: string): Promise<User | null> {
  const k = crypto.createHash("sha256").update(token).digest("hex"), now = Date.now(), hit = verified.get(k);
  if (hit && hit.until > now) return hit.user;
  const running = checking.get(k); if (running) return running; // same token, same moment: share one check
  const p = (async () => {
    try {
      const { data, error } = await db().auth.getUser(token); if (error || !data.user) return null;
      const exp = jwtExpiryMs(token); const until = Math.min(Date.now() + 60_000, exp || 0);
      if (until > Date.now()) { if (verified.size > 1000) verified.clear(); verified.set(k, { user: data.user, until }); }
      return data.user;
    } catch { return null; } finally { checking.delete(k); }
  })();
  checking.set(k, p); return p;
}
/** Verifies the Supabase access token sent by the browser (Authorization: Bearer ...). Returns the user or null. */
export async function userFromReq(req: Request): Promise<User | null> {
  const h = String(req.headers.authorization ?? ""); const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return token ? verifyToken(token) : null;
}
/** Signed-in staff member (owner, admin or editor) with their role, or null. */
export const adminOrNull = async (req: Request) => { const u = await userFromReq(req); if (!u) return null; const role = await roleFor(u.email, !!u.email_confirmed_at); return role ? { user: u, role } : null; };
/** Unauthorized => plain 404, no data revealed (same as the old branded 404). */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const a = await adminOrNull(req);
  if (!a) return res.status(404).json({ error: "Not found" });
  Object.assign(req, { admin: a.user, role: a.role });
  const m = (a.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  await touchStaff(a.user.email, m.full_name || m.name); next();
}
/** 403 when the staff member's role does not allow this area (the browser also hides those pages). */
export const needs = (p: Perm) => (req: Request, res: Response, next: NextFunction) => (can(roleOf(req), p) ? next() : res.status(403).json({ error: "Your role cannot do this." }));
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const u = await userFromReq(req);
  if (!u) return res.status(401).json({ error: "Sign in required" });
  (req as Request & { user: User }).user = u; next();
}
export const adminOf = (req: Request) => (req as Request & { admin: User }).admin;
export const userOf = (req: Request) => (req as Request & { user: User }).user;
export const roleOf = (req: Request) => (req as Request & { role: Role }).role;
