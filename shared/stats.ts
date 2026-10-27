import type { StoredOrder } from "./types";
export const PP_OFFSET_MS = 7 * 3600 * 1000; // Cambodia is UTC+7, no DST
/** YYYY-MM-DD in Phnom Penh time. */
export const dayKey = (iso: string) => new Date(Date.parse(iso) + PP_OFFSET_MS).toISOString().slice(0, 10);
export const stamp = (iso: string) => new Date(Date.parse(iso) + PP_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
export const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
export type OrderFilter = { status?: string; from?: string; to?: string; q?: string };
export function filterOrders(orders: StoredOrder[], f: OrderFilter) {
  const q = (f.q ?? "").trim().toLowerCase();
  return orders.filter((o) => {
    if (f.status && f.status !== "ALL" && o.paymentStatus !== f.status) return false;
    const d = dayKey(o.createdAt);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (q && !`${o.orderNumber} ${o.customer.name} ${o.customer.email} ${o.customer.phone}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
export function sortOrders(orders: StoredOrder[], sort: string) {
  const a = [...orders];
  if (sort === "low") a.sort((x, y) => x.totalCents - y.totalCents);
  else if (sort === "high") a.sort((x, y) => y.totalCents - x.totalCents);
  else if (sort === "oldest") a.sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  else a.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return a;
}
export function summarize(orders: StoredOrder[]) {
  const paid = orders.filter((o) => o.paymentStatus === "PAID");
  const pending = orders.filter((o) => o.paymentStatus === "PENDING");
  const totals = orders.map((o) => o.totalCents);
  return {
    count: orders.length, paidCount: paid.length, pendingCount: pending.length,
    paidCents: paid.reduce((s, o) => s + o.totalCents, 0), pendingCents: pending.reduce((s, o) => s + o.totalCents, 0),
    allCents: totals.reduce((s, n) => s + n, 0),
    avgCents: orders.length ? Math.round(totals.reduce((s, n) => s + n, 0) / orders.length) : 0,
    minCents: totals.length ? Math.min(...totals) : 0, maxCents: totals.length ? Math.max(...totals) : 0,
  };
}
/** Revenue (PAID orders) per day for the last `days` days ending today, Phnom Penh time. */
export function dailyRevenue(orders: StoredOrder[], days = 14, now = Date.now()) {
  const out: { day: string; cents: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ day: new Date(now + PP_OFFSET_MS - i * 86400000).toISOString().slice(0, 10), cents: 0, orders: 0 });
  for (const o of orders) { const r = out.find((x) => x.day === dayKey(o.createdAt)); if (r) { r.orders++; if (o.paymentStatus === "PAID") r.cents += o.totalCents; } }
  return out;
}
export function topProducts(orders: StoredOrder[], n = 5) {
  const m = new Map<string, { name: string; qty: number; cents: number }>();
  for (const o of orders) for (const i of o.items) { const r = m.get(i.sku) ?? { name: i.name, qty: 0, cents: 0 }; r.qty += i.qty; r.cents += i.lineCents; m.set(i.sku, r); }
  return [...m.entries()].map(([sku, v]) => ({ sku, ...v })).sort((a, b) => b.qty - a.qty).slice(0, n);
}
