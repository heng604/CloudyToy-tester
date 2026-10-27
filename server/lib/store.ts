// Orders in Supabase (table public.orders). Permanent: nothing is lost unless an admin explicitly deletes it.
import { db, must } from "./db";
import type { StoredOrder } from "../../shared/types";
export type { StoredOrder };
const d = (c: number) => c / 100;
const toRow = (o: StoredOrder) => ({
  order_number: o.orderNumber, customer_name: o.customer.name, customer_email: o.customer.email.toLowerCase(), customer_phone: o.customer.phone,
  shipping_address: { address: o.customer.address, area: o.area, province: o.province ?? null }, delivery_instructions: o.customer.notes ?? null,
  subtotal: d(o.subtotalCents), discount: d(o.discountCents), shipping_fee: d(o.shippingCents), total: d(o.totalCents), currency: o.currency,
  payment_status: o.paymentStatus, created_at: o.createdAt, updated_at: new Date().toISOString(), data: o,
});
type Row = { data: StoredOrder | null };
const fromRows = (rows: Row[] | null) => (rows ?? []).map((r) => r.data).filter((x): x is StoredOrder => !!x);

export async function saveOrder(o: StoredOrder) { must(await db().from("orders").insert(toRow(o)).select("order_number").single()); }
export async function getOrder(n: string) { const r = await db().from("orders").select("data").eq("order_number", n).maybeSingle(); return (must(r) as Row | null)?.data ?? null; }
export async function updateOrder(n: string, fn: (o: StoredOrder) => void) {
  const o = await getOrder(n); if (!o) return null;
  fn(o); must(await db().from("orders").update(toRow(o)).eq("order_number", n).select("order_number").single()); return o;
}
/** Moves PENDING -> PAID exactly once (the database only updates a row that is still PENDING). Returns the order only for the caller that won, so emails go out once. */
export async function markPaidOnce(n: string, fn: (o: StoredOrder) => void) {
  const o = await getOrder(n); if (!o || o.paymentStatus !== "PENDING") return null;
  o.paymentStatus = "PAID"; fn(o);
  const r = await db().from("orders").update(toRow(o)).eq("order_number", n).eq("payment_status", "PENDING").select("order_number");
  return (must(r) as unknown[] | null)?.length ? o : null;
}
/** Order history for a signed-in customer: orders placed while signed in to this account, plus older ones whose checkout email matches. */
export async function listOrdersByEmail(email: string) {
  const e = email.toLowerCase();
  // Two independent lookups: one failing (or returning nothing) must not break the whole history.
  const results = await Promise.allSettled([
    db().from("orders").select("data").eq("customer_email", e).order("created_at", { ascending: false }).limit(200),
    db().from("orders").select("data").eq("data->>accountEmail", e).order("created_at", { ascending: false }).limit(200),
  ]);
  const rows: StoredOrder[] = [];
  let failures = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && !r.value.error) rows.push(...fromRows(r.value.data as Row[] | null));
    else { failures++; console.error("[orders by email]", r.status === "rejected" ? r.reason : r.value.error?.message); }
  }
  if (failures === results.length) throw new Error("Could not load orders");
  const seen = new Set<string>();
  return rows.filter((o) => !seen.has(o.orderNumber) && !!seen.add(o.orderNumber)).sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? ""));
}
export async function listAllOrders() { return fromRows(must(await db().from("orders").select("data").order("created_at", { ascending: false }))); }
/** Permanently deletes EVERY order (used by Admin > Transactions > Clear all). Returns how many were removed. */
export async function deleteAllOrders() {
  const rows = must(await db().from("orders").delete().neq("order_number", "").select("order_number")) as unknown[] | null;
  return rows?.length ?? 0;
}

/** Bakong orders still waiting for payment (used by the shop-PC watcher that checks Bakong from a Cambodian IP). */
export async function listPendingBakong() {
  const r = await db().from("orders").select("data").eq("payment_status", "PENDING").eq("data->>method", "BAKONG").order("created_at", { ascending: false }).limit(30);
  return fromRows(must(r)).filter((o) => (o.bakongMd5s?.length ?? 0) > 0 && Date.now() - Date.parse(o.createdAt) < 6 * 3600_000);
}

/** Moves PENDING -> FAILED (customer cancelled) or EXPIRED (QR time ran out) exactly once. Returns the order only for the caller that won, so its stock is given back once. A PAID order is never touched. */
export async function markUnpaidOnce(n: string, status: "FAILED" | "EXPIRED", known?: StoredOrder) {
  const o = known ?? await getOrder(n); if (!o || o.paymentStatus !== "PENDING") return null; // `known` = the order the caller already loaded (saves one read per order in the sweep)
  o.paymentStatus = status; o.stockReleased = true;
  const r = await db().from("orders").update(toRow(o)).eq("order_number", n).eq("payment_status", "PENDING").select("order_number");
  return (must(r) as unknown[] | null)?.length ? o : null;
}
/** Every Bakong order still waiting for payment (used to give stock back for abandoned ones). */
export async function listPendingBakongAll() {
  return fromRows(must(await db().from("orders").select("data").eq("payment_status", "PENDING").eq("data->>method", "BAKONG").order("created_at", { ascending: false }).limit(100)));
}

/** Orders the admin dashboard shows: everything except orders whose payment FAILED or EXPIRED (cancelled by the customer, QR time ran out, or marked failed) and Bakong orders still waiting for the customer to pay (they appear once paid). They stay in the database; only the admin's views hide them. */
export async function listAdminOrders() {
  // the database does the filtering, so hidden orders are never downloaded just to be thrown away
  const r = await db().from("orders").select("data").not("payment_status", "in", "(FAILED,EXPIRED)").or("payment_status.neq.PENDING,data->>method.neq.BAKONG").order("created_at", { ascending: false });
  return fromRows(must(r) as Row[] | null);
}
/** Payment-screenshot paths of every order, reading ONLY that one field (used by Clear all transactions). */
export async function listProofPaths() {
  const rows = must(await db().from("orders").select("proof:data->>paymentProof")) as unknown as { proof: string | null }[];
  return rows.map((r) => r.proof ?? "").filter(Boolean);
}

/** Like updateOrder, but only writes while the order is still PENDING, so it can never undo a payment that was confirmed a moment ago. */
export async function updatePendingOrder(n: string, fn: (o: StoredOrder) => void) {
  const o = await getOrder(n); if (!o || o.paymentStatus !== "PENDING") return null;
  fn(o); const r = await db().from("orders").update(toRow(o)).eq("order_number", n).eq("payment_status", "PENDING").select("order_number"); must(r); return o;
}
