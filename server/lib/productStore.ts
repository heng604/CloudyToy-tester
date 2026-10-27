// Products in Supabase (table public.products) + images in Supabase Storage (bucket "product-images").
// Permanent: products only disappear when an admin deletes them. No automatic re-seeding.
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { IS_WORKER } from "./runtime";
import { join } from "node:path";
import { db, must } from "./db";
import { cached, invalidate } from "./cache";
import { r2Enabled, r2Put, r2Delete, r2PublicBase } from "./r2";
import { toProduct, slugify, type Product, type ProductRow } from "../../shared/products";
export { stockStatus, LOW_STOCK, categoriesOf } from "../../shared/products";
const BUCKET = "product-images";
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Every product, including hidden ones. Admin only. */
export async function listAllProducts(): Promise<Product[]> { return (must(await db().from("products").select("*").order("created_at", { ascending: true })) as ProductRow[]).map(toProduct); }
/** Storefront view: hidden products are never returned. Cached for 5 s (and cleared on every product/stock change). Pass fresh=true when stock must be exact. */
export async function listProducts(fresh = false): Promise<Product[]> {
  const run = async () => (must(await db().from("products").select("*").eq("active", true).order("created_at", { ascending: false })) as ProductRow[]).map(toProduct);
  return fresh ? run() : cached("products:active", 5_000, run);
}
/** Only the active products named in `ids` (checkout / discount preview: a cart has 1-3 items, not the whole catalogue). Always fresh. */
export async function listProductsByIds(ids: string[]): Promise<Product[]> {
  const list = [...new Set(ids.filter(isUuid))]; if (!list.length) return [];
  return (must(await db().from("products").select("*").eq("active", true).in("id", list)) as ProductRow[]).map(toProduct);
}
/** { productId: first image } in ONE query (used by the "meet your toys" e-mail instead of loading the whole catalogue). */
export async function firstImagesById(ids: string[]): Promise<Record<string, string>> {
  const list = [...new Set(ids.filter(isUuid))]; const out: Record<string, string> = {}; if (!list.length) return out;
  for (const r of must(await db().from("products").select("id,images").in("id", list)) as { id: string; images: { src: string }[] | null }[]) { const src = r.images?.[0]?.src; if (src) out[r.id] = src; }
  return out;
}
/** Category -> product count, reading only the category column (not every full product row). */
export async function categoryCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const r of must(await db().from("products").select("category")) as { category: string | null }[]) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return counts;
}
export async function getProductById(id: string) { if (!isUuid(id)) return null; const r = must(await db().from("products").select("*").eq("id", id).maybeSingle()) as ProductRow | null; return r ? toProduct(r) : null; }

