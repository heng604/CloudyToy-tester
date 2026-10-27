export type Product = { id: string; slug: string; name: string; nameKm?: string; brand?: string; uom?: string; variants?: string; labels?: ProductLabel[]; sku: string; price: number; salePrice?: number; stock: number; category: string; description: string; images: { src: string; alt: string }[]; active?: boolean; createdAt?: string; outOfStockAt?: string; preorderStart?: string; preorderEnd?: string };
/** Labels the admin can tick on a product. "preorder" turns the product into a pre-order item (see shared/promotions.ts). */
export const LABELS = [{ id: "new_arrival", en: "New Arrival", km: "មកថ្មី" }, { id: "restock", en: "Restock", km: "ចូលស្តុកឡើងវិញ" }, { id: "limited_edition", en: "Limited Edition", km: "ចំនួនកំណត់" }, { id: "preorder", en: "Pre-Order Item", km: "កម្មង់មុន" }, { id: "best_seller", en: "Best Seller", km: "លក់ដាច់បំផុត" }] as const;
export type ProductLabel = (typeof LABELS)[number]["id"];
/** Look of each label on the shop (card + product page). Out of stock has its own grey badge. */
export const LABEL_CLASS: Record<ProductLabel, string> = { new_arrival: "bg-[#DD0000] text-white", restock: "bg-[#40F146] text-white", limited_edition: "bg-[#C1ADE4] text-white", preorder: "bg-[#FFE597] text-white", best_seller: "bg-[#99C3E4] text-white" };
/** Short text on the card: "New", "Restock", "Limited Edition", "Pre-Order". */
export const LABEL_SHORT: Record<ProductLabel, { en: string; km: string }> = { new_arrival: { en: "New", km: "មកថ្មី" }, restock: { en: "Restock", km: "ចូលស្តុកឡើងវិញ" }, limited_edition: { en: "Limited Edition", km: "ចំនួនកំណត់" }, preorder: { en: "Pre-Order", km: "កម្មង់មុន" }, best_seller: { en: "Best Seller", km: "លក់ដាច់បំផុត" } };
export const LABEL_IDS: string[] = LABELS.map((l) => l.id);
/** A product shows ONE label badge only. If it somehow has several, the first of this list wins (so Best Seller beats Restock); New Arrival only shows when nothing else is chosen. */
const BADGE_ORDER: ProductLabel[] = ["preorder", "best_seller", "limited_edition", "restock", "new_arrival"];
export const badgeLabels = (p: { labels?: readonly string[] }): (typeof LABELS)[number][] => { const id = BADGE_ORDER.find((x) => p.labels?.includes(x)); return LABELS.filter((l) => l.id === id); };
export const isPreorder = (p: { labels?: readonly string[] }) => !!p.labels?.includes("preorder");
/** Each pre-order product has its OWN window: it opens on preorderStart and its deadline is preorderEnd (both YYYY-MM-DD, deadline day included). Both empty = no dates, always open. */
const isoDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
export function checkPreorderDates(startIn: unknown, endIn: unknown): { ok: true; start: string; end: string } | { ok: false; error: string } {
  const start = String(startIn ?? "").trim(), end = String(endIn ?? "").trim();
  if ((start === "") !== (end === "")) return { ok: false, error: "Set both the pre-order start date and its deadline, or leave both empty" };
  if (start && (!isoDay(start) || !isoDay(end))) return { ok: false, error: "Pre-order dates must be real calendar dates" };
  if (start && end < start) return { ok: false, error: "The pre-order deadline cannot be before the start date" };
  return { ok: true, start, end };
}
/** Today in Cambodia (UTC+7) as YYYY-MM-DD, so a deadline ends at midnight shop time, not UTC. */
export const shopToday = (now = Date.now()) => new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
/** "upcoming" = not open yet, "open" = can be ordered now, "closed" = deadline passed. Products without dates are always "open". */
export function preorderPhase(w: { preorderStart?: string; preorderEnd?: string }, now = Date.now()): "upcoming" | "open" | "closed" {
  if (!w.preorderStart || !w.preorderEnd) return "open"; const d = shopToday(now);
  return d < w.preorderStart ? "upcoming" : d > w.preorderEnd ? "closed" : "open";
}
/** A pre-order item whose own deadline has passed: customers can no longer order it and the shop stops showing it. The product itself, and every order already placed, stay in the database and the admin dashboard. */
export const isPreorderClosed = (p: { labels?: readonly string[]; preorderStart?: string; preorderEnd?: string }, now = Date.now()) => isPreorder(p) && preorderPhase(p, now) === "closed";
/** What the public shop shows: listed (stock rule) and not past its pre-order deadline. The admin dashboard still lists everything. */
export const isShopVisible = (p: Parameters<typeof isListed>[0] & Parameters<typeof isPreorderClosed>[0], now = Date.now()) => isListed(p, now) && !isPreorderClosed(p, now);
/** "1 Nov 2026" from a YYYY-MM-DD day. */
export const dayShort = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** "1 Nov 2026 to 15 Nov 2026", or "" when the item has no dates. */
export const windowText = (w: { preorderStart?: string; preorderEnd?: string }) => (w.preorderStart && w.preorderEnd ? `${dayShort(w.preorderStart)} to ${dayShort(w.preorderEnd)}` : "");
/** Khmer name when the shop is in Khmer and the admin typed one; otherwise the English name. */
export const nameFor = (p: { name: string; nameKm?: string }, lang: string) => (lang === "km" && p.nameKm ? p.nameKm : p.name);
/** Shop hides a product that has been out of stock for this long. Adding stock shows it again. */
export const HIDE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
export const isListed = (p: Pick<Product, "stock" | "outOfStockAt">, now = Date.now()) => p.stock > 0 || !p.outOfStockAt || now - new Date(p.outOfStockAt).getTime() < HIDE_AFTER_MS;
export const FALLBACK_IMG = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#EAF5FF'/><path d='M110 190a40 40 0 0 1 12-78 55 55 0 0 1 106-8 45 45 0 0 1 58 86z' fill='#8ECCFF'/></svg>");
export const money = (n: number) => `$${n.toFixed(2)}`;
/** A product counts as "New" for 1 week (7 days) after the admin adds it. */
export const NEW_DAYS = 7;
export const isNewProduct = (createdAt?: string, now = Date.now()) => !!createdAt && now - new Date(createdAt).getTime() < NEW_DAYS * 86400000;
export const LOW_STOCK = 5;
export const stockStatus = (stock: number): "OUT" | "LOW" | "OK" => (stock <= 0 ? "OUT" : stock <= LOW_STOCK ? "LOW" : "OK");
export const categoriesOf = (list: Product[]) => [...new Set(list.map((p) => p.category).filter(Boolean))].sort();
export function slugify(s: string) { return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "product"; }
/** Row shape of public.products and its mapping to Product (used by both the browser and the server). */
export type ProductRow = { id: string; slug: string; name: string; sku: string; price: number | string; sale_price: number | string | null; stock: number; created_at: string; category: string | null; description: string | null; images: { src: string; alt: string }[] | null; active: boolean; out_of_stock_at?: string | null; name_km?: string | null; brand?: string | null; uom?: string | null; variants?: string | null; labels?: string[] | null; preorder_start?: string | null; preorder_end?: string | null };
export const toProduct = (r: ProductRow): Product => ({ id: r.id, slug: r.slug, name: r.name, sku: r.sku, price: Number(r.price), stock: r.stock, category: r.category ?? "", createdAt: r.created_at, description: r.description ?? "", images: r.images ?? [], active: r.active, ...(r.out_of_stock_at ? { outOfStockAt: r.out_of_stock_at } : {}), ...(r.preorder_start && r.preorder_end ? { preorderStart: String(r.preorder_start).slice(0, 10), preorderEnd: String(r.preorder_end).slice(0, 10) } : {}),
  ...(r.name_km ? { nameKm: r.name_km } : {}), ...(r.brand ? { brand: r.brand } : {}), ...(r.uom ? { uom: r.uom } : {}), ...(r.variants ? { variants: r.variants } : {}), ...(r.labels?.length ? { labels: r.labels.filter((l) => LABEL_IDS.includes(l)) as ProductLabel[] } : {}) });
