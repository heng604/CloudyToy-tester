import crypto from "node:crypto";
import { PROVINCE_NAMES } from "../shared/provinces";
import "./env";
import express, { type Request, type Response } from "express";
import compression from "compression";
import { upload, type UploadedFile } from "./lib/multipart";
import { toWebp } from "./lib/image";
import { IS_WORKER } from "./lib/runtime";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { requireAdmin, requireUser, userFromReq, adminOf, userOf, needs, roleOf } from "./lib/auth";
import { roleFor, listStaff, addStaff, updateStaff, deleteStaff } from "./lib/staff";
import { getPromotions, savePromotions } from "./lib/promotionsStore";
import { tooMany, clientKey } from "./lib/rateLimit";
import { listProducts, listProductsByIds, firstImagesById, categoryCounts, listAllProducts, renameCategory, setLabels, getProductById, upsertProduct, skuTaken, deleteProduct, setStock, decrementStock, restoreStock, uploadProductImage, deleteProductImages } from "./lib/productStore";
import { resolveDiscount, listStoreDiscounts, createStoreDiscount, updateStoreDiscount, deleteStoreDiscount } from "./lib/discountStore";
import { saveOrder, getOrder, updateOrder, markPaidOnce, listAllOrders, listOrdersByEmail, deleteAllOrders, listAdminOrders, listPendingBakong, markUnpaidOnce, listPendingBakongAll, updatePendingOrder, listProofPaths } from "./lib/store";
import { getSettings, saveSettings, DEFAULT_SETTINGS, beatWatcher, watcherSeenAt } from "./lib/settings";
import { getAllPages, savePage } from "./lib/pages";
import { sendAdminEmail, sendPaidOrderEmail, sendCustomerEmail, sendCustomerItemsEmail, sendBakongPaidEmail } from "./lib/email";
import { methodOn } from "../shared/payOptions";
import { bakongEnabled, makeKhqr, checkPaid, bakongName, bakongDiagnose, matchPaid, watcherSecret, QR_MAX, QR_GRACE_MS } from "./lib/bakong";
import { uploadProof, deleteProofs, proofUrls } from "./lib/proofStore";
import { ordersDataset, transactionsDataset, deliveryDataset, productsDataset, stockDataset } from "./lib/exports";
import { toCsv } from "../shared/csv";
import { buildPdf } from "./lib/pdf";
import { buildXlsx } from "./lib/xlsx";
import { buildSheetHtml } from "./lib/sheetHtml";
import { INVOICE_LOGO } from "../shared/invoice";
import { makeMeta } from "./lib/report";
import { filterOrders, sortOrders } from "../shared/stats";
import { computeTotals, type PricedProduct } from "../shared/pricing";
import { methodAllowed, shippingFor } from "../shared/delivery";
import { normalizeCode, CODE_RE, percentOk } from "../shared/discount";
import { validateImage, safeFileName } from "../shared/images";
import { canPay, payNowCents } from "../shared/orders";
import { can } from "../shared/roles";
import { autoDiscounts, autoTotal, preorderSplit, checkPreorder, checkCampaign, MAX_CAMPAIGNS } from "../shared/promotions";
import { isSlug, MAX_CONTENT, PAGE_DEFS } from "../shared/pages";
import { isPreorder, LABEL_IDS, checkPreorderDates, preorderPhase, dayShort } from "../shared/products";

import type { StoredOrder } from "../shared/types";
import { publicOrder } from "./lib/publicOrder";
/** "Meet your toys" e-mail with a photo of every product in the order. Never throws: the order must not fail because of an e-mail. */
async function sendItemsMail(order: StoredOrder) {
  try { const images = await firstImagesById(order.items.map((i) => i.productId)); // one small query instead of loading the whole catalogue
    const r = await sendCustomerItemsEmail(order, images); if (r.status === "FAILED") console.error("[items email]", order.orderNumber, r.detail); return r; }
  catch (e) { console.error("[items email]", order.orderNumber, e); return { status: "FAILED" as const, detail: "Could not send" }; }
}
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
/** Security headers on every response (clickjacking, MIME sniffing, XSS, HTTPS downgrade, leaky referrers). */
const R2_ORIGIN = (() => { try { return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).origin : ""; } catch { return ""; } })(); // Cloudflare R2 image address (only if configured)
const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: https://*.supabase.co https://*.r2.dev ${R2_ORIGIN}`.trim(), "connect-src 'self' https://*.supabase.co wss://*.supabase.co", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
app.use((_req, res, next) => {
  res.set({ "Content-Security-Policy": CSP, "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()", "Strict-Transport-Security": "max-age=31536000; includeSubDomains", "Cross-Origin-Opener-Policy": "same-origin", "X-Permitted-Cross-Domain-Policies": "none", "X-DNS-Prefetch-Control": "off" });
  next();
});
if (!IS_WORKER) app.use(compression()); // Cloudflare already compresses responses
app.use(express.json({ limit: "1mb" }));
const api = express.Router();
api.use((_req, res, next) => { res.set("Cache-Control", "private, no-cache"); next(); }); // API answers are per-user: browsers may keep them but must revalidate (ETag -> cheap 304), shared caches must not store them
api.use((req, res, next) => { // overall brake per visitor: stops scripted flooding / scanning of the API
  if (tooMany(`all:${clientKey(req)}`, 300)) return res.status(429).json({ error: "Too many requests. Please wait a minute." });
  next(); });
api.get("/health", (_req, res) => res.json({ ok: true, db: !!(process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) }));
/** Plain-language hint for the most common setup problems (shown to the admin only). */
const hint = (m: string) => /relation .* does not exist|could not find the table|schema cache|column .* does not exist|function .* does not exist|Could not find the function/i.test(m) ? "Database tables are missing or out of date. Open Supabase > SQL Editor, paste supabase/setup_all.sql and click Run (it is safe to run again), then reload."
  : /not configured|SUPABASE_SERVICE_ROLE_KEY/i.test(m) ? "SUPABASE_SERVICE_ROLE_KEY (or the Supabase URL) is missing in .env.local. Add it and restart npm run dev."
  : /invalid api key|jwt|apikey/i.test(m) ? "The Supabase key is wrong. Copy the service_role / secret key from Supabase > Project Settings > API into SUPABASE_SERVICE_ROLE_KEY."
  : /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(m) ? "The server cannot reach Supabase. Check VITE_SUPABASE_URL and your internet connection."
  : "";
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) => { fn(req, res).catch((e) => {
  console.error("[api]", req.path, e); const msg = e instanceof Error ? e.message : String(e);
  // Only admin routes explain the cause; public routes stay generic.
  const body = req.path.startsWith("/admin") ? { error: "Server error", detail: msg, hint: hint(msg) } : { error: "Server error" };
  if (!res.headersSent) res.status(500).json(body); }); };
const files = (req: Request, name: string) => ((req.files as UploadedFile[] | undefined) ?? []).filter((f) => f.fieldname === name && f.size > 0);
const fld = (req: Request, k: string) => String((req.body as Record<string, unknown>)?.[k] ?? "");
const all = (req: Request, k: string): string[] => { const v = (req.body as Record<string, unknown>)?.[k]; return v === undefined ? [] : Array.isArray(v) ? v.map(String) : [String(v)]; };
const catalogOf = (products: Awaited<ReturnType<typeof listProducts>>) => new Map<string, PricedProduct>(products.map((p) => [p.id, { id: p.id, name: p.name, priceCents: Math.round(p.price * 100), saleCents: p.salePrice ? Math.round(p.salePrice * 100) : null, stock: p.stock, active: true }]));

