// ONE e-mail design for every order (soft "sticker" style: light-blue page, white rounded card, header pill, cloud mascot, details box,
// items table, totals box and a rotated payment STAMP). It draws four mails:
//   customer, kind "placed" / "paid"  -> the personal invoice mail to the customer
//   admin ("owner copy")              -> the "New order" mail to the shop owner, with an "Owner only" box
// Pre-orders use the same design plus the deposit / full price rows and the dates the admin set (Admin > Promotions).
// STAMP: PAID (green) · AWAITING PAYMENT (amber) · PAY WITH DELIVERY (blue) · FAILED PAYMENT (red). See invoiceState() in shared/invoice.ts.
// Customers get NO invoice link: invoices can only be opened, printed or downloaded by the admin (Admin > Orders).
// Inline styles + tables so it works in Gmail, Outlook, Apple Mail and phones.
import type { StoredOrder } from "../../shared/types";
import { areaLabel, methodLabel } from "../../shared/delivery";
import { BRAND, INVOICE_LOGO, usd, invoiceNo, firstName, dateLong, timeShort, invoiceState, nextStep } from "../../shared/invoice";
import { windowText } from "../../shared/products";
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const LOGO_CID = "invoice-logo";
export const MASCOT_CID = "cloudy-mascot";
export type CustomerMailKind = "placed" | "paid";
/** Public address of the shop, e.g. https://cloudytoys.com (no trailing slash). Needed for the logo and the admin invoice button. */
export const siteUrl = () => (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
const failed = (o: StoredOrder) => o.paymentStatus === "FAILED" || o.paymentStatus === "EXPIRED";
export const customerSubject = (o: StoredOrder, kind: CustomerMailKind) =>
  failed(o) ? `Your payment was not completed (${o.orderNumber})`
  : kind === "paid" ? `Payment received, thank you ${firstName(o.customer.name)}! 💙 (${o.orderNumber})`
  : o.preorder ? `Your pre-order is reserved, ${firstName(o.customer.name)}! 🎟️ (${o.orderNumber})`
  : `Thank you, ${firstName(o.customer.name)}! Your Cloudy Toys invoice ${invoiceNo(o.orderNumber)} 🧸`;
/** The pre-order dates of ONE order line: "1 Nov 2026 to 15 Nov 2026", or "" when that item has none. Old orders (saved before dates moved to each item) fall back to their single order-wide window. */
export const itemWindow = (o: StoredOrder, i: StoredOrder["items"][number]) => { const from = i.opens ?? o.preorder?.opens, to = i.closes ?? o.preorder?.closes; return from && to ? windowText({ preorderStart: from, preorderEnd: to }) : ""; };
/** Pre-order where the customer chose to pay the full price now (nothing left for dispatch). */
export const isFullPay = (o: StoredOrder) => !!o.preorder && o.preorder.balanceCents <= 0;
export const preorderPlan = (o: StoredOrder) => (isFullPay(o) ? "Full price" : `${o.preorder?.percent}% deposit`);
/** Stamp colour per label. */
const STAMP: Record<string, string> = { "PAID": "#1f7a3a", "AWAITING PAYMENT": "#B87500", "PAY WITH DELIVERY": "#1F4E9C", "FAILED PAYMENT": "#D62828", "REFUNDED": "#64748B" };
const body = "'Nunito','Segoe UI',ui-rounded,Arial,'Helvetica Neue',sans-serif";
const LINE = "#D6E6F5", SOFT = "#F5FAFF";

type Opts = { mode: "customer" | "admin"; kind?: CustomerMailKind; base: string; banner?: string; contact?: string[]; inlineLogo?: boolean };
function orderEmail(o: StoredOrder, { mode, kind = "placed", base, banner = "", contact = [], inlineLogo = false }: Opts): string {
  const owner = mode === "admin", c = o.customer, pre = o.preorder, name = esc(firstName(c.name)), full = isFullPay(o);
  const st = invoiceState(o), col = STAMP[st.label] ?? BRAND.ink, paid = o.paymentStatus === "PAID", bad = failed(o);
  const pieces = o.items.reduce((s, i) => s + i.qty, 0), first = o.items[0]?.name ?? "your toy", more = o.items.length - 1;
  const firstTxt = `<b>${esc(first)}</b>${more > 0 ? ` and ${more} more` : ""}`;
  const logoSrc = inlineLogo ? `cid:${LOGO_CID}` : base ? `${esc(base)}${INVOICE_LOGO}` : "";
  const mascotSrc = inlineLogo ? `cid:${MASCOT_CID}` : base ? `${esc(base)}/img/email/mascot.png` : "";
  const brand = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>${logoSrc ? `<td style="padding-right:8px"><img src="${logoSrc}" alt="" width="30" height="30" style="display:block;width:30px;height:30px;border-radius:50%"></td>` : ""}<td style="font-weight:900;font-size:17px;color:${BRAND.ink};white-space:nowrap">Cloudy Toys</td></tr></table>`;
  const mascot = mascotSrc ? `<img src="${mascotSrc}" alt="Cloudy Toys mascot" width="170" style="display:block;width:170px;max-width:100%;height:auto;border:0">` : `<div style="font-size:54px;line-height:1">☁️</div>`;
  const kv = (k: string, v: string) => `<tr><td style="padding:3px 10px 3px 0;color:${BRAND.mute};font-size:12.5px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:3px 0;font-size:13px;font-weight:800;line-height:1.4">${v}</td></tr>`;
  const who = [esc(c.phone), c.email ? esc(c.email) : ""].filter(Boolean).join("<br>");
  const cell = (v: string, a: string, x = "") => `<td align="${a}" style="padding:9px 12px;border-top:1px solid ${LINE};font-size:13.5px;${x}">${v}</td>`;
  const rows = o.items.map((i) => `<tr>${cell(`<b>${esc(i.name)}</b><br><span style="color:${BRAND.mute};font-size:11.5px">SKU ${esc(i.sku)}</span>${pre && itemWindow(o, i) ? `<br><span style="color:#7a5a00;font-size:11.5px">Pre-order: ${esc(itemWindow(o, i))}</span>` : ""}`, "left")}${cell(String(i.qty), "center")}${cell(usd(i.unitCents), "right")}${cell(usd(i.lineCents), "right", "font-weight:800;")}</tr>`).join("");
  const th = (t: string, a: string) => `<td align="${a}" style="padding:9px 12px;font-size:11px;letter-spacing:1.2px;font-weight:800;color:${BRAND.mute}">${t}</td>`;
  const sum = (k: string, v: string, s = "") => `<tr><td style="padding:4px 0;font-size:13.5px;color:${BRAND.mute};${s}">${k}</td><td align="right" style="padding:4px 0;font-size:13.5px;white-space:nowrap;${s}">${v}</td></tr>`;
  const hello = owner ? "Hi Shop Owner," : `Hi ${name},`;
  const lead = owner ? `${pre ? "New pre-order" : "New order"} received for ${firstTxt}.`
    : bad ? `We could not confirm the payment for ${firstTxt}.`
    : pre ? `Your pre-order for ${firstTxt} is reserved. We will message you when it is ready to dispatch (about <b>${esc(pre.dispatch)}</b>).`
    : kind === "paid" ? `Thank you! Your payment for ${firstTxt} is confirmed and we are packing your toys with love.`
    : `Thank you so much for shopping with us. Here is your invoice for ${firstTxt}.`;
  const planRows = pre ? `${kv("Dispatch", `about ${esc(pre.dispatch)}`)}${kv("Plan", esc(preorderPlan(o)))}` : "";
  const right = `${kv("Placed", `${esc(dateLong(o.createdAt))}, ${esc(timeShort(o.createdAt))}`)}${kv("Order no.", esc(o.orderNumber))}${kv("Payment", esc(methodLabel(o.method)))}${o.paidAt ? kv("Paid on", esc(dateLong(o.paidAt))) : ""}${planRows}`;
  const nextBox = owner ? "" : `<tr><td style="padding:12px 28px 0"><div style="background:${bad ? BRAND.redPale : paid ? "#E8F8EC" : "#FFF8DC"};border-radius:14px;padding:10px 14px;font-size:13.5px;line-height:1.55">💌 ${esc(nextStep(o))}</div></td></tr>`;
  const ownerBox = owner ? `<tr><td style="padding:12px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px dashed ${LINE};border-radius:16px"><tr><td style="padding:12px 16px"><div style="font-size:11px;letter-spacing:1.6px;font-weight:800;color:${BRAND.mute};margin-bottom:4px">OWNER ONLY</div>
    <table role="presentation" cellpadding="0" cellspacing="0">${kv("Status", esc(o.paymentStatus))}${kv("Reference", esc(o.paymentReference))}${kv("Facebook / Telegram", `${esc(c.facebook ?? "-")} / ${esc(c.telegram ?? "-")}`)}${c.notes ? kv("Customer note", esc(c.notes)) : ""}</table></td></tr></table></td></tr>
    ${base ? `<tr><td align="center" style="padding:12px 28px 0"><a href="${esc(base)}/admin/invoice/${encodeURIComponent(o.orderNumber)}" style="display:inline-block;background:${BRAND.sky};color:${BRAND.ink};font-weight:800;font-size:14px;text-decoration:none;padding:11px 24px;border-radius:999px">🧾 Open invoice (print / download)</a></td></tr>` : ""}`
    : c.notes ? `<tr><td style="padding:12px 28px 0"><div style="background:#FFFBEA;border-radius:14px;padding:10px 14px;font-size:13px;line-height:1.5"><b>Your note:</b> ${esc(c.notes)}</div></td></tr>` : "";
  const caption = pre ? (paid ? (full ? "Paid in full. Thank you!" : `Deposit received. Balance ${usd(pre.balanceCents)} is paid at dispatch.`) : bad ? "" : full ? "Pay the full price to reserve your spot." : `Pay the ${pre.percent}% deposit to reserve your spot.`)
    : paid ? `Thank you${owner ? ", payment is in" : `, ${name}`}! 💙` : st.label === "PAY WITH DELIVERY" ? `Pay ${usd(o.totalCents)} in cash on delivery.` : "";
  const payRows = pre ? `${sum(paid ? (full ? "Paid in full" : "Deposit paid") : full ? "Pay now (full)" : `Pay now (${pre.percent}%)`, usd(pre.depositCents), "font-weight:900;color:#8a5a00;")}${full ? "" : sum("Balance at dispatch", usd(pre.balanceCents))}` : "";
  const stamp = `<div style="padding:8px 0 10px 6px"><div style="display:inline-block;transform:rotate(-6deg);border:4px double ${col};color:${col};border-radius:14px;padding:5px 12px;font-weight:900;letter-spacing:1.5px;font-size:17px;white-space:nowrap">${st.label}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#E4F3FF;font-family:${body}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(owner ? `${usd(o.totalCents)} · ${st.label}` : nextStep(o))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E4F3FF"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:28px;overflow:hidden;color:${BRAND.ink};box-shadow:0 10px 36px rgba(108,184,245,.35)">
<tr><td style="padding:22px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid ${LINE};border-radius:999px"><tr>
  <td style="padding:10px 8px 10px 16px">${brand}</td>
  <td align="right" style="padding:10px 18px 10px 6px;font-size:14px;font-weight:800;letter-spacing:.5px;white-space:nowrap">${esc(invoiceNo(o.orderNumber))}</td></tr></table></td></tr>
<tr><td style="padding:22px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td valign="middle"><div style="font-size:24px;font-weight:900;line-height:1.2">${hello}</div><p style="margin:6px 0 0;font-size:14.5px;line-height:1.6">${lead}</p></td>
  <td width="170" valign="middle" align="right" style="padding-left:12px">${mascot}</td></tr></table></td></tr>
${banner ? `<tr><td style="padding:12px 28px 0">${banner}</td></tr>` : ""}
<tr><td style="padding:14px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border:1.5px solid ${LINE};border-radius:18px"><tr>
  <td width="50%" valign="top" style="padding:14px 16px"><table role="presentation" cellpadding="0" cellspacing="0">${kv("Customer", `<span style="text-transform:capitalize">${esc(c.name)}</span>`)}${kv("Contact", who)}${kv("Ship to", `${esc(areaLabel(o))}<br>${esc(c.address)}`)}</table></td>
  <td width="50%" valign="top" style="padding:14px 16px;border-left:1.5px solid ${LINE}"><table role="presentation" cellpadding="0" cellspacing="0">${right}</table></td></tr></table></td></tr>
<tr><td style="padding:14px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid ${LINE};border-radius:16px;border-collapse:separate;overflow:hidden"><tr style="background:${SOFT}">${th("ITEM", "left")}${th("QTY", "center")}${th("PRICE", "right")}${th("TOTAL", "right")}</tr>${rows}</table></td></tr>
<tr><td style="padding:14px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td valign="middle" style="font-size:12.5px;color:${BRAND.mute};line-height:1.5;padding-right:12px">${stamp}${caption ? `<div>${esc(caption)}</div>` : ""}<div style="margin-top:4px">${pieces} ${pieces === 1 ? "toy" : "toys"} · ${esc(methodLabel(o.method))}</div></td>
  <td width="270" valign="top" style="border:1.5px solid ${LINE};border-radius:16px;padding:10px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${sum("Subtotal", usd(o.subtotalCents))}${o.discountCents > 0 ? sum(`Discount${o.discountCode ? ` (${esc(o.discountCode)})` : ""}`, `−${usd(o.discountCents)}`, `color:${BRAND.red};font-weight:bold;`) : ""}${sum("Shipping", usd(o.shippingCents))}${sum("Total", `${usd(o.totalCents)} ${o.currency}`, `font-weight:900;color:${BRAND.ink};border-top:1px solid ${LINE};`)}${payRows}</table></td></tr></table></td></tr>
${nextBox}${ownerBox}
<tr><td style="padding:22px 28px 22px"><div style="border-top:1.5px dashed ${LINE};padding-top:14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td valign="middle" style="font-size:15px;font-weight:900">with love, ${BRAND.name} 💙</td>
  <td align="right" valign="middle" style="font-size:12px;line-height:1.6;color:${BRAND.mute}">${contact.length ? contact.map((x) => `${esc(x)}<br>`).join("") : owner ? "" : "Questions? Just reply to this email.<br>"}${owner ? "" : "Please keep this invoice for your records."}</td></tr></table></div></td></tr>
</table></td></tr></table></body></html>`;
}
export const customerHtml = (o: StoredOrder, kind: CustomerMailKind = "placed", base: string = siteUrl(), contact: string[] = [], inlineLogo = false) => orderEmail(o, { mode: "customer", kind, base, contact, inlineLogo });
/** The "New Order" e-mail for the shop owner: same design; `banner` holds the red/yellow payment instructions. */
export const adminInvoiceHtml = (o: StoredOrder, banner: string, base: string = siteUrl(), contact: string[] = [], inlineLogo = false) => orderEmail(o, { mode: "admin", base, banner, contact, inlineLogo });
