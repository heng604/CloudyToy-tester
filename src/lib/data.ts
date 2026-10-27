// Tiny stale-while-revalidate cache. Pages show cached data instantly and refresh in the background.
import { useCallback, useEffect, useReducer, useState } from "react";
type Entry = { data?: unknown; ts: number; inflight?: Promise<unknown> };
const cache = new Map<string, Entry>(); const subs = new Map<string, Set<() => void>>(); const fetchers = new Map<string, () => Promise<unknown>>();
const PFX = "ct-cache:";
function entry(key: string, persist: boolean): Entry {
  let e = cache.get(key);
  if (!e) { e = { ts: 0 }; if (persist) { try { const raw = localStorage.getItem(PFX + key); if (raw) { const j = JSON.parse(raw); e = { data: j.d, ts: 0 }; } } catch { /* ignore */ } } cache.set(key, e); }
  return e;
}
const notify = (key: string) => subs.get(key)?.forEach((f) => f());
export function load<T>(key: string, fetcher: () => Promise<T>, persist = false): Promise<T> {
  const e = entry(key, persist); fetchers.set(key, fetcher);
  if (e.inflight) return e.inflight as Promise<T>;
  const p = fetcher().then((d) => { e.data = d; e.ts = Date.now(); e.inflight = undefined; if (persist) try { localStorage.setItem(PFX + key, JSON.stringify({ d })); } catch { /* quota */ } notify(key); return d; }, (err) => { e.inflight = undefined; throw err; });
  e.inflight = p; return p;
}
/** Re-fetch every active key that starts with the prefix (used by realtime/poll). */
export function refreshPrefix(prefix: string) { for (const [k, f] of fetchers) if (k.startsWith(prefix) && subs.get(k)?.size) load(k, f as () => Promise<unknown>).catch(() => undefined); }
export function useResource<T>(key: string | null, fetcher: () => Promise<T>, o: { persist?: boolean; staleMs?: number } = {}) {
  const { persist = false, staleMs = 0 } = o; const [, force] = useReducer((x: number) => x + 1, 0); const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!key) return; setError(null);
    let s = subs.get(key); if (!s) subs.set(key, (s = new Set())); s.add(force);
    const e = entry(key, persist); fetchers.set(key, fetcher);
    if (e.data === undefined || Date.now() - e.ts > staleMs) load(key, fetcher, persist).catch(setError);
    return () => { s!.delete(force); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const refresh = useCallback(() => { if (key) load(key, fetcher, persist).catch(setError); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const e = key ? entry(key, persist) : undefined;
  return { data: e?.data as T | undefined, error, loading: key !== null && e?.data === undefined && !error, refresh };
}
