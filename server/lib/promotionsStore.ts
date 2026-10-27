// Pre-order rules + automatic discount campaigns in Supabase (table public.site_settings, key = "promotions"). Short cache, cleared on save.
import { db, must } from "./db";
import { DEFAULT_PROMOTIONS, normalizePromotions, type Promotions } from "../../shared/promotions";
let cache: { at: number; v: Promotions } | null = null;
export async function getPromotions(): Promise<Promotions> {
  if (cache && Date.now() - cache.at < 10_000) return cache.v;
  try {
    const r = must(await db().from("site_settings").select("value").eq("key", "promotions").maybeSingle()) as { value: unknown } | null;
    const v = normalizePromotions(r?.value); cache = { at: Date.now(), v }; return v;
  } catch { return DEFAULT_PROMOTIONS; }
}
export async function savePromotions(next: Promotions) {
  cache = null;
  must(await db().from("site_settings").upsert({ key: "promotions", value: next, updated_at: new Date().toISOString() }).select("key").single());
  cache = null;
}
