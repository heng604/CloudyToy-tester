import type { StoredOrder } from "../../shared/types";
import type { Product } from "../../shared/products";
import { methodLabel, areaLabel } from "../../shared/delivery";
import { stockStatus } from "../../shared/products";
import { stamp, usd } from "../../shared/stats";
import type { CsvCol } from "../../shared/csv";
import type { PdfCol } from "./pdf";
export type Dataset = { name: string; title: string; csv: CsvCol<any>[]; pdf: PdfCol[]; pdfRow: (r: any) => string[]; rows: any[]; intro: string; summary: [string, string][] };
const n0 = (n: number) => n.toLocaleString("en-US");
const area = (o: StoredOrder) => areaLabel(o);
const items = (o: StoredOrder) => o.items.map((i) => `${i.name} x${i.qty}`).join("; ");
const qty = (o: StoredOrder) => o.items.reduce((s, i) => s + i.qty, 0);

export function ordersDataset(rows: StoredOrder[]): Dataset {
  const csv: CsvCol<StoredOrder>[] = [
    { header: "Order number", get: (o) => o.orderNumber }, { header: "Date (Phnom Penh)", get: (o) => stamp(o.createdAt) },
    { header: "Customer", get: (o) => o.customer.name }, { header: "Phone", get: (o) => o.customer.phone },
    { header: "Area", get: area }, { header: "Payment method", get: (o) => methodLabel(o.method) },
    { header: "Payment status", get: (o) => o.paymentStatus }, { header: "Items", get: items }, { header: "Item count", get: qty },
    { header: "Subtotal USD", get: (o) => (o.subtotalCents / 100).toFixed(2) }, { header: "Discount USD", get: (o) => (o.discountCents / 100).toFixed(2) }, { header: "Discount code", get: (o) => o.discountCode ?? "" },
    { header: "Delivery USD", get: (o) => (o.shippingCents / 100).toFixed(2) }, { header: "Total USD", get: (o) => (o.totalCents / 100).toFixed(2) },
    { header: "Paid at", get: (o) => (o.paidAt ? stamp(o.paidAt) : "") }, { header: "Confirmed by", get: (o) => o.paidManuallyBy ?? "" }, { header: "Reference", get: (o) => o.paymentReference },
  ];
  return { name: "orders", title: "Orders", csv, rows, ...orderNotes(rows, "Hello Cloudy Toys team! Here are your orders, newest first, so you can see who is waiting and who has paid."),
    pdf: [{ header: "Order #", chars: 18 }, { header: "Date", chars: 16 }, { header: "Customer", chars: 20 }, { header: "Phone", chars: 14 }, { header: "Area", chars: 10 }, { header: "Method", chars: 16 }, { header: "Status", chars: 8 }, { header: "Qty", chars: 4, right: true }, { header: "Total", chars: 10, right: true }],
    pdfRow: (o: StoredOrder) => [o.orderNumber, stamp(o.createdAt), o.customer.name, o.customer.phone, area(o), methodLabel(o.method), o.paymentStatus, String(qty(o)), usd(o.totalCents)] };
}
const products = (o: StoredOrder) => o.items.map((i) => i.name).join("; ");
const money = (c: number) => (c / 100).toFixed(2);
/** Sale amount without delivery: what the toys sold for after the invoice discount. */
const saleCents = (o: StoredOrder) => o.subtotalCents - o.discountCents;
/** The shop has no courier status field, so it is worked out from the payment and the pay method. */
export const deliveryStatus = (o: StoredOrder) => (o.paymentStatus === "PAID" ? (o.preorder ? `Paid - dispatch ${o.preorder.dispatch}` : "Paid - ready to deliver") : o.method === "COD" ? "Cash on delivery" : "Waiting for payment");
export function transactionsDataset(rows: StoredOrder[]): Dataset {
  const csv: CsvCol<StoredOrder>[] = [
    { header: "Date", get: (o) => stamp(o.createdAt) }, { header: "Order number", get: (o) => o.orderNumber }, { header: "Product", get: products }, { header: "Customer", get: (o) => o.customer.name },
    { header: "Sold QTY", get: qty }, { header: "Sub Amount", get: (o) => money(o.subtotalCents) }, { header: "Invoice Discount", get: (o) => money(o.discountCents) }, { header: "Total Sale", get: (o) => money(saleCents(o)) },
  ];
  return { name: "sales", title: "Sales Transaction Report", csv, rows, intro: "Hello Cloudy Toys team! Here is what you sold: each order with its toys, quantity and what the customer paid for them (delivery is in the Delivery Report).",
    summary: [["Orders", n0(rows.length)], ["Toys sold", n0(rows.reduce((t, o) => t + qty(o), 0))], ["Invoice discounts", usd(rows.reduce((t, o) => t + o.discountCents, 0))], ["Total sale", usd(rows.reduce((t, o) => t + saleCents(o), 0))]],
    pdf: [{ header: "Date", chars: 15 }, { header: "Order number", chars: 17 }, { header: "Product", chars: 28 }, { header: "Customer", chars: 18 }, { header: "Sold QTY", chars: 10, right: true }, { header: "Sub Amount", chars: 11, right: true }, { header: "Invoice Discount", chars: 13, right: true }, { header: "Total Sale", chars: 11, right: true }],
    pdfRow: (o: StoredOrder) => [stamp(o.createdAt), o.orderNumber, products(o), o.customer.name, String(qty(o)), usd(o.subtotalCents), usd(o.discountCents), usd(saleCents(o))] };
}
export function deliveryDataset(rows: StoredOrder[]): Dataset {
  const csv: CsvCol<StoredOrder>[] = [
    { header: "Date", get: (o) => stamp(o.createdAt) }, { header: "Order number", get: (o) => o.orderNumber }, { header: "Customer", get: (o) => o.customer.name },
    { header: "Sub Amount", get: (o) => money(o.subtotalCents) }, { header: "Discount", get: (o) => money(o.discountCents) }, { header: "Delivery Fee", get: (o) => money(o.shippingCents) },
    { header: "Total Sale", get: (o) => money(o.totalCents) }, { header: "Delivery Status", get: deliveryStatus },
  ];
  return { name: "delivery", title: "Delivery Report", csv, rows, intro: "Hello Cloudy Toys team! Here are your deliveries: what each customer owes, the delivery fee, and whether the parcel is ready to go.",
    summary: [["Deliveries", n0(rows.length)], ["Ready to deliver", n0(rows.filter((o) => o.paymentStatus === "PAID").length)], ["Delivery fees", usd(rows.reduce((t, o) => t + o.shippingCents, 0))], ["Total sale", usd(rows.reduce((t, o) => t + o.totalCents, 0))]],
    pdf: [{ header: "Date", chars: 15 }, { header: "Order number", chars: 17 }, { header: "Customer", chars: 20 }, { header: "Sub Amount", chars: 11, right: true }, { header: "Discount", chars: 10, right: true }, { header: "Delivery Fee", chars: 11, right: true }, { header: "Total Sale", chars: 11, right: true }, { header: "Delivery Status", chars: 22 }],
    pdfRow: (o: StoredOrder) => [stamp(o.createdAt), o.orderNumber, o.customer.name, usd(o.subtotalCents), usd(o.discountCents), usd(o.shippingCents), usd(o.totalCents), deliveryStatus(o)] };
}
const orderNotes = (rows: StoredOrder[], intro: string) => ({ intro, summary: [["Orders", n0(rows.length)], ["Paid", n0(rows.filter((o) => o.paymentStatus === "PAID").length)], ["Waiting for payment", n0(rows.filter((o) => o.paymentStatus !== "PAID").length)], ["Money received", usd(rows.filter((o) => o.paymentStatus === "PAID").reduce((t, o) => t + o.totalCents, 0))]] as [string, string][] });
const price = (p: Product) => p.salePrice ?? p.price;
export function productsDataset(rows: Product[]): Dataset {
  const csv: CsvCol<Product>[] = [
    { header: "SKU", get: (p) => p.sku }, { header: "Name", get: (p) => p.name }, { header: "Category", get: (p) => p.category },
    { header: "Price USD", get: (p) => p.price.toFixed(2) }, { header: "Sale price USD", get: (p) => (p.salePrice != null ? p.salePrice.toFixed(2) : "") },
    { header: "Stock", get: (p) => p.stock }, { header: "Stock status", get: (p) => stockStatus(p.stock) }, { header: "Visible in shop", get: (p) => (p.active === false ? "No" : "Yes") }, { header: "Description", get: (p) => p.description },
  ];
  return { name: "products", title: "Products", csv, rows, intro: "Hello Cloudy Toys team! Here is your whole toy shelf, with prices, sale prices and what customers can see in the shop.",
    summary: [["Products", n0(rows.length)], ["Shown in the shop", n0(rows.filter((p) => p.active !== false).length)], ["On sale", n0(rows.filter((p) => p.salePrice != null).length)], ["Out of stock", n0(rows.filter((p) => p.stock <= 0).length)]],
    pdf: [{ header: "SKU", chars: 12 }, { header: "Name", chars: 34 }, { header: "Category", chars: 12 }, { header: "Price", chars: 9, right: true }, { header: "Sale", chars: 9, right: true }, { header: "Stock", chars: 6, right: true }, { header: "Level", chars: 5 }, { header: "Shown", chars: 5 }],
    pdfRow: (p: Product) => [p.sku, p.name, p.category, `$${p.price.toFixed(2)}`, p.salePrice != null ? `$${p.salePrice.toFixed(2)}` : "-", String(p.stock), stockStatus(p.stock), p.active === false ? "No" : "Yes"] };
}
export function stockDataset(rows: Product[]): Dataset {
  const csv: CsvCol<Product>[] = [
    { header: "SKU", get: (p) => p.sku }, { header: "Name", get: (p) => p.name }, { header: "Category", get: (p) => p.category }, { header: "Stock", get: (p) => p.stock },
    { header: "Level", get: (p) => stockStatus(p.stock) }, { header: "Unit price USD", get: (p) => price(p).toFixed(2) }, { header: "Stock value USD", get: (p) => (price(p) * p.stock).toFixed(2) },
  ];
  return { name: "stock", title: "Stock report", csv, rows, intro: "Hello Cloudy Toys team! Here is how much of each toy is on your shelf, starting with the ones that need restocking first.",
    summary: [["Toys listed", n0(rows.length)], ["Units in stock", n0(rows.reduce((t, p) => t + p.stock, 0))], ["Stock value", `$${n0(Math.round(rows.reduce((t, p) => t + price(p) * p.stock, 0) * 100) / 100)}`], ["Need restocking", n0(rows.filter((p) => stockStatus(p.stock) !== "OK").length)]],
    pdf: [{ header: "SKU", chars: 12 }, { header: "Name", chars: 40 }, { header: "Category", chars: 12 }, { header: "Stock", chars: 6, right: true }, { header: "Level", chars: 6 }, { header: "Unit", chars: 9, right: true }, { header: "Value", chars: 11, right: true }],
    pdfRow: (p: Product) => [p.sku, p.name, p.category, String(p.stock), stockStatus(p.stock), `$${price(p).toFixed(2)}`, `$${(price(p) * p.stock).toFixed(2)}`] };
}
