export type PricedProduct = { id: string; name: string; priceCents: number; saleCents?: number | null; stock: number; active: boolean; backorder?: boolean };
export type Line = { productId: string; qty: number };
/** Server-side totals in integer cents. Client-sent prices are never an input. */
export function computeTotals(lines: Line[], catalog: Map<string, PricedProduct>, shippingCents: number, discountCents = 0) {
  if (!lines.length) throw new Error("EMPTY_CART");
  let subtotal = 0;
  const items = lines.map((l) => {
    const p = catalog.get(l.productId);
    if (!p || !p.active) throw new Error("PRODUCT_UNAVAILABLE");
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 99) throw new Error("INVALID_QTY");
    if (l.qty > p.stock && !p.backorder) throw new Error("INSUFFICIENT_STOCK");
    const unit = p.saleCents != null && p.saleCents < p.priceCents ? p.saleCents : p.priceCents;
    subtotal += unit * l.qty;
    return { productId: p.id, name: p.name, qty: l.qty, unitCents: unit, lineCents: unit * l.qty };
  });
  const discount = Math.min(Math.max(discountCents, 0), subtotal);
  return { items, subtotalCents: subtotal, discountCents: discount, shippingCents, totalCents: subtotal - discount + shippingCents };
}
