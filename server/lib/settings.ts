// Site settings in Supabase (table public.site_settings, key = "main"). Short in-memory cache, cleared on every save.
import { db, must } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "../../shared/types";
export { DEFAULT_SETTINGS };
let cache: { at: number; v: Settings } | null = null;
export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.v;
  try {
    const r = must(await db().from("site_settings").select("value").eq("key", "main").maybeSingle()) as { value: Partial<Settings> } | null;
    const v = { ...DEFAULT_SETTINGS, ...(r?.value ?? {}) }; if (!Array.isArray(v.banners)) v.banners = [];
    cache = { at: Date.now(), v }; return v;
  } catch { return DEFAULT_SETTINGS; }
}
export async function saveSettings(patch: Partial<Settings>) {
  cache = null;
  const next = { ...(await getSettings()), ...patch };
  must(await db().from("site_settings").upsert({ key: "main", value: next, updated_at: new Date().toISOString() }).select("key").single());
  cache = null;
}

/** Heartbeat of the shop-PC Bakong watcher, kept in its own row so it never touches the real settings. */
let lastBeat = 0; let seenCache: { at: number; v: number | null } | null = null;
export async function beatWatcher(hasPending: boolean) {
  const now = Date.now(); if (now - lastBeat < (hasPending ? 15_000 : 60_000)) return; lastBeat = now;
  try { must(await db().from("site_settings").upsert({ key: "bakong_watcher", value: { at: now }, updated_at: new Date().toISOString() }).select("key").single()); seenCache = null; } catch (e) { console.error("[watcher beat]", e); }
}
/** When the watcher last asked this server for work (ms since 1970), or null if never. */
export async function watcherSeenAt(): Promise<number | null> {
  if (seenCache && Date.now() - seenCache.at < 4000) return seenCache.v;
  try { const r = must(await db().from("site_settings").select("value").eq("key", "bakong_watcher").maybeSingle()) as { value?: { at?: number } } | null; const v = typeof r?.value?.at === "number" ? r.value.at : null; seenCache = { at: Date.now(), v }; return v; } catch { return null; }
}
