// Tiny in-memory TTL cache (per server instance) with two protections:
//  1) in-flight de-duplication: 50 simultaneous requests for the same key run ONE database query;
//  2) epoch check: if the data is invalidated while a query is running, that stale result is not stored.
type Entry = { at: number; v?: unknown; p?: Promise<unknown> };
const store = new Map<string, Entry>();
let epoch = 0;

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const e = store.get(key);
  if (e && e.v !== undefined && Date.now() - e.at < ttlMs) return e.v as T;
  if (e?.p) return e.p as Promise<T>;
  const startedAt = epoch;
  const p: Promise<T> = fn().then(
    (v) => { if (epoch === startedAt) store.set(key, { at: Date.now(), v }); else if (store.get(key)?.p === p) store.delete(key); return v; },
    (err) => { if (store.get(key)?.p === p) store.delete(key); throw err; },
  );
  store.set(key, { at: e?.at ?? 0, v: e?.v, p });
  return p;
}

/** Drops every cached entry whose key starts with the prefix (call after any write to that data). */
export function invalidate(prefix = "") {
  epoch++;
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