/* ---------------- public: checkout ---------------- */
const Body = z.object({
  customer: z.object({ name: z.string().trim().min(2).max(100), email: z.union([z.literal(""), z.string().trim().email().max(200)]).optional().transform((v) => v ?? ""), phone: z.string().trim().min(6).max(30), address: z.string().trim().min(5).max(400), notes: z.string().trim().max(300).optional(), facebook: z.string().trim().max(100).optional(), telegram: z.string().trim().max(100).optional() }),
  lines: z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(99) })).min(1).max(50),
  area: z.enum(["PHNOM_PENH", "PROVINCE"]), province: z.enum(PROVINCE_NAMES).optional(), method: z.enum(["COD", "QR_IMAGE", "BAKONG"]), code: z.string().trim().max(40).optional(), preorderPay: z.enum(["deposit", "full"]).optional(),
});
/** A pre-order product's own open date and deadline, copied onto its order line (empty for normal products or when no dates are set). */
const itemDates = (p?: { labels?: readonly string[]; preorderStart?: string; preorderEnd?: string }) => (p && isPreorder(p) && p.preorderStart && p.preorderEnd ? { opens: p.preorderStart, closes: p.preorderEnd } : {});
const LABELS: Record<string, string> = { name: "Full name (at least 2 characters)", email: "Email (a valid address)", phone: "Phone (at least 6 digits)", address: "Delivery address (5 to 400 characters)", notes: "Delivery instructions (max 300 characters)", area: "Delivery area", method: "Payment method" };
api.post("/checkout", requireUser, wrap(async (req, res) => {
  const raw = req.body; const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const bad = [...new Set(parsed.error.issues.map((i) => { const k = String(i.path[0] === "customer" ? i.path[1] : i.path[0]); const v = raw?.customer?.[k]; return (LABELS[k] ?? "Cart items") + (i.path[0] === "customer" ? `, ${typeof v === "string" ? `you entered ${v.trim().length}` : "nothing received"}` : ""); }))];
    return res.status(400).json({ error: `Please check: ${bad.join("; ")}.` });
  }
  const { customer, lines, area, method } = parsed.data; const codeIn = normalizeCode(parsed.data.code ?? "");
  if (codeIn && tooMany(`c:${clientKey(req)}`)) return res.status(429).json({ error: "Too many tries. Please wait a minute." });
  if (codeIn && !CODE_RE.test(codeIn)) return res.status(400).json({ error: "That discount code is not valid." });
  if (area === "PROVINCE" && !parsed.data.province) return res.status(400).json({ error: "Please choose your province." });
  if (method === "BAKONG" && !bakongEnabled()) return res.status(400).json({ error: "Bakong payment is not available right now. Please choose another payment method." });
  if (!methodAllowed(method, area)) return res.status(400).json({ error: "Pay with delivery is only available in Phnom Penh." });
  const acct = userOf(req); const ids = lines.map((l) => l.productId); // only the products in this cart are read (a cart has a few items, the catalogue has hundreds)
  // abandoned Bakong orders give their stock back BEFORE the stock check (swept at most every 5 s); settings load at the same time
  const [settings, products] = await Promise.all([getSettings(), expireStaleBakong(5_000).then(() => listProductsByIds(ids))]);
  if (!methodOn(settings, method)) return res.status(400).json({ error: "This payment option is not available right now. Please choose another one." });
  const catalog = catalogOf(products); let usedCode: string | undefined;
  try {
    const ship = shippingFor(area, settings); const promos = await getPromotions();
    const t0 = computeTotals(lines, catalog, ship); const byId = new Map(products.map((p) => [p.id, p]));
    // automatic campaigns first (stack, never more than the subtotal), then the typed code takes its % off what is left
    const auto = autoDiscounts(t0.items.map((i) => ({ category: byId.get(i.productId)?.category ?? "", lineCents: i.lineCents })), promos.campaigns);
    let discount = autoTotal(auto);
    if (codeIn) { // admin-created codes only (% off the subtotal); checked on the server, never trusted from the browser
      const ev = await resolveDiscount(codeIn, [{ lineCents: t0.subtotalCents - discount }], true);
      if (!ev.ok) return res.status(400).json({ error: ev.error });
      usedCode = codeIn; discount += ev.discountCents;
    }
    const t = computeTotals(lines, catalog, ship, discount);
    const hasPre = t.items.some((i) => { const p = byId.get(i.productId); return !!p && isPreorder(p); });
    for (const i of t.items) { // every pre-order item has its own dates: it cannot be ordered before it opens or after its own deadline
      const p = byId.get(i.productId); if (!p || !isPreorder(p)) continue; const ph = preorderPhase(p);
      if (ph === "upcoming") return res.status(400).json({ error: `Pre-order for "${p.name}" opens on ${dayShort(p.preorderStart!)}. Please remove it from your cart for now.` });
      if (ph === "closed") return res.status(400).json({ error: `Pre-order for "${p.name}" closed on ${dayShort(p.preorderEnd!)}. Please remove it from your cart.` });
    }
    if (hasPre && method === "COD") return res.status(400).json({ error: "Pre-order items are paid with a deposit online. Please choose Bakong or QR payment." });
    const orderNumber = `CT-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
    const order = { orderNumber, createdAt: new Date().toISOString(), area, ...(area === "PROVINCE" ? { province: parsed.data.province } : {}), method, customer,
      items: t.items.map((i) => ({ productId: i.productId, sku: byId.get(i.productId)!.sku, name: i.name, qty: i.qty, unitCents: i.unitCents, lineCents: i.lineCents, ...itemDates(byId.get(i.productId)) })),
      subtotalCents: t.subtotalCents, discountCents: t.discountCents, shippingCents: t.shippingCents, totalCents: t.totalCents, currency: "USD" as const, ...(usedCode ? { discountCode: usedCode } : {}), ...(auto.length ? { autoDiscounts: auto } : {}), ...(hasPre ? { preorder: preorderSplit(t.totalCents, promos.preorder, parsed.data.preorderPay === "full") } : {}), ...(acct?.email ? { accountEmail: acct.email.toLowerCase() } : {}),
      paymentStatus: "PENDING" as const, paymentReference: `PAY-${orderNumber}`, email: { status: "NONE" as const, attempts: 0 } };
    const lines2 = t.items.map((i) => ({ productId: i.productId, qty: i.qty }));
    await decrementStock(lines2); // atomic in the database; throws INSUFFICIENT_STOCK without changing anything
    try { await saveOrder(order); } catch (e) { await restoreStock(lines2); throw e; }
    if (method === "BAKONG") return res.json({ orderNumber }); // Bakong: the admin is emailed once the bank confirms the payment (see /payment/bakong/status)
    // The three e-mails are independent, so they are sent AT THE SAME TIME (was one after another) and their results are saved with ONE order update (was two read+write rounds).
    // EVERY new order (pay with delivery AND QR) is emailed to the admin right away; QR orders get a second email when the customer presses "I have paid".
    // The order is already saved and stock reduced: an e-mail problem is logged and recorded, and never turns into "could not place the order".
    const [adminMail, customerMail] = await Promise.allSettled([sendAdminEmail(order), sendCustomerEmail(order, "placed"), sendItemsMail(order)]); // 3rd = "meet your toys" photo e-mail (never throws)
    if (adminMail.status === "rejected") console.error("[checkout email]", orderNumber, adminMail.reason);
    if (customerMail.status === "rejected") console.error("[customer email]", orderNumber, customerMail.reason);
    if (adminMail.status === "fulfilled" || customerMail.status === "fulfilled") {
      try { await updateOrder(orderNumber, (x) => { // status is recorded so the admin can press "Resend email"
        if (adminMail.status === "fulfilled") x.email = { status: adminMail.value.status, detail: adminMail.value.detail, attempts: 1 };
        if (customerMail.status === "fulfilled") x.customerEmail = { ...customerMail.value, kind: "placed" };
      }); } catch (e) { console.error("[checkout email status]", orderNumber, e); }
    }
    return res.json({ orderNumber });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return res.status(409).json({ error: msg === "INSUFFICIENT_STOCK" ? "An item is out of stock or exceeds available stock." : "Could not place the order." });
  }
}));

/** Preview only: tells the customer how much a code takes off. Does NOT use up the code. */
api.post("/discount/validate", wrap(async (req, res) => {
  if (tooMany(`v:${clientKey(req)}`)) return res.status(429).json({ error: "Too many tries. Please wait a minute." });
  const b = z.object({ code: z.string().max(40), lines: z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(99) })).min(1).max(50) }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: "Bad request" });
  const code = normalizeCode(b.data.code);
  if (!CODE_RE.test(code)) return res.status(400).json({ error: "That discount code is not valid." });
  try {
    const [products, promos] = await Promise.all([listProductsByIds(b.data.lines.map((l) => l.productId)), getPromotions()]); const t = computeTotals(b.data.lines, catalogOf(products), 0);
    const auto = autoDiscounts(t.items.map((i) => ({ category: products.find((p) => p.id === i.productId)?.category ?? "", lineCents: i.lineCents })), promos.campaigns);
    const ev = await resolveDiscount(code, [{ lineCents: t.subtotalCents - autoTotal(auto) }]);
    return ev.ok ? res.json({ code, discountCents: ev.discountCents }) : res.status(400).json({ error: ev.error });
  } catch { return res.status(400).json({ error: "Could not check the code right now." }); }
}));

/** Payment page data (same exposure as before: whoever has the order number can see it). */
api.get("/orders/:n", wrap(async (req, res) => {
  if (!/^CT-[0-9]{6}-[A-Z0-9]{5}$/.test(String(req.params.n))) return res.status(404).json({ error: "Not found" }); // wrong format: never hits the database
  if (tooMany(`o:${clientKey(req)}`, 30)) return res.status(429).json({ error: "Too many tries. Please wait a minute." }); // blocks order-number guessing
  const o = await getOrder(String(req.params.n)); return o ? res.json({ order: publicOrder(o) }) : res.status(404).json({ error: "Not found" }); })); // no personal data for anonymous callers

/* ---------------- Bakong KHQR ---------------- */
const ORDER_RE = /^CT-[0-9]{6}-[A-Z0-9]{5}$/;
api.get("/payment/bakong/enabled", wrap(async (_req, res) => res.json({ enabled: bakongEnabled() && methodOn(await getSettings(), "BAKONG") })));
/** Creates (or renews) the KHQR for this order's exact total. */
api.post("/payment/bakong/qr", wrap(async (req, res) => {
  const n = typeof req.body?.orderNumber === "string" ? req.body.orderNumber.trim() : "";
  if (!ORDER_RE.test(n)) return res.status(400).json({ error: "Invalid order" });
  if (tooMany(`bkqr:${clientKey(req)}`, 30)) return res.status(429).json({ error: "Too many tries. Please wait a minute." });
  if (!bakongEnabled()) return res.status(503).json({ error: "Bakong payment is not set up yet." });
  const o = await getOrder(n);
  if (!o || o.method !== "BAKONG") return res.status(404).json({ error: "Order not found" });
  if (o.paymentStatus === "PAID") return res.json({ paid: true });
  if (o.paymentStatus !== "PENDING") return res.json({ closed: true, status: o.paymentStatus });
  const now = Date.now(), used = o.bakongMd5s?.length ?? 0, live = !!o.bakongQrExpiresAt && o.bakongQrExpiresAt > now + 3000;
  if (!live && used >= QR_MAX) { // all QR codes used and the last one expired: cancel and give the stock back
    await releaseBakongOrder(n, "EXPIRED"); const again = await getOrder(n);
    return res.json(again?.paymentStatus === "PAID" ? { paid: true } : { closed: true, status: again?.paymentStatus ?? "EXPIRED" });
  }
  const k = await makeKhqr(n, payNowCents(o), live ? o.bakongQrExpiresAt : undefined);
  const qrNumber = live && (o.bakongMd5s ?? []).includes(k.md5) ? used : used + 1;
  await updatePendingOrder(n, (x) => { if (!(x.bakongMd5s ?? []).includes(k.md5)) x.bakongMd5s = [...(x.bakongMd5s ?? []), k.md5].slice(-10); x.bakongQrExpiresAt = k.expiresAt; }); // older QR codes stay valid for checking
  res.json({ paid: false, image: k.image, expiresAt: k.expiresAt, amountCents: payNowCents(o), merchant: bakongName(), qrNumber, qrMax: QR_MAX });
}));
/** Customer pressed "Cancel order": the order is cancelled and its stock goes back to the shop (once). */
api.post("/payment/bakong/cancel", wrap(async (req, res) => {
  const n = typeof req.body?.orderNumber === "string" ? req.body.orderNumber.trim() : "";
  if (!ORDER_RE.test(n)) return res.status(400).json({ error: "Invalid order" });
  if (tooMany(`bkc:${clientKey(req)}`, 10)) return res.status(429).json({ error: "Too many tries. Please wait a minute." });
  const o = await getOrder(n);
  if (!o || o.method !== "BAKONG") return res.status(404).json({ error: "Order not found" });
  if (o.paymentStatus === "PAID") return res.json({ paid: true });
  await releaseBakongOrder(n, "FAILED"); const now = await getOrder(n);
  res.json(now?.paymentStatus === "PAID" ? { paid: true } : { ok: true, status: now?.paymentStatus ?? "FAILED" });
}));
/** Gives the stock of an unpaid Bakong order back to the shop, exactly once (cancelled, or its QR codes ran out). A paid order is never touched. */
async function releaseBakongOrder(n: string, status: "FAILED" | "EXPIRED", known?: StoredOrder) {
  const o = await markUnpaidOnce(n, status, known); if (!o) return false;
  try { await restoreStock(o.items.map((i) => ({ productId: i.productId, qty: i.qty }))); } catch (e) { console.error("[restock failed]", n, e); }
  return true;
}
let lastSweep = 0;
/** Cancels Bakong orders nobody is paying any more (no new QR within a few minutes after the last one expired) so their stock is sellable again. */
async function expireStaleBakong(minGapMs = 20_000) { // runs at most once per minGapMs per server instance
  if (Date.now() - lastSweep < minGapMs) return; lastSweep = Date.now();
  try {
    const stale = (await listPendingBakongAll()).filter((o) => Date.now() > (o.bakongQrExpiresAt ?? Date.parse(o.createdAt) + 15 * 60_000) + QR_GRACE_MS);
    // the orders are already loaded, so each release is ONE write (was a re-read + write per order), and all of them run together
    await Promise.all(stale.map((o) => releaseBakongOrder(o.orderNumber, "EXPIRED", o).catch((e) => console.error("[expire sweep]", o.orderNumber, e))));
  } catch (e) { console.error("[expire sweep]", e); }
}
/** Moves the order to PAID once and sends the emails (only the caller that flips PENDING -> PAID sends them, side by side so the popup is not kept waiting). */
async function finalizeBakongPaid(n: string, hash: string) {
  const won = await markPaidOnce(n, (x) => { x.paidAt = new Date().toISOString(); x.paidManuallyBy = undefined; x.bakongHash = hash; });
  if (!won) return;
  await Promise.allSettled([
    (async () => { const r = await sendBakongPaidEmail(won); await updateOrder(n, (x) => { x.claimEmail = r; x.email = { status: r.status, detail: r.detail, attempts: x.email.attempts + 1 }; }); if (r.status !== "SENT") console.error("[bakong paid email]", n, r.status, r.detail); })().catch((e) => console.error("[bakong paid email]", n, e)),
    (async () => { const r = await sendCustomerEmail(won, "paid"); await updateOrder(n, (x) => { x.customerEmail = { ...r, kind: "paid" }; }); })().catch((e) => console.error("[bakong receipt]", n, e)),
    sendItemsMail(won).catch((e) => console.error("[bakong items mail]", n, e)),
  ]);
}
/** The customer's page polls this. Watcher mode: only reads our database (the shop-PC watcher does the Bakong check). Otherwise this server asks Bakong itself. */
api.get("/payment/bakong/status/:n", wrap(async (req, res) => {
  const n = String(req.params.n);
  if (!ORDER_RE.test(n)) return res.status(404).json({ error: "Not found" });
  if (tooMany(`bks:${clientKey(req)}`, 90)) return res.status(429).json({ error: "Too many tries. Please wait a minute." });
  const o = await getOrder(n);
  if (!o || o.method !== "BAKONG") return res.status(404).json({ error: "Not found" });
  if (o.paymentStatus === "PAID") return res.json({ paid: true });
  if (o.paymentStatus !== "PENDING") return res.json({ paid: false, closed: true, status: o.paymentStatus });
  await expireStaleBakong();
  // Hybrid: this server asks Bakong directly first. If Bakong refuses it (blocked outside Cambodia), the watcher program running in Cambodia confirms instead.
  const watcherOn = !!watcherSecret(); const skipDirect = watcherOn && Date.now() - directDownAt < 60_000; // direct path known to be down: do not make every poll wait for it
  const md5s = [...(o.bakongMd5s ?? [])].reverse(); let hash: string | undefined; let problem = false; let directErr = false;
  const results = skipDirect ? [] : await Promise.all(md5s.map((md5) => checkPaid(md5, payNowCents(o)).then((r) => ({ md5, r })))); // all QR codes of this order at once = fastest answer
  for (const { md5, r } of results) { if (r.ok) { hash = hash ?? r.hash ?? md5; } else if (r.reason === "ERROR") { problem = true; directErr = true; } else if (r.reason === "MISMATCH") { problem = true; console.error("[bakong check]", n, r.reason, r.detail); } }
  if (directErr && !hash) { directDownAt = Date.now(); if (!watcherOn) console.error("[bakong check]", n, "ERROR", results.map(({ r }) => (r.ok ? "" : r.detail)).find(Boolean)); }
  if (hash) { await finalizeBakongPaid(n, hash); return res.json({ paid: true }); }
  if (watcherOn) { // tell the page whether anything can confirm the payment right now
    const seen = await watcherSeenAt(), online = !!seen && Date.now() - seen < 40_000, directDown = skipDirect || directErr;
    return res.json({ paid: false, problem: false, watcher: online || !directDown ? "online" : "offline", ...(false ? { debug: [directDown ? "direct check from the website: BLOCKED (normal outside Cambodia)" : "direct check from the website: working", online ? "watcher: online" : `watcher: OFFLINE (last seen ${seen ? Math.round((Date.now() - seen) / 1000) + " s ago" : "never"}); start start-bakong-watcher.bat on a computer in Cambodia, check BAKONG_WATCHER_SECRET is identical in Vercel and .env.local`, ...results.map(({ r }) => (r.ok ? "ok" : `${r.reason}${r.detail ? `: ${r.detail}` : ""}`))] } : {}) });
  }
  res.json({ paid: false, problem, ...(false ? { debug: results.map(({ r }) => (r.ok ? "ok" : `${r.reason}${r.detail ? `: ${r.detail}` : ""}`)) } : {}) }); // ?debug=1 on the payment page shows what Bakong answered
}));
let directDownAt = 0;
/** Shop-PC watcher (runs in Cambodia, where Bakong answers). Protected by BAKONG_WATCHER_SECRET. */
const watcherOk = (req: Request) => { const s = watcherSecret(), got = String(req.headers["x-relay-secret"] ?? ""); return s.length >= 12 && got.length === s.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(s)); };
api.get("/relay/pending", wrap(async (req, res) => {
  if (tooMany(`rp:${clientKey(req)}`, 600)) return res.status(429).json({ error: "slow down" });
  if (!watcherOk(req)) return res.status(401).json({ error: "bad secret" });
  await expireStaleBakong();
  const list = await listPendingBakong(); await beatWatcher(list.length > 0);
  res.json({ orders: list.map((o) => ({ orderNumber: o.orderNumber, md5s: o.bakongMd5s ?? [] })) });
}));
api.post("/relay/confirm", wrap(async (req, res) => {
  if (tooMany(`rc:${clientKey(req)}`, 120)) return res.status(429).json({ error: "slow down" });
  if (!watcherOk(req)) return res.status(401).json({ error: "bad secret" });
  const b = z.object({ orderNumber: z.string(), md5: z.string().regex(/^[a-f0-9]{32}$/i), data: z.object({ hash: z.string().optional(), amount: z.union([z.number(), z.string()]), currency: z.string(), toAccountId: z.string().optional() }) }).safeParse(req.body);
  if (!b.success || !ORDER_RE.test(b.data.orderNumber)) return res.status(400).json({ error: "Bad request" });
  const o = await getOrder(b.data.orderNumber);
  if (!o || o.method !== "BAKONG" || !(o.bakongMd5s ?? []).includes(b.data.md5.toLowerCase())) return res.status(404).json({ error: "Unknown order or QR" });
  if (o.paymentStatus === "PAID") return res.json({ ok: true, already: true });
  const m = matchPaid(b.data.data, payNowCents(o)); // the server still checks amount, currency and account itself
  if (!m.ok) { console.error("[bakong confirm]", o.orderNumber, m.reason, m.detail); return res.status(422).json({ error: "Payment does not match the order", detail: m.detail }); }
  await finalizeBakongPaid(o.orderNumber, m.hash ?? b.data.md5);
  res.json({ ok: true });
}));

/** Customer pressed "I have paid": email the full order to the admin (once). */
api.post("/payment/claim", wrap(async (req, res) => {
  const n = typeof req.body?.orderNumber === "string" ? req.body.orderNumber.trim() : "";
  if (!/^CT-[0-9]{6}-[A-Z0-9]{5}$/.test(n)) return res.status(400).json({ error: "Invalid order" });
  if (tooMany(`claim:${clientKey(req)}`, 10)) return res.status(429).json({ error: "Too many tries. Please wait a minute." });
  const o = await getOrder(n);
  if (!o || o.method !== "QR_IMAGE") return res.status(404).json({ error: "Order not found" });
  if (o.paymentStatus === "PENDING" && !o.paymentProof) return res.status(400).json({ error: "Please upload your payment screenshot first." });
  if (o.paymentStatus === "PAID" || o.claimEmail?.status === "SENT") return res.json({ ok: true, already: true, status: "SENT" }); // never email twice
  const r = await sendPaidOrderEmail(o);
  await updateOrder(n, (x) => { x.claimedPaidAt = x.claimedPaidAt ?? new Date().toISOString(); x.claimEmail = r; x.email = r.status !== "SENT" && x.email.status === "SENT" ? { ...x.email, attempts: x.email.attempts + 1 } : { status: r.status, detail: r.detail, attempts: x.email.attempts + 1 }; });
  if (r.status !== "SENT") console.error("[claim email]", n, r.status, r.detail);
  return res.json({ ok: r.status === "SENT", status: r.status, detail: r.detail });
}));
api.post("/payment/proof", upload.any(), wrap(async (req, res) => {
  const n = fld(req, "orderNumber").trim(); const f = files(req, "proof")[0];
  if (!/^CT-[0-9]{6}-[A-Z0-9]{5}$/.test(n) || !f) return res.status(400).json({ error: "Choose your payment screenshot first." });
  if (tooMany(`proof:${clientKey(req)}`, 10)) return res.status(429).json({ error: "Too many tries. Please wait a minute." });
  const o = await getOrder(n);
  if (!o || o.method !== "QR_IMAGE" || o.paymentStatus !== "PENDING") return res.status(404).json({ error: "Order not found." });
  const bytes = new Uint8Array(f.buffer); const v = validateImage(bytes, f.mimetype);
  if (!v.ok) return res.status(400).json({ error: v.error });
  try {
    const small = await toWebp(bytes, 1600, 1600, 85);
    const p = await uploadProof(n, small); const oldPath = o.paymentProof;
    await updateOrder(n, (x) => { x.paymentProof = p; x.proofAt = new Date().toISOString(); });
    if (oldPath) await deleteProofs([oldPath]);
    return res.json({ ok: true });
  } catch (e) { console.error("[payment proof]", n, e); return res.status(500).json({ error: "Could not upload the screenshot. Please try again." }); }
}));

/* ---------------- signed-in customer ---------------- */
api.get("/account/orders", requireUser, wrap(async (req, res) => { const u = userOf(req); res.json({ orders: u.email ? (await listOrdersByEmail(u.email)).filter((o) => o.paymentStatus === "PAID" || o.method === "COD") : [] }); })); // order history shows only paid orders (Bakong or any method) and pay-with-delivery orders; unpaid ones are hidden

/** Which admin role (owner / admin / editor) this signed-in account has, or null. The browser uses it to show the admin area. */
api.get("/staff/me", requireUser, wrap(async (req, res) => { const u = userOf(req); res.json({ role: await roleFor(u.email, !!u.email_confirmed_at) }); }));

/* ---------------- admin ---------------- */
const admin = express.Router(); admin.use(requireAdmin); api.use("/admin", admin);
admin.get("/me", (req, res) => { const u = adminOf(req); const m = (u.user_metadata ?? {}) as { full_name?: string; name?: string }; res.json({ email: u.email, role: roleOf(req), name: m.full_name || m.name || "" }); });
// each area is limited by role (owner: all, admin: all but staff, editor: products + pages)
admin.use(["/orders", "/transactions"], needs("orders")); admin.use("/pages", needs("pages")); admin.use(["/discounts", "/promotions"], needs("promotions")); admin.use(["/settings", "/bakong"], needs("settings")); admin.use("/staff", needs("staff"));
admin.use(["/products", "/product-form-meta", "/categories"], needs("products"));
admin.get("/dashboard", wrap(async (req, res) => { const [orders, products] = await Promise.all([can(roleOf(req), "orders") ? listAdminOrders() : Promise.resolve([] as Awaited<ReturnType<typeof listAllOrders>>), listAllProducts()]); res.json({ orders, products }); }));
admin.get("/orders", wrap(async (req, res) => { const orders = await listAdminOrders(); res.json({ orders, proofs: req.query.proofs ? await proofUrls(orders.map((o) => o.paymentProof ?? "")) : {} }); }));
admin.post("/orders/:n/mark-paid", wrap(async (req, res) => {
  const o = await getOrder(String(req.params.n));
  if (!o || !canPay(o.paymentStatus, "PAID")) return res.json({ ok: false });
  await updateOrder(o.orderNumber, (x) => { x.paymentStatus = "PAID"; x.paidAt = new Date().toISOString(); x.paidManuallyBy = adminOf(req).email ?? "admin"; });
  try { const paid = await getOrder(o.orderNumber); if (paid) { const r = await sendCustomerEmail(paid, "paid"); await updateOrder(o.orderNumber, (x) => { x.customerEmail = { ...r, kind: "paid" }; }); } } // "payment received" receipt
  catch (e) { console.error("[paid receipt email]", o.orderNumber, e); }
  res.json({ ok: true });
}));
admin.post("/orders/:n/mark-failed", wrap(async (req, res) => { // payment did not arrive: the invoice then shows the FAILED PAYMENT stamp (stock is not changed here)
  const o = await getOrder(String(req.params.n));
  if (!o || !canPay(o.paymentStatus, "FAILED")) return res.json({ ok: false });
  await updateOrder(o.orderNumber, (x) => { x.paymentStatus = "FAILED"; });
  res.json({ ok: true });
}));
admin.post("/orders/:n/resend-email", wrap(async (req, res) => {
  const o = await getOrder(String(req.params.n)); if (!o) return res.status(404).json({ ok: false });
  const r = o.claimedPaidAt ? await sendPaidOrderEmail(o) : await sendAdminEmail(o);
  await updateOrder(o.orderNumber, (x) => { x.email = { status: r.status, detail: r.detail, attempts: x.email.attempts + 1 }; });
  res.json({ ok: r.status === "SENT", status: r.status, detail: r.detail });
}));
admin.post("/orders/:n/resend-items", wrap(async (req, res) => {
  const o = await getOrder(String(req.params.n)); if (!o) return res.status(404).json({ ok: false });
  const r = await sendItemsMail(o); res.json({ ok: r.status === "SENT", status: r.status, detail: r.detail });
}));
admin.post("/orders/:n/resend-invoice", wrap(async (req, res) => {
  const o = await getOrder(String(req.params.n)); if (!o) return res.status(404).json({ ok: false });
  const kind = o.paymentStatus === "PAID" ? "paid" : "placed"; const r = await sendCustomerEmail(o, kind); // a FAILED order gets the "payment not completed" version
  await updateOrder(o.orderNumber, (x) => { x.customerEmail = { ...r, kind }; });
  res.json({ ok: r.status === "SENT", status: r.status, detail: r.detail });
}));
admin.post("/transactions/clear", wrap(async (_req, res) => {
  try { const proofs = await listProofPaths(); await deleteAllOrders(); await deleteProofs(proofs); res.json({ ok: true }); }
  catch { res.status(500).json({ error: "Could not clear the transactions. Please try again." }); }
}));
admin.get("/export", wrap(async (req, res) => {
  const u = req.query as Record<string, string | undefined>;
  const type = u.type ?? "orders", format = u.format === "pdf" ? "pdf" : u.format === "xlsx" ? "xlsx" : u.format === "sheet" ? "sheet" : "csv";
  if ((type === "orders" || type === "transactions" || type === "delivery") && !can(roleOf(req), "orders")) return res.status(403).send("Your role cannot export orders");
  const f = { status: u.status, from: u.from, to: u.to, q: u.q };
  let ds;
  if (type === "orders") ds = ordersDataset(sortOrders(filterOrders(await listAdminOrders(), f), u.sort ?? "new"));
  else if (type === "transactions") ds = transactionsDataset(sortOrders(filterOrders(await listAdminOrders(), f), u.sort ?? "high"));
  else if (type === "delivery") ds = deliveryDataset(sortOrders(filterOrders(await listAdminOrders(), f), u.sort ?? "new"));
  else if (type === "products") ds = productsDataset(await listAllProducts());
  else if (type === "stock") ds = stockDataset([...(await listAllProducts())].sort((a, b) => a.stock - b.stock));
  else return res.status(400).send("Unknown export type");
  const date = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  if (format === "sheet") return res.set({ "Cache-Control": "no-store" }).json(buildSheetHtml({ title: ds.title, cols: ds.pdf, rows: ds.rows.map(ds.pdfRow), logoUrl: /^https:\/\/[\w.-]+(:\d+)?$/.test(u.origin ?? "") && !/^https:\/\/(localhost|127\.)/.test(u.origin ?? "") ? `${u.origin}${INVOICE_LOGO}` : undefined, meta: makeMeta(await getSettings(), date, { intro: ds.intro, summary: ds.summary }) }));
  res.set({ "Content-Disposition": `attachment; filename="cloudy-toy-${ds.name}-${date}.${format}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (format === "csv") return res.type("text/csv; charset=utf-8").send(toCsv(ds.rows, ds.csv));
  const meta = makeMeta(await getSettings(), date, { intro: ds.intro, summary: ds.summary });
  if (format === "xlsx") return res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(buildXlsx({ title: ds.title, sheet: ds.title, cols: ds.pdf.map((c) => ({ header: c.header })), rows: ds.rows.map(ds.pdfRow), meta }));
  res.type("application/pdf").send(buildPdf({ title: ds.title, cols: ds.pdf, rows: ds.rows.map(ds.pdfRow), meta }));
}));

