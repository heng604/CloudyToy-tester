import { supabase } from "./supabase";
/** fetch() to our API; adds the signed-in user's token so admin/account routes can verify who is calling. */
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`/api${path}`, { ...init, headers });
}
export async function apiJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await api(path, init);
  if (!r.ok) {
    const j = await r.json().catch(() => ({})) as { detail?: string; hint?: string };
    const e = new Error(`HTTP ${r.status}`) as Error & { status: number; detail?: string; hint?: string }; e.status = r.status; e.detail = j.detail; e.hint = j.hint; throw e;
  }
  return r.json();
}
export const post = (path: string, body?: unknown) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
/** Download a file from an admin route (needs the token, so a plain link will not work). */
export async function download(path: string) {
  const r = await api(path); if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? "export";
  const url = URL.createObjectURL(await r.blob()); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
