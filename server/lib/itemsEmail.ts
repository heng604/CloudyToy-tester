// "Meet your toys" e-mail: a second, different e-mail for every order. The invoice e-mail (customerEmail.ts) is the bill; this one shows each product
// the customer bought as a photo card (name, quantity, price) with a warm message. Inline styles + tables so it works in Gmail, Outlook, Apple Mail and phones.
import type { StoredOrder } from "../../shared/types";
import { BRAND, INVOICE_LOGO, usd, invoiceNo, firstName } from "../../shared/invoice";
import { esc, LOGO_CID, siteUrl, itemWindow } from "./customerEmail";
const hand = "'Caveat','Segoe Print','Bradley Hand','Comic Sans MS',cursive";
const body = "'Nunito','Segoe UI',ui-rounded,Arial,'Helvetica Neue',sans-serif";
const CARD = ["#EAF5FF", "#FFF6F9", "#FFFBEA", "#F3EEFF"]; // soft blue, pink, yellow, purple: one colour per product, repeating
export const itemsSubject = (o: StoredOrder) => `Meet your toys, ${firstName(o.customer.name)}! 🧸 Order ${o.orderNumber}`;
/** images: productId -> picture address (absolute https, or starting with "/" when `base` is known). Products without a picture get a toy emoji. */
export function itemsHtml(o: StoredOrder, images: Record<string, string> = {}, base: string = siteUrl(), contact: string[] = [], inlineLogo = false): string {
  const name = esc(firstName(o.customer.name)), pieces = o.items.reduce((s, i) => s + i.qty, 0);
  const logoSrc = inlineLogo ? `cid:${LOGO_CID}` : base ? `${esc(base)}${INVOICE_LOGO}` : "";
  const logo = logoSrc ? `<img src="${logoSrc}" alt="Cloudy Toys" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:50%;border:4px solid #fff;background:#fff">` : `<div style="font:900 14px ${body};color:${BRAND.ink};letter-spacing:1px">CLOUDY TOYS</div>`;
  const pic = (id: string) => { const s = images[id] ?? ""; return /^https:\/\//.test(s) ? s : s.startsWith("/") && base ? `${base}${s}` : ""; };
  const cards = o.items.map((i, n) => { const src = pic(i.productId), bg = CARD[n % CARD.length];
    const img = src ? `<img src="${esc(src)}" alt="${esc(i.name)}" width="96" height="96" style="display:block;width:96px;height:96px;border-radius:18px;object-fit:cover;background:#fff">` : `<div style="width:96px;height:96px;border-radius:18px;background:#fff;text-align:center;line-height:96px;font-size:40px">🧸</div>`;
    return `<tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:22px"><tr>
      <td width="112" valign="middle" style="padding:12px 0 12px 12px">${img}</td>
      <td valign="middle" style="padding:12px 14px"><div style="font-weight:900;font-size:16px;line-height:1.3;color:${BRAND.ink}">${esc(i.name)}</div>
        <div style="margin-top:3px;font-size:12px;color:${BRAND.mute}">SKU ${esc(i.sku)}</div>${o.preorder && itemWindow(o, i) ? `<div style="margin-top:6px"><span style="display:inline-block;background:#FFEFC2;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#7a5a00">🕒 Pre-order: ${esc(itemWindow(o, i))}</span></div>` : ""}
        <div style="margin-top:8px"><span style="display:inline-block;background:#fff;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:900;color:${BRAND.ink}">× ${i.qty}</span> <span style="font-size:13px;color:${BRAND.mute}">${usd(i.unitCents)} each</span></div></td>
      <td align="right" valign="middle" style="padding:12px 16px 12px 0;font-weight:900;font-size:17px;white-space:nowrap;color:${BRAND.ink}">${usd(i.lineCents)}</td></tr></table></td></tr>`; }).join("");
  const pre = o.preorder ? `<tr><td style="padding:0 0 12px"><div style="background:#FFEFC2;border-radius:16px;padding:10px 14px;font-size:13.5px;line-height:1.5;color:#7a5a00">🕒 This is a <b>pre-order</b>. We will dispatch it in <b>${esc(o.preorder.dispatch)}</b>.</div></td></tr>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#FFF8E6;font-family:${body}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${pieces} ${pieces === 1 ? "toy is" : "toys are"} on the way to being packed for you.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E6"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:28px;overflow:hidden;color:${BRAND.ink};box-shadow:0 10px 36px rgba(255,182,200,.35)">
<tr><td style="background:${BRAND.sky};background-image:linear-gradient(135deg,#BFE3FF,#FFD9E6);padding:22px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td width="84" valign="middle">${logo}</td><td valign="middle" align="right"><div style="font-family:${hand};font-size:30px;line-height:1.1;color:#1F4E9C">Cloudy Toys</div><div style="font-size:12px;letter-spacing:2px;font-weight:800;color:${BRAND.ink}">YOUR ORDER · ${esc(invoiceNo(o.orderNumber))}</div></td></tr></table></td></tr>
<tr><td style="padding:26px 28px 6px"><div style="font-family:${hand};font-size:38px;line-height:1.1">Meet your toys, ${name}! 🧸</div>
  <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:${BRAND.mute}">You chose <b style="color:${BRAND.ink}">${pieces} ${pieces === 1 ? "toy" : "toys"}</b> from us. Here ${pieces === 1 ? "it is" : "they are"}, one by one. We are packing ${pieces === 1 ? "it" : "them"} with love.</p></td></tr>
<tr><td style="padding:16px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pre}${cards}</table></td></tr>
<tr><td style="padding:4px 28px 0"><div style="background:${BRAND.skyPale};border-radius:18px;padding:12px 16px;font-size:14px;line-height:1.6">Order <b>${esc(o.orderNumber)}</b> · ${usd(o.totalCents)} in total. Your invoice is in the other email we sent you.</div></td></tr>
<tr><td style="padding:22px 28px 24px"><div style="border-top:2px dashed ${BRAND.border};padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td valign="middle"><div style="font-family:${hand};font-size:28px;color:${BRAND.ink}">Thank you! 💙</div></td>
  <td valign="middle" align="right" style="font-size:12.5px;line-height:1.6">${contact.length ? contact.map((x) => `${esc(x)}<br>`).join("") : "Questions? Just reply to this email.<br>"}<span style="color:${BRAND.mute}">© ${new Date().getFullYear()} Cloudy Toys. All rights reserved.</span></td></tr></table></div></td></tr>
</table></td></tr></table></body></html>`;
}
