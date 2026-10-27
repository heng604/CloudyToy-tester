// Admin staff (table public.staff_members). The owner emails in shared/admin.ts always have access, even if this table is missing or empty.
import { db, must } from "./db";
import { ADMIN_EMAILS, isAdminEmail } from "../../shared/admin";
import { isRole, type Role } from "../../shared/roles";
export type Staff = { email: string; name: string; role: Role; active: boolean; lastActiveAt: string | null; createdAt: string };
type Row = { email: string; name: string | null; role: string; active: boolean; last_active_at: string | null; created_at: string };
/** A deleted founding owner keeps a row with this name so the built-in owner list does not bring them back. The row is hidden everywhere. */
const REMOVED = "__removed__";
const isGone = (r: Row | null | undefined) => !!r && r.name === REMOVED;
const toStaff = (r: Row): Staff => ({ email: r.email, name: r.name ?? "", role: isRole(r.role) ? r.role : "editor", active: r.active, lastActiveAt: r.last_active_at, createdAt: r.created_at });
const COLS = "email,name,role,active,last_active_at,created_at";
const cache = new Map<string, { at: number; row: Row | null }>(); const seen = new Map<string, number>();
const key = (e: string) => e.trim().toLowerCase();
const founding = (email: string) => ADMIN_EMAILS.includes(email);
async function rowFor(email: string): Promise<Row | null> {
  const k = key(email), hit = cache.get(k); if (hit && Date.now() - hit.at < 30_000) return hit.row;
  const row = must(await db().from("staff_members").select(COLS).eq("email", k).maybeSingle()) as Row | null;
  cache.set(k, { at: Date.now(), row }); return row;
}
/** The role this signed-in account has in the admin area, or null (not staff, inactive, removed, or e-mail not verified).
 *  The staff table decides. The built-in owner emails (shared/admin.ts) are only the starting list: they get in while they have no row yet, or while the table cannot be read, so the shop can never lock itself out. */
export async function roleFor(email: string | null | undefined, verified: boolean): Promise<Role | null> {
  if (!email || !verified) return null;
  try { const r = await rowFor(email); if (r) return !isGone(r) && r.active && isRole(r.role) ? r.role : null; } catch { /* table missing or offline: fall back below */ }
  return isAdminEmail(email, true) ? "owner" : null;
}
/** Remembers "last active" (at most once a minute per person). Never throws. */
export async function touchStaff(email: string | null | undefined, name?: string) {
  if (!email) return; const k = key(email); if (Date.now() - (seen.get(k) ?? 0) < 60_000) return; seen.set(k, Date.now());
  try {
    const now = new Date().toISOString();
    const rows = must(await db().from("staff_members").update({ last_active_at: now }).eq("email", k).select("email")) as unknown[];
    if (!rows.length && founding(k)) must(await db().from("staff_members").insert({ email: k, role: "owner", last_active_at: now, ...(name ? { name } : {}) }).select("email"));
    cache.delete(k);
  } catch { /* table missing or offline: ignore */ }
}
/** `ready` is false when the staff table has not been created yet (the built-in owners are still listed and still have access). */
export async function listStaff(): Promise<{ staff: Staff[]; ready: boolean }> {
  let all: Row[] = [], ready = true;
  try { all = must(await db().from("staff_members").select(COLS).order("created_at", { ascending: true })) as Row[]; } catch (e) { ready = false; console.error("[staff list]", e instanceof Error ? e.message : e); }
  const have = new Set(all.map((r) => r.email));
  const owners = ADMIN_EMAILS.filter((e) => !have.has(e)).map((email): Staff => ({ email, name: "", role: "owner", active: true, lastActiveAt: null, createdAt: "" }));
  const staff = [...all.filter((r) => !isGone(r)).map(toStaff), ...owners].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner") || a.createdAt.localeCompare(b.createdAt));
  return { staff, ready };
}
const SETUP = "The staff table is missing. Open Supabase > SQL Editor, paste supabase/setup_all.sql and click Run (safe to run again), then reload.";
const missing = (e: unknown) => /does not exist|schema cache|could not find the table|relation .* does not exist/i.test(e instanceof Error ? e.message : String(e));
/** Runs a staff write; a missing table becomes a plain-language message instead of a server error. */
async function guarded(fn: () => Promise<string | null>): Promise<string | null> { try { return await fn(); } catch (e) { if (missing(e)) return SETUP; throw e; } }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LAST_OWNER = "There must always be at least one active owner.";
export type StaffInput = { email?: unknown; name?: unknown; role?: unknown; active?: unknown };
const cleanName = (v: unknown) => { const n = String(v ?? "").trim().slice(0, 80); return n === REMOVED ? "" : n; };
/** True when nobody except `email` would be an active owner. */
const lastOwner = (staff: Staff[], email: string) => !staff.some((s) => s.email !== email && s.role === "owner" && s.active);
export const addStaff = (i: StaffInput) => guarded(() => addStaffRaw(i));
async function addStaffRaw(i: StaffInput): Promise<string | null> {
  const email = key(String(i.email ?? "")); if (!EMAIL.test(email) || email.length > 200) return "Enter a valid email address";
  if (!isRole(i.role)) return "Choose a role: Owner, Admin or Editor";
  const { staff } = await listStaff(); if (staff.some((s) => s.email === email)) return "That email is already on the team";
  const old = await rowFor(email).catch(() => null); cache.delete(email);
  if (isGone(old)) must(await db().from("staff_members").update({ name: cleanName(i.name), role: i.role, active: true, last_active_at: null }).eq("email", email).select("email")); // added back after being removed
  else must(await db().from("staff_members").insert({ email, name: cleanName(i.name), role: i.role, active: true }).select("email"));
  cache.delete(email); return null;
}
export const updateStaff = (i: StaffInput) => guarded(() => updateStaffRaw(i));
async function updateStaffRaw(i: StaffInput): Promise<string | null> {
  const email = key(String(i.email ?? "")); const patch: Record<string, unknown> = {};
  if (i.name !== undefined) patch.name = cleanName(i.name);
  if (i.role !== undefined) { if (!isRole(i.role)) return "Choose a role: Owner, Admin or Editor"; patch.role = i.role; }
  if (i.active !== undefined) patch.active = i.active === true;
  const { staff } = await listStaff(); const cur = staff.find((s) => s.email === email); if (!cur) return "Staff member not found";
  if (cur.role === "owner" && cur.active && ((patch.role ?? "owner") !== "owner" || patch.active === false) && lastOwner(staff, email)) return LAST_OWNER;
  const row = await rowFor(email).catch(() => null);
  must(await db().from("staff_members").upsert({ email, ...(row ? {} : { role: "owner", name: "" }), ...patch }, { onConflict: "email" }).select("email"));
  cache.delete(email); return null;
}
export const deleteStaff = (emailIn: string) => guarded(() => deleteStaffRaw(emailIn));
async function deleteStaffRaw(emailIn: string): Promise<string | null> {
  const email = key(emailIn); const { staff } = await listStaff(); const cur = staff.find((s) => s.email === email); if (!cur) return null;
  if (cur.role === "owner" && cur.active && lastOwner(staff, email)) return LAST_OWNER;
  if (founding(email)) must(await db().from("staff_members").upsert({ email, name: REMOVED, role: "editor", active: false }, { onConflict: "email" }).select("email")); // keep a hidden row so the built-in list does not bring this owner back
  else must(await db().from("staff_members").delete().eq("email", email).select("email"));
  cache.delete(email); return null;
}
