import { useEffect, useState } from "react";
import { useResource, refreshPrefix } from "@/lib/data";
import { apiJson } from "@/lib/api";
import { refreshStore } from "@/lib/store";
import type { User } from "@supabase/supabase-js";
/** Admin data comes from the API (needs the admin token). Keys start with "admin:" so one call refreshes all of them. */
export const useAdmin = <T,>(path: string) => {
  const r = useResource<T>(`admin:${path}`, () => apiJson<T>(path));
  useEffect(() => { if (r.error) { const e = r.error as Error & { detail?: string; hint?: string }; window.dispatchEvent(new CustomEvent("admin-load-error", { detail: { msg: e.message, detail: e.detail ?? "", hint: e.hint ?? "" } })); }; }, [r.error]);
  return r;
};
/** Red banner shown by the admin layout when any admin data request fails (instead of grey loading blocks forever). */
type LoadErr = { msg: string; detail: string; hint: string };
export function AdminErrorBanner() {
  const [err, setErr] = useState<LoadErr | null>(null);
  useEffect(() => { const h = (e: Event) => setErr((e as CustomEvent).detail as LoadErr); window.addEventListener("admin-load-error", h); return () => window.removeEventListener("admin-load-error", h); }, []);
  if (!err) return null;
  return <div role="alert" className="space-y-2 rounded-xl bg-red-100 p-4 text-sm text-red-900 sm:text-base"><p><b>Could not load admin data ({err.msg}).</b></p>
    {err.hint && <p>{err.hint}</p>}
    {err.detail && <p className="break-words rounded-lg bg-white/60 p-2 font-mono text-xs">Cause: {err.detail}</p>}
    {!err.hint && <p>Common causes: the database tables are missing (open Supabase &gt; SQL Editor, paste <code>supabase/setup_all.sql</code> and Run; it is safe to run again) or <code>SUPABASE_SERVICE_ROLE_KEY</code> is missing in <code>.env.local</code>.</p>}
    <button type="button" onClick={() => { setErr(null); refreshAdmin(); }} className="rounded-full bg-white px-4 py-2 font-bold hover:bg-red-50">Try again</button></div>;
}
export const refreshAdmin = () => { refreshPrefix("admin:"); refreshStore(); };
export const Msg = ({ ok, err }: { ok?: string | null; err?: string | null }) => <>{ok && <p role="status" className="rounded-xl bg-green-100 p-3">{ok}</p>}{err && <p role="alert" className="rounded-xl bg-red-100 p-3">{err}</p>}</>;
/** Name shown for the signed-in admin: Google/profile name if there is one, else the part of the email before @. */
export const displayName = (u: User | null) => { const m = (u?.user_metadata ?? {}) as { full_name?: string; name?: string }; return (m.full_name || m.name || u?.email?.split("@")[0] || "Admin").trim(); };