// products
const MAX_IMAGES = 6;
const Schema = z.object({
  name: z.string().trim().min(2, "Name needs at least 2 characters").max(120),
  sku: z.string().trim().min(2, "SKU needs at least 2 characters").max(40).regex(/^[A-Za-z0-9_#*-]+$/, "SKU: letters, numbers and the symbols # * _ - only (no spaces)"),
  category: z.string().trim().min(1, "Category is required").max(40),
  nameKm: z.string().trim().max(120), brand: z.string().trim().max(60), uom: z.string().trim().max(20), variants: z.string().trim().max(300),
  description: z.string().trim().max(2000), price: z.coerce.number().min(0).max(100000), stock: z.coerce.number().int("Stock must be a whole number").min(0).max(100000),
});
/** Every category with its product count: categories that products use, plus empty ones the admin added in Manage Categories. */
const categoryList = async () => {
  const [used, settings] = await Promise.all([categoryCounts(), getSettings()]); const counts = new Map<string, number>();
  for (const c of settings.categories ?? []) counts.set(c, 0);
  for (const [c, n] of used) counts.set(c, n);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
};
const catName = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
admin.get("/categories", wrap(async (_req, res) => res.json({ categories: await categoryList() })));
admin.post("/categories/add", wrap(async (req, res) => {
  const name = catName(req.body?.name); if (!name) return res.json({ error: "Type a category name" });
  const list = await categoryList(); if (list.some((c) => c.name.toLowerCase() === name.toLowerCase())) return res.json({ error: "That category already exists" });
  const extra = (await getSettings()).categories ?? []; await saveSettings({ categories: [...extra, name] }); res.json({ ok: true });
}));
/** Renaming to a name that already exists merges the two categories. */
admin.post("/categories/rename", wrap(async (req, res) => {
  const from = catName(req.body?.from), to = catName(req.body?.to); if (!from || !to) return res.json({ error: "Type the new category name" });
  const list = await categoryList(); if (!list.some((c) => c.name === from)) return res.json({ error: "Category not found" });
  const same = list.find((c) => c.name.toLowerCase() === to.toLowerCase() && c.name !== from); const target = same?.name ?? to;
  await renameCategory(from, target);
  const extra = ((await getSettings()).categories ?? []).filter((c) => c !== from); if (!extra.includes(target) && (list.find((c) => c.name === from)?.count ?? 0) === 0) extra.push(target);
  await saveSettings({ categories: extra }); res.json({ ok: true });
}));
admin.post("/categories/delete", wrap(async (req, res) => {
  const name = catName(req.body?.name); const c = (await categoryList()).find((x) => x.name === name); if (!c) return res.json({ error: "Category not found" });
  if (c.count > 0) return res.json({ error: `${c.count} product${c.count === 1 ? " uses" : "s use"} this category. Rename it to merge it into another one, or move those products first.` });
  await saveSettings({ categories: ((await getSettings()).categories ?? []).filter((x) => x !== name) }); res.json({ ok: true });
}));
admin.get("/products", wrap(async (_req, res) => res.json({ products: await listAllProducts() })));
admin.get("/products/:id", wrap(async (req, res) => {
  const [p, cats] = await Promise.all([getProductById(String(req.params.id)), categoryList()]); if (!p) return res.status(404).json({ error: "Not found" });
  res.json({ product: p, categories: cats.map((c) => c.name) });
}));
admin.get("/product-form-meta", wrap(async (_req, res) => res.json({ categories: (await categoryList()).map((c) => c.name) })));
admin.post("/products/save", upload.any(), wrap(async (req, res) => {
  const fail = (error: string) => res.json({ error });
  const id = fld(req, "id");
  const p = Schema.safeParse(Object.fromEntries(["name", "nameKm", "brand", "uom", "variants", "sku", "category", "description", "price", "stock"].map((k) => [k, fld(req, k)])));
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid input");
  const d = p.data; const labels = all(req, "labels").filter((l, i, a) => LABEL_IDS.includes(l) && a.indexOf(l) === i) as NonNullable<Parameters<typeof upsertProduct>[0]["labels"]>;
  if (labels.includes("preorder")) { const cap = (await getPromotions()).preorder.capSlots; if (d.stock > cap) return fail(`A pre-order item can have at most ${cap} slots (Promotions > Pre-Order Global Rules). For pre-order items, Stock Qty is the number of slots.`); }
  const dates = labels.includes("preorder") ? checkPreorderDates(fld(req, "preorderStart"), fld(req, "preorderEnd")) : { ok: true as const, start: "", end: "" }; // dates only belong to pre-order items
  if (!dates.ok) return fail(dates.error);
  const [taken, old] = await Promise.all([skuTaken(d.sku, id || undefined), id ? getProductById(id) : Promise.resolve(null)]); // two independent lookups, run together
  if (taken) return fail("That SKU is already used by another product");
  const keep = new Set(all(req, "keep"));
  const images = (old?.images ?? []).filter((i) => keep.has(i.src)); const removed = (old?.images ?? []).filter((i) => !keep.has(i.src)).map((i) => i.src);
  const fl = files(req, "images");
  if (images.length + fl.length > MAX_IMAGES) return fail(`At most ${MAX_IMAGES} images per product`);
  const uploaded: string[] = [];
  for (const f of fl) {
    const bytes = new Uint8Array(f.buffer); const v = validateImage(bytes, f.mimetype);
    if (!v.ok) { await deleteProductImages(uploaded); return fail(`${f.originalname}: ${v.error}`); }
    // shrink to max 1200px WebP so pages load fast
    const small = await toWebp(bytes, 1200, 1200, 80);
    const src = await uploadProductImage(safeFileName(d.sku, "webp"), small, "image/webp"); uploaded.push(src); images.push({ src, alt: d.name });
  }
  try { await upsertProduct({ id: id || undefined, name: d.name, nameKm: d.nameKm, brand: d.brand, uom: d.uom, variants: d.variants, labels, sku: d.sku, category: d.category, description: d.description, price: d.price, stock: d.stock, images, ...(dates.start ? { preorderStart: dates.start, preorderEnd: dates.end } : {}), active: fld(req, "active") === "on" }); }
  catch (e) { await deleteProductImages(uploaded); return fail(hint(e instanceof Error ? e.message : "") || "Could not save to the database. Nothing was lost; please try again."); }
  await deleteProductImages(removed); // only after the product row is safely saved
  res.json({ ok: true });
}));
/** Quick remove from the admin table: only takes labels OFF (adding a label is done in the Edit window). Nothing else ever removes a label. */
admin.post("/products/:id/labels", wrap(async (req, res) => {
  const p = await getProductById(String(req.params.id)); if (!p) return res.status(404).json({ error: "Not found" });
  const next = (Array.isArray(req.body?.labels) ? req.body.labels : []).map(String).filter((l: string, i: number, a: string[]) => LABEL_IDS.includes(l) && a.indexOf(l) === i);
  if (next.some((l: string) => !(p.labels ?? []).includes(l as NonNullable<typeof p.labels>[number]))) return res.json({ error: "Labels can only be removed here. Use Edit to add a label." });
  await setLabels(p.id, next); res.json({ ok: true });
}));
admin.delete("/products/:id", wrap(async (req, res) => { await deleteProduct(String(req.params.id)); res.json({ ok: true }); }));
admin.post("/products/:id/stock", wrap(async (req, res) => { const n = Number(req.body?.stock); if (Number.isInteger(n) && n >= 0 && n <= 100000) await setStock(String(req.params.id), n); res.json({ ok: true }); }));

// pages
admin.get("/pages", wrap(async (_req, res) => res.json({ pages: await getAllPages() })));
admin.post("/pages/save", wrap(async (req, res) => {
  const slug = String(req.body?.slug ?? ""); if (!isSlug(slug)) return res.json({ error: "Unknown page" });
  const content = String(req.body?.content ?? "").replace(/\r\n/g, "\n").trim();
  if (content.length > MAX_CONTENT) return res.json({ error: `Too long (max ${MAX_CONTENT} characters)` });
  await savePage(slug, { content, deleted: false }); res.json({ ok: true });
}));
/** "Delete" hides the page and its footer link and keeps the text, so Restore brings it back. */
admin.post("/pages/:slug/delete", wrap(async (req, res) => { const d = PAGE_DEFS.find((p) => p.slug === req.params.slug); if (!d || !d.deletable) return res.json({ error: "This page cannot be deleted" }); await savePage(d.slug, { deleted: true }); res.json({ ok: true }); }));
admin.post("/pages/:slug/restore", wrap(async (req, res) => { const d = PAGE_DEFS.find((p) => p.slug === req.params.slug); if (!d) return res.json({ error: "Unknown page" }); await savePage(d.slug, { deleted: false }); res.json({ ok: true }); }));

// discounts: the admin creates codes worth 10-50% off the cart subtotal (customers type them at checkout)
admin.get("/discounts", wrap(async (_req, res) => res.json({ codes: await listStoreDiscounts() })));
admin.post("/discounts/create", wrap(async (req, res) => {
  const code = normalizeCode(String(req.body?.code ?? "")), pct = Number(req.body?.percent);
  if (!CODE_RE.test(code)) return res.json({ error: "Code: 3-30 letters, numbers, - or _ (e.g. SAVE10)" });
  if (!percentOk(pct)) return res.json({ error: "Discount % must be a whole number from 10 to 50" });
  if (!(await createStoreDiscount(code, pct))) return res.json({ error: "That code already exists" });
  res.json({ ok: true });
}));
admin.post("/discounts/update", wrap(async (req, res) => {
  const code = normalizeCode(String(req.body?.code ?? "")), pct = Number(req.body?.percent);
  if (!CODE_RE.test(code)) return res.json({ error: "Unknown code" });
  if (!percentOk(pct)) return res.json({ error: "Discount % must be a whole number from 10 to 50" });
  if (!(await updateStoreDiscount(code, pct))) return res.json({ error: "Unknown code" });
  res.json({ ok: true });
}));
admin.post("/discounts/delete", wrap(async (req, res) => { const code = normalizeCode(String(req.body?.code ?? "")); if (!CODE_RE.test(code)) return res.json({ error: "Unknown code" }); await deleteStoreDiscount(code); res.json({ ok: true }); }));

// promotions: pre-order rules + automatic discount campaigns (the typed-code discounts above keep working too)
admin.get("/promotions", wrap(async (_req, res) => res.json({ promotions: await getPromotions(), categories: (await categoryList()).map((c) => c.name) })));
admin.post("/promotions/preorder", wrap(async (req, res) => {
  const c = checkPreorder({ depositPercent: req.body?.depositPercent, dispatchText: req.body?.dispatchText, capSlots: req.body?.capSlots }); if (!c.ok) return res.json({ error: c.error });
  await savePromotions({ ...(await getPromotions()), preorder: c.value }); res.json({ ok: true });
}));
const campaignFields = (b: Record<string, unknown>) => checkCampaign({ name: b?.name, kind: b?.kind, minSpend: b?.minSpend, amount: b?.amount, percent: b?.percent, category: b?.category });
admin.post("/promotions/campaigns/add", wrap(async (req, res) => {
  const c = campaignFields(req.body); if (!c.ok) return res.json({ error: c.error });
  const cur = await getPromotions(); if (cur.campaigns.length >= MAX_CAMPAIGNS) return res.json({ error: `At most ${MAX_CAMPAIGNS} campaigns. Delete one first.` });
  await savePromotions({ ...cur, campaigns: [...cur.campaigns, { ...c.value, id: crypto.randomUUID().slice(0, 8), active: true, createdAt: new Date().toISOString() }] }); res.json({ ok: true });
}));
admin.post("/promotions/campaigns/update", wrap(async (req, res) => {
  const c = campaignFields(req.body); if (!c.ok) return res.json({ error: c.error });
  const cur = await getPromotions(); const id = String(req.body?.id ?? ""); if (!cur.campaigns.some((x) => x.id === id)) return res.json({ error: "Campaign not found" });
  await savePromotions({ ...cur, campaigns: cur.campaigns.map((x) => (x.id === id ? { ...x, ...c.value } : x)) }); res.json({ ok: true });
}));
admin.post("/promotions/campaigns/toggle", wrap(async (req, res) => {
  const cur = await getPromotions(); const id = String(req.body?.id ?? ""); if (!cur.campaigns.some((x) => x.id === id)) return res.json({ error: "Campaign not found" });
  await savePromotions({ ...cur, campaigns: cur.campaigns.map((x) => (x.id === id ? { ...x, active: req.body?.active === true } : x)) }); res.json({ ok: true });
}));
admin.post("/promotions/campaigns/delete", wrap(async (req, res) => { const cur = await getPromotions(); await savePromotions({ ...cur, campaigns: cur.campaigns.filter((x) => x.id !== String(req.body?.id ?? "")) }); res.json({ ok: true }); }));

// staff (Admin Permissions page, owners only)
admin.get("/staff", wrap(async (req, res) => res.json({ ...(await listStaff()), me: (adminOf(req).email ?? "").toLowerCase() })));
admin.post("/staff/add", wrap(async (req, res) => { const e = await addStaff(req.body ?? {}); res.json(e ? { error: e } : { ok: true }); }));
admin.post("/staff/update", wrap(async (req, res) => { const body = req.body ?? {}; const self = String(body.email ?? "").trim().toLowerCase() === (adminOf(req).email ?? "").toLowerCase(); if (self && (body.role !== undefined && body.role !== "owner" || body.active === false)) return res.json({ error: "You cannot lower or deactivate your own access. Ask another owner." }); const e = await updateStaff(body); res.json(e ? { error: e } : { ok: true }); }));
admin.post("/staff/delete", wrap(async (req, res) => { if (String(req.body?.email ?? "").trim().toLowerCase() === (adminOf(req).email ?? "").toLowerCase()) return res.json({ error: "You cannot remove yourself." }); const e = await deleteStaff(String(req.body?.email ?? "")); res.json(e ? { error: e } : { ok: true }); }));

// settings
const Url = z.string().trim().max(300).refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Links must start with https://");
const Fee = z.coerce.number().min(0).max(100);
admin.post("/settings", wrap(async (req, res) => {
  const p = z.object({ pp: Fee, prov: Fee, tg: Url, fb: Url, ig: Url }).safeParse({ pp: req.body?.pp, prov: req.body?.prov, tg: req.body?.tg ?? "", fb: req.body?.fb ?? "", ig: req.body?.ig ?? "" });
  if (!p.success) return res.json({ error: p.error.issues[0]?.message ?? "Invalid input" });
  await saveSettings({ shipPhnomPenhCents: Math.round(p.data.pp * 100), shipProvinceCents: Math.round(p.data.prov * 100), telegramUrl: p.data.tg, facebookUrl: p.data.fb, instagramUrl: p.data.ig }); res.json({ ok: true });
}));
/** Admin: checks Bakong settings + connection so the owner can see why automatic payment confirmation fails. */
admin.get("/bakong/diagnose", wrap(async (_req, res) => {
  const d = await bakongDiagnose(); const directOk = d.ok;
  if (watcherSecret()) {
    for (const x of d.steps) if (x.label === "Reach Bakong API") x.label = "Direct check from the website";
    const seen = await watcherSeenAt(), ago = seen ? Math.round((Date.now() - seen) / 1000) : null, on = ago !== null && ago < 120;
    d.steps.push({ label: "Shop-PC watcher (optional)", ok: on || directOk, detail: on ? `running (last contact ${ago} s ago)` : `NOT running${ago === null ? " (never contacted this site)" : ` (last contact ${Math.round(ago / 60)} min ago)`}. ${directOk ? "Not needed while the direct check works." : "Needed because Bakong blocks the website: run start-bakong-watcher.bat on a computer in Cambodia that stays on 24/7."}` });
    d.ok = directOk || on;
  }
  res.json(d);
}));
/** Admin sets each payment option to on / paused / coming soon (at least one must stay on). */
admin.post("/settings/payments", wrap(async (req, res) => {
  const p = z.object({ payBakong: z.enum(["on", "paused", "soon"]), payQr: z.enum(["on", "paused", "soon"]), payCod: z.enum(["on", "paused", "soon"]) }).safeParse(req.body);
  if (!p.success) return res.json({ error: "Invalid input" });
  if (![p.data.payBakong, p.data.payQr, p.data.payCod].includes("on")) return res.json({ error: "Keep at least one payment option on (working), or customers cannot check out." });
  await saveSettings(p.data); res.json({ ok: true });
}));
/** Admin uploads a new logo (or resets to the built-in one). */
admin.post("/settings/logo", upload.any(), wrap(async (req, res) => {
  const old = (await getSettings()).logoUrl; let next = DEFAULT_SETTINGS.logoUrl, uploaded: string | null = null;
  if (fld(req, "reset") !== "on") {
    const f = files(req, "logo")[0]; if (!f) return res.json({ error: "Choose an image file first" });
    const bytes = new Uint8Array(f.buffer); const v = validateImage(bytes, f.mimetype); if (!v.ok) return res.json({ error: v.error });
    const small = await toWebp(bytes, 600, 300, 90);
    uploaded = await uploadProductImage(`logo-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.webp`, small, "image/webp"); next = uploaded;
  }
  try { await saveSettings({ logoUrl: next }); } catch { if (uploaded) await deleteProductImages([uploaded]); return res.json({ error: "Could not save the logo. Please try again." }); }
  if (old && old !== next && old.includes("/logo-")) await deleteProductImages([old]);
  res.json({ ok: true });
}));
const MAX_BANNERS = 10;
admin.post("/settings/banners", upload.any(), wrap(async (req, res) => {
  const old = (await getSettings()).banners ?? []; const k = all(req, "keep"); const keep = old.filter((b) => k.includes(b)); const fl = files(req, "banners");
  if (keep.length + fl.length > MAX_BANNERS) return res.json({ error: `At most ${MAX_BANNERS} banner images` });
  const uploaded: string[] = [];
  try {
    for (const f of fl) {
      const bytes = new Uint8Array(f.buffer); const v = validateImage(bytes, f.mimetype);
      if (!v.ok) { await deleteProductImages(uploaded); return res.json({ error: `${f.originalname}: ${v.error}` }); }
      const small = await toWebp(bytes, 2400, 2400, 82);
      uploaded.push(await uploadProductImage(`banner-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.webp`, small, "image/webp"));
    }
    await saveSettings({ banners: [...keep, ...uploaded] });
  } catch { await deleteProductImages(uploaded); return res.json({ error: "Could not save the banners. Please try again." }); }
  await deleteProductImages(old.filter((b) => !keep.includes(b)));
  res.json({ ok: true });
}));

/** Delete one banner image. */
admin.post("/settings/banners/delete", wrap(async (req, res) => {
  const url = String(req.body?.url ?? ""); const old = (await getSettings()).banners ?? [];
  if (!old.includes(url)) return res.json({ error: "Banner not found" });
  try { await saveSettings({ banners: old.filter((b) => b !== url) }); } catch { return res.json({ error: "Could not delete the banner. Please try again." }); }
  await deleteProductImages([url]); res.json({ ok: true });
}));
/** Payment QR: upload a new image, or delete it (no QR is shown until a new one is uploaded). */
admin.post("/settings/qr", upload.any(), wrap(async (req, res) => {
  const old = (await getSettings()).qrUrl || DEFAULT_SETTINGS.qrUrl; let next = "none", uploaded: string | null = null; // "none" = the admin deleted the QR: customers see no QR image until a new one is uploaded
  if (fld(req, "reset") !== "on") {
    const f = files(req, "qr")[0]; if (!f) return res.json({ error: "Choose an image file first" });
    const bytes = new Uint8Array(f.buffer); const v = validateImage(bytes, f.mimetype); if (!v.ok) return res.json({ error: v.error });
    const small = await toWebp(bytes, 1200, 1600, 92);
    uploaded = await uploadProductImage(`payqr-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.webp`, small, "image/webp"); next = uploaded;
  }
  try { await saveSettings({ qrUrl: next }); } catch { if (uploaded) await deleteProductImages([uploaded]); return res.json({ error: "Could not save the QR. Please try again." }); }
  if (old !== next && old.includes("/payqr-")) await deleteProductImages([old]);
  res.json({ ok: true });
}));

app.use("/api", api);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
/** Last line of defence: bad JSON, oversized uploads and unexpected errors get a short JSON answer, never a stack trace. */
app.use((err: unknown, _req: Request, res: Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const e = err as { type?: string; code?: string; status?: number };
  if (e?.type === "entity.too.large" || e?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "The file or request is too large." });
  if (e?.type === "entity.parse.failed" || e?.code?.startsWith?.("LIMIT_")) return res.status(400).json({ error: "Bad request" });
  console.error("[unhandled]", err); res.status(500).json({ error: "Server error" });
});

/* ---------------- production: serve the built React app ---------------- */
const dist = path.resolve(process.cwd(), "dist");
if (fs.existsSync(dist)) {
  app.use("/assets", express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get("*", (_req, res) => { res.set("Cache-Control", "no-cache"); res.sendFile(path.join(dist, "index.html")); });
}
export default app;
