import { db, must } from "./db";
import { cached, invalidate } from "./cache";
import { PAGE_DEFS, resolvePage, type PageData, type PageSlug, type PagesStore } from "../../shared/pages";
async function readStore(): Promise<PagesStore> {
  try { return await cached("pages:store", 15_000, async () => { const r = must(await db().from("site_settings").select("value").eq("key", "pages").maybeSingle()) as { value: PagesStore } | null; return r?.value ?? {}; }); } catch { return {}; }
}
export async function getAllPages(): Promise<Record<PageSlug, PageData>> {
  const s = await readStore(); const out = {} as Record<PageSlug, PageData>;
  for (const d of PAGE_DEFS) out[d.slug] = resolvePage(s, d.slug);
  return out;
}
export async function savePage(slug: PageSlug, patch: Partial<PageData>) {
  const fresh = (must(await db().from("site_settings").select("value").eq("key", "pages").maybeSingle()) as { value: PagesStore } | null)?.value ?? {};
  const next: PagesStore = { ...fresh, [slug]: { ...fresh[slug], ...patch } };
  must(await db().from("site_settings").upsert({ key: "pages", value: next, updated_at: new Date().toISOString() }).select("key").single());
  invalidate("pages:");
}
