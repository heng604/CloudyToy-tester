import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Role } from "@shared/roles";
import { api } from "./api";
type A = { user: User | null; ready: boolean; isAdmin: boolean; role: Role | null; signOut: () => Promise<void> };
const Ctx = createContext<A>({ user: null, ready: false, isAdmin: false, role: null, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);
/** Sign-in time rule: after this many hours the customer must sign in again. Set VITE_SESSION_HOURS (e.g. 24 = every day, 168 = every week). 0 or empty = stay signed in until they sign out. */
const SESSION_HOURS = Number(import.meta.env.VITE_SESSION_HOURS ?? 0) || 0; const STAMP = "ct_signed_in_at";
/** Asks the server which admin role this signed-in account has (needs the session token). Null = not staff. */
export async function fetchRole(): Promise<Role | null> {
  try { const r = await api("/staff/me"); if (!r.ok) return null; const j = await r.json() as { role?: Role | null }; return j.role ?? null; } catch { return null; }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [sessionReady, setReady] = useState(!supabase);
  const [role, setRole] = useState<Role | null>(null); const [roleFor, setRoleFor] = useState<string | null>(null); // roleFor = the account id the role above belongs to
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const expired = () => { if (!SESSION_HOURS) return false; const at = Number(localStorage.getItem(STAMP) ?? 0); return at > 0 && Date.now() - at > SESSION_HOURS * 3600_000; };
    const stamp = (signedIn: boolean) => { try { if (!signedIn) localStorage.removeItem(STAMP); else if (!localStorage.getItem(STAMP)) localStorage.setItem(STAMP, String(Date.now())); } catch { /* storage blocked: rule not enforced */ } };
    const check = async () => { if (expired()) { stamp(false); await sb.auth.signOut(); } };
    sb.auth.getSession().then(async ({ data }) => { stamp(!!data.session); if (data.session && expired()) { stamp(false); await sb.auth.signOut(); setUser(null); } else setUser(data.session?.user ?? null); setReady(true); });
    const { data } = sb.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_OUT") stamp(false); else if (s) stamp(true); setUser(s?.user ?? null); setReady(true); });
    const id = SESSION_HOURS ? setInterval(() => void check(), 60_000) : undefined; const back = () => { if (!document.hidden) void check(); }; document.addEventListener("visibilitychange", back);
    return () => { data.subscription.unsubscribe(); if (id) clearInterval(id); document.removeEventListener("visibilitychange", back); };
  }, []);
  const uid = user?.id ?? null, mail = user?.email ?? null, verified = !!user?.email_confirmed_at;
  useEffect(() => {
    if (!uid) { setRole(null); setRoleFor(null); return; }
    let live = true; setRoleFor((cur) => (cur === uid ? cur : null)); // keep the known role while a token refresh re-runs this
    fetchRole().then((r) => { if (live) { setRole(r); setRoleFor(uid); } });
    return () => { live = false; };
  }, [uid, mail, verified]);
  const roleReady = !user || roleFor === user.id, ready = sessionReady && roleReady;
  const isAdmin = !!user && roleReady && role !== null;
  return <Ctx.Provider value={{ user, ready, isAdmin, role: isAdmin ? role : null, signOut: async () => { await supabase?.auth.signOut(); } }}>{children}</Ctx.Provider>;
}
