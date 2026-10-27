// Storefront data: read straight from Supabase with the public (anon) key. RLS only exposes active products and site settings.
import { useMemo } from "react";
import { supabase } from "./supabase";
import { useResource, load, refreshPrefix } from "./data";
import { DEFAULT_SETTINGS, type Settings } from "@shared/types";
import { toProduct, slugify, isShopVisible, type Product, type ProductRow } from "@shared/products";
import { hiddenFrom, resolvePage, type PagesStore, type PageSlug } from "@shared/pages";
import { DEFAULT_PROMOTIONS, normalizePromotions, type Promotions } from "@shared/promotions";
// Local preview without Supabase keys: sample products so the shop can be tried right after extracting.
const DEMO_PRODUCTS: Product[] = [
  ["Cloud Plush Bear", "Plush", 12.5, undefined, 20, "Soft and cuddly cloud bear for all ages."],
  ["Rainbow Stacking Rings", "Baby", 8, undefined, 15, "Classic stacking toy that builds hand-eye coordination."],
  ["Wooden Train Set", "Wooden", 24, undefined, 8, "Colourful wooden train with 20 track pieces."],
  ["Mini Building Blocks", "Building", 15, undefined, 3, "100 pieces, easy to snap together."],
  ["Bunny Rattle", "Baby", 6.5, undefined, 0, "Gentle rattle for little hands."],
  ["Puzzle Park (48 pcs)", "Puzzle", 10, undefined, 12, "Park-themed floor puzzle."],
].map(([name, category, price, salePrice, stock, description], i) => ({
  id: `demo-${i + 1}`, slug: slugify(String(name)), name: String(name), sku: `DEMO-${100 + i}`, price: price as number, salePrice: salePrice as number | undefined,
  stock: stock as number, category: String(category), description: String(description), images: [], active: true, createdAt: new Date(Date.now() - i * 86400000 * 5).toISOString(),
}));
const need = () => { if (!supabase) throw new Error("Supabase is not configured"); return supabase; };
const COLS = "id,slug,name,sku,price,sale_price,stock,created_at,category,description,images,active";
export const fetchProducts = async (): Promise<Product[]> => { if (!supabase) return DEMO_PRODUCTS; const q = (cols: string) => need().from("products").select(cols).eq("active", true).order("created_at", { ascending: false });
  let r = await q(`${COLS},out_of_stock_at,name_km,brand,uom,variants,labels`); if (r.error) r = await q(`${COLS},out_of_stock_at`); if (r.error) r = await q(COLS); /* column not created yet (SQL migration 0011 not run): still show everything */ if (r.error) throw new Error(r.error.message); return (r.data as unknown as ProductRow[]).map(toProduct); };
export const fetchSettings = async (): Promise<Settings> => {
  try { const r = await need().from("site_settings").select("value").eq("key", "main").maybeSingle(); const v = { ...DEFAULT_SETTINGS, ...((r.data?.value as Partial<Settings>) ?? {}) }; if (!Array.isArray(v.banners)) v.banners = []; return v; } catch { return DEFAULT_SETTINGS; }
};
export const fetchPages = async (): Promise<PagesStore> => { try { const r = await need().from("site_settings").select("value").eq("key", "pages").maybeSingle(); return (r.data?.value as PagesStore) ?? {}; } catch { return {}; } };
export const fetchPromotions = async (): Promise<Promotions> => { try { const r = await need().from("site_settings").select("value").eq("key", "promotions").maybeSingle(); return normalizePromotions(r.data?.value); } catch { return DEFAULT_PROMOTIONS; } };
export const usePromotions = () => { const r = useResource("promotions", fetchPromotions, { persist: true, staleMs: 30_000 }); return { ...r, promotions: r.data ?? DEFAULT_PROMOTIONS }; };
export const useProducts = () => useResource("products", fetchProducts, { persist: true, staleMs: 15_000 });
/** Products the shop shows: out-of-stock ones disappear after 2 days until the admin adds stock again. */
export const useListedProducts = () => { const r = useProducts(); const data = useMemo(() => r.data?.filter((p) => isShopVisible(p)), [r.data]); return { ...r, data }; };
export const useSettings = () => { const r = useResource("settings", fetchSettings, { persist: true, staleMs: 30_000 }); return { ...r, settings: r.data ?? DEFAULT_SETTINGS }; };
export const usePages = () => { const r = useResource("pages", fetchPages, { persist: true, staleMs: 30_000 }); return { ...r, hidden: hiddenFrom(r.data ?? {}), page: (slug: PageSlug) => (r.data ? resolvePage(r.data, slug) : null) }; };
/** Start downloading as soon as the script loads, before React has rendered. */
export function prefetchStore() { if (!supabase) return; load("products", fetchProducts, true).catch(() => undefined); load("settings", fetchSettings, true).catch(() => undefined); load("pages", fetchPages, true).catch(() => undefined); }
export const refreshStore = () => refreshPrefix("");
