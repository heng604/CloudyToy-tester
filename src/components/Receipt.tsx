import { forwardRef } from "react";
import { areaLabel, methodLabel } from "@shared/delivery";
import { BRAND, INVOICE_LOGO, contactLines, usd, invoiceNo, firstName, dateLong, timeShort, invoiceState, nextStep } from "@shared/invoice";
import type { Settings, StoredOrder } from "@shared/types";
import { windowText } from "@shared/products";
/** The invoice in narrow form for 58 mm and 80 mm rolls: same colours, logo, clouds, panels, stamp, total bar and footer as the A4 invoice
 *  (PAID is green). Width is the PRINTABLE width (58 mm paper prints about 48 mm, 80 mm about 72 mm), in mm so it prints at true size. Inline styles only. */
export type Paper = "58" | "80";
export const RECEIPT_MM: Record<Paper, number> = { "58": 48, "80": 72 };
const body = '"Nunito","Segoe UI",ui-rounded,system-ui,"Noto Sans Khmer","Nokora",sans-serif';
const hand = '"Caveat","Segoe Print","Bradley Hand","Comic Sans MS",cursive';
const TONES = { green: { bg: "#DDF6E3", fg: "#1f7a3a" }, amber: { bg: "#FFF1CC", fg: "#8a5a00" }, red: { bg: BRAND.redPale, fg: BRAND.red } };
const Cloud = ({ w, o }: { w: number; o: number }) => <svg width={w} viewBox="0 0 120 60" aria-hidden="true" style={{ opacity: o }}><path d="M30 55a20 20 0 0 1-2-40 26 26 0 0 1 49-6 22 22 0 0 1 21 14 17 17 0 0 1-4 32z" fill="#fff" /></svg>;
const Receipt = forwardRef<HTMLDivElement, { order: StoredOrder; settings: Settings; paper: Paper }>(function Receipt({ order: o, settings, paper }, ref) {
  const small = paper === "58", u = small ? 1 : 1.3, fs = 10 * u, pad = small ? 9 : 14, c = o.customer, st = invoiceState(o), tone = TONES[st.tone], contact = contactLines(settings);
  const label: React.CSSProperties = { fontSize: fs * 0.8, letterSpacing: 1.3, textTransform: "uppercase", color: BRAND.mute, fontWeight: 800, margin: "0 0 3px" };
  const kv = (k: string, v: string) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><span style={{ color: BRAND.mute }}>{k}</span><b style={{ textAlign: "right" }}>{v}</b></div>;
  const line = (k: string, v: React.ReactNode, color: string = BRAND.mute, bold = false) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 6, color, fontWeight: bold ? 800 : 600, margin: "2px 0", whiteSpace: "nowrap" }}><span>{k}</span><span>{v}</span></div>;
  return (
    <div ref={ref} style={{ width: `${RECEIPT_MM[paper]}mm`, background: "#fff", color: BRAND.ink, fontFamily: body, fontSize: fs, lineHeight: 1.35, fontWeight: 600, borderRadius: 16 * u, overflow: "hidden", position: "relative" }}>
      {/* header: sky band, mascot logo, soft clouds, scalloped edge */}
      <div style={{ background: `linear-gradient(135deg,${BRAND.sky},#BFE3FF)`, padding: `${pad}px ${pad}px ${pad + 8}px`, position: "relative", textAlign: "center" }}>
        <div style={{ position: "absolute", top: 4, right: 6 }}><Cloud w={30 * u} o={0.5} /></div><div style={{ position: "absolute", bottom: 14, left: 8 }}><Cloud w={24 * u} o={0.4} /></div>
        <div style={{ background: "#fff", borderRadius: 14 * u, padding: 3, width: 64 * u, height: 64 * u, margin: "0 auto", boxShadow: "0 3px 8px rgba(47,65,86,.15)", position: "relative" }}>
          <img src={INVOICE_LOGO} alt="Cloudy Toys" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 11 * u }} /></div>
        <p style={{ fontFamily: hand, fontSize: fs * 1.75, margin: "5px 0 0", lineHeight: 1.05, whiteSpace: "nowrap", position: "relative" }}>{BRAND.tagline} ✨</p>
        <h1 style={{ margin: "1px 0 1px", fontSize: fs * 2.2, fontWeight: 900, letterSpacing: 3, lineHeight: 1.1, position: "relative" }}>INVOICE</h1>
        <p style={{ margin: 0, fontWeight: 800, fontSize: fs * 1.05, position: "relative" }}>{invoiceNo(o.orderNumber)}</p>
      </div>
      <div aria-hidden="true" style={{ height: 8 * u, marginTop: -8 * u, position: "relative", backgroundImage: `radial-gradient(circle at ${8 * u}px ${8 * u}px, #fff ${7.6 * u}px, rgba(255,255,255,0) ${8 * u}px)`, backgroundSize: `${16 * u}px ${8 * u}px`, backgroundRepeat: "repeat-x" }} />

      <div style={{ padding: `2px ${pad}px ${pad}px` }}>
        <p style={{ fontFamily: hand, fontSize: fs * 2.5, margin: "0 0 1px", lineHeight: 1.05 }}>Hello, {firstName(c.name)}! 🧸</p>
        <p style={{ margin: "0 0 8px", color: BRAND.mute, lineHeight: 1.4 }}>Thank you so much for shopping with us. Every toy is packed with care, just for you.</p>

        <div style={{ background: BRAND.skyPale, borderRadius: 12 * u, padding: `${7 * u}px ${9 * u}px`, marginBottom: 6 }}>
          <p style={label}>Made for</p><p style={{ margin: 0, fontWeight: 900, fontSize: fs * 1.25, textTransform: "capitalize" }}>{c.name}</p>
          <p style={{ margin: "2px 0 0", wordBreak: "break-word", lineHeight: 1.45 }}>{c.phone}{c.email ? <><br />{c.email}</> : null}<br />{areaLabel(o)}<br />{c.address}</p></div>
        <div style={{ background: "#FFF6F9", borderRadius: 12 * u, padding: `${7 * u}px ${9 * u}px`, marginBottom: 8 }}>
          <p style={{ ...label, color: "#c56a86" }}>Invoice details</p>
          {kv("Date", `${dateLong(o.createdAt)}, ${timeShort(o.createdAt)}`)}{kv("Order no.", o.orderNumber)}{kv("Payment", methodLabel(o.method))}{o.paidAt && kv("Paid on", dateLong(o.paidAt))}
          <span style={{ display: "inline-block", marginTop: 5, background: tone.bg, color: tone.fg, fontWeight: 900, fontSize: fs * 0.95, letterSpacing: 1, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{st.label}</span></div>

        {/* items: pill header, dashed rows (price sits under the name so 3 columns fit a narrow roll) */}
        <div style={{ display: "flex", justifyContent: "space-between", background: BRAND.sky, borderRadius: 999, padding: "5px 10px", fontSize: fs * 0.85, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}><span style={{ flex: 1 }}>Product</span><span style={{ width: `${5 * u}mm`, textAlign: "right" }}>Qty</span><span style={{ width: `${16 * u}mm`, textAlign: "right" }}>Amount</span></div>
        {o.items.map((i, n) => <div key={`${i.productId}-${n}`} style={{ display: "flex", justifyContent: "space-between", gap: 4, padding: "6px 10px", borderBottom: `1.5px dashed ${BRAND.border}` }}>
          <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}><b>{i.name}</b><br /><span style={{ fontSize: fs * 0.8, color: BRAND.mute }}>SKU {i.sku} · {usd(i.unitCents)}</span>{o.preorder && (i.opens ?? o.preorder.opens) && (i.closes ?? o.preorder.closes) && <><br /><span style={{ fontSize: fs * 0.8, color: "#8a5a00" }}>Pre-order: {windowText({ preorderStart: i.opens ?? o.preorder.opens, preorderEnd: i.closes ?? o.preorder.closes })}</span></>}</span>
          <span style={{ width: `${5 * u}mm`, textAlign: "right" }}>{i.qty}</span><b style={{ width: `${16 * u}mm`, textAlign: "right", whiteSpace: "nowrap" }}>{usd(i.lineCents)}</b></div>)}

        <div style={{ marginTop: 8 }}>
          {line("Subtotal", usd(o.subtotalCents))}
          {o.discountCents > 0 && line(`Discount${o.discountCode ? ` (${o.discountCode})` : ""}`, <span style={{ color: BRAND.red, fontWeight: 800 }}>−{usd(o.discountCents)}</span>)}
          {line("Delivery", usd(o.shippingCents))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "7px 0 0", background: BRAND.ink, color: "#fff", borderRadius: 14 * u, padding: `${7 * u}px ${11 * u}px`, fontWeight: 900, fontSize: fs * 1.6, whiteSpace: "nowrap" }}><span>Total</span><span>{usd(o.totalCents)} {o.currency}</span></div></div>
        <div style={{ textAlign: "center", margin: `${14 * u}px 0 ${8 * u}px` }}><div style={{ display: "inline-block", transform: "rotate(-6deg)", border: `3px double ${tone.fg}`, color: tone.fg, borderRadius: 10 * u, padding: "3px 12px", fontWeight: 900, letterSpacing: 2, fontSize: fs * 1.55, opacity: 0.85, whiteSpace: "nowrap" }}>{st.label}</div></div>

        {c.notes ? <p style={{ margin: "6px 0 0", background: "#FFFBEA", borderRadius: 10 * u, padding: "5px 8px", wordBreak: "break-word" }}><b>Your note:</b> {c.notes}</p> : null}
        <p style={{ margin: "6px 0 0", background: BRAND.skyPale, borderRadius: 12 * u, padding: `${6 * u}px ${9 * u}px`, lineHeight: 1.45 }}>💌 {nextStep(o)}</p>
      </div>

      {/* footer with the hand written thank-you */}
      <div style={{ background: BRAND.skyPale, padding: `${pad}px`, textAlign: "center", borderTop: `1.5px dashed ${BRAND.border}` }}>
        <p style={{ fontFamily: hand, fontSize: fs * 2.2, margin: 0, lineHeight: 1.15, whiteSpace: "nowrap" }}><span style={{ fontFamily: '"Nokora","Noto Sans Khmer","Khmer UI",sans-serif', fontSize: fs * 1.7 }}>អរគុណ</span> · Thank you! 💙</p>
        <p style={{ margin: "1px 0 0", fontFamily: hand, fontSize: fs * 1.7 }}>with love, {BRAND.name}</p>
        <p style={{ margin: "5px 0 0", fontSize: fs * 0.9, lineHeight: 1.5, wordBreak: "break-word" }}>{contact.length ? contact.map((x) => <span key={x}>{x}<br /></span>) : <>Questions? Just reply to our email.<br /></>}Please keep this invoice for your records.</p>
      </div>
    </div>
  );
});
export default Receipt;