export async function upsertProduct(p: Omit<Product, "id" | "slug"> & { id?: string }) {
  const fields = { name: p.name, name_km: p.nameKm || null, brand: p.brand || null, uom: p.uom || null, variants: p.variants || null, labels: p.labels ?? [], sku: p.sku, category: p.category, description: p.description, price: p.price, stock: p.stock, images: p.images, preorder_start: p.preorderStart || null, preorder_end: p.preorderEnd || null, active: p.active !== false, updated_at: new Date().toISOString() };
  if (p.id) { must(await db().from("products").update(fields).eq("id", p.id).select("id").single()); invalidate("products:"); return p.id; }
  const base = slugify(p.name);
  const taken = new Set((must(await db().from("products").select("slug").like("slug", `${base}%`)) as { slug: string }[]).map((x) => x.slug));
  let slug = base, n = 2; while (taken.has(slug)) slug = `${base}-${n++}`;
  const id = (must(await db().from("products").insert({ ...fields, slug }).select("id").single()) as { id: string }).id; invalidate("products:"); return id;
}
/** Move every product from one category to another (rename or merge). */
export async function renameCategory(from: string, to: string) { if (from !== to) { must(await db().from("products").update({ category: to, updated_at: new Date().toISOString() }).eq("category", from).select("id")); invalidate("products:"); } }
/** Replace a product's labels (used by the quick "remove label" button in the admin table). */
export async function setLabels(id: string, labels: string[]) { if (!isUuid(id)) return; must(await db().from("products").update({ labels, updated_at: new Date().toISOString() }).eq("id", id).select("id")); invalidate("products:"); }
export async function skuTaken(sku: string, exceptId?: string) {
  const rows = must(await db().from("products").select("id").ilike("sku", sku.replace(/[\\%_]/g, "\\$&"))) as { id: string }[];
  return rows.some((r) => r.id !== exceptId);
}
export async function deleteProduct(id: string) {
  if (!isUuid(id)) return;
  // one query: delete the row and get its images back (no separate read first)
  const gone = must(await db().from("products").delete().eq("id", id).select("id,images")) as { id: string; images: { src: string }[] | null }[];
  invalidate("products:");
  if (gone[0]) await deleteProductImages((gone[0].images ?? []).map((i) => i.src));
}
export async function setStock(id: string, stock: number) { if (!isUuid(id)) return; must(await db().from("products").update({ stock: Math.max(0, Math.floor(stock)), updated_at: new Date().toISOString() }).eq("id", id).select("id")); invalidate("products:"); }
/** Atomic: throws INSUFFICIENT_STOCK (and changes nothing) if any line exceeds current stock. */
export async function decrementStock(items: { productId: string; qty: number }[]) {
  const r = await db().rpc("decrement_stock", { items });
  invalidate("products:");
  if (r.error) throw new Error(r.error.message.includes("INSUFFICIENT_STOCK") ? "INSUFFICIENT_STOCK" : r.error.message);
}
/** Undo a decrement (used only if saving the order fails afterwards). */
export async function restoreStock(items: { productId: string; qty: number }[]) { must(await db().rpc("restore_stock", { items })); invalidate("products:"); }

/** Upload a validated image; returns its permanent public URL. */
/** Every uploaded image is kept in two places: Supabase Storage (the database copy, always) and a copy in public/img/uploads (only where the server can write files, e.g. your own PC / server; Vercel's disk is read-only, so there the copy is skipped). */
const LOCAL_DIR = join(process.cwd(), "public", "img", "uploads");
const safeName = (n: string) => /^[a-z0-9-]+\.(jpg|png|webp)$/.test(n);
export async function uploadProductImage(name: string, bytes: Uint8Array, mime: string) {
  // Cloudflare R2 when configured (R2_* variables), otherwise Supabase Storage.
  const url = r2Enabled() ? await r2Put(name, bytes, mime) : await uploadToSupabase(name, bytes, mime);
  if (!IS_WORKER && safeName(name)) { try { await mkdir(LOCAL_DIR, { recursive: true }); await writeFile(join(LOCAL_DIR, name), bytes); } catch { /* read-only disk: the stored copy is enough */ } }
  return url;
}
async function uploadToSupabase(name: string, bytes: Uint8Array, mime: string) {
  const s = db().storage.from(BUCKET); const r = await s.upload(name, bytes, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (r.error) throw new Error(r.error.message);
  return s.getPublicUrl(name).data.publicUrl;
}
/** Deleting an image removes it from where it is stored (R2 or Supabase) and from public/img/uploads. */
export async function deleteProductImages(srcs: string[]) {
  const base = r2Enabled() ? r2PublicBase() : "";
  const onR2 = (src: string) => !!base && src.startsWith(base + "/"); // images saved before the switch still live in Supabase
  const nameOf = (s: string) => s.split("/").pop() ?? "";
  const r2Names = srcs.filter(onR2).map(nameOf).filter(safeName);
  const sbNames = srcs.filter((s) => !onR2(s)).map(nameOf).filter(safeName);
  if (r2Names.length) await r2Delete(r2Names).catch(() => undefined);
  if (sbNames.length) await db().storage.from(BUCKET).remove(sbNames).catch(() => undefined);
  await Promise.all([...r2Names, ...sbNames].map((n) => unlink(join(LOCAL_DIR, n)).catch(() => undefined)));
}
