import { forwardRef } from "react";
import { areaLabel, methodLabel } from "@shared/delivery";
import { BRAND, INVOICE_LOGO, contactLines, usd, invoiceNo, firstName, dateLong, timeShort, invoiceState, nextStep } from "@shared/invoice";
import type { Settings, StoredOrder } from "@shared/types";
import { windowText } from "@shared/products";
/** Fixed 760px wide, inline styles only, so the exported image/print looks exactly like the screen on every device. */
export const INVOICE_WIDTH = 760;
const hand = '"Caveat","Segoe Print","Bradley Hand","Comic Sans MS",cursive';
const body = '"Nunito","Segoe UI",ui-rounded,system-ui,"Noto Sans Khmer","Nokora",sans-serif';
const TONES = { green: { bg: "#DDF6E3", fg: "#1f7a3a" }, amber: { bg: "#FFF1CC", fg: "#8a5a00" }, red: { bg: BRAND.redPale, fg: BRAND.red } };
const Cloud = ({ w = 90, o = 0.55 }: { w?: number; o?: number }) => <svg width={w} viewBox="0 0 120 60" aria-hidden="true" style={{ opacity: o }}><path d="M30 55a20 20 0 0 1-2-40 26 26 0 0 1 49-6 22 22 0 0 1 21 14 17 17 0 0 1-4 32z" fill="#fff" /></svg>;
const label: React.CSSProperties = { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: BRAND.mute, fontWeight: 800, margin: "0 0 6px" };
const Invoice = forwardRef<HTMLDivElement, { order: StoredOrder; settings: Settings }>(function Invoice({ order: o, settings }, ref) {
  const st = invoiceState(o), tone = TONES[st.tone], c = o.customer;
  const contact = contactLines(settings);
  return (
    <div ref={ref} style={{ width: INVOICE_WIDTH, background: "#fff", color: BRAND.ink, fontFamily: body, borderRadius: 28, overflow: "hidden", boxShadow: "0 10px 40px rgba(108,184,245,.35)", position: "relative" }}>
      {/* header: sky band with the mascot logo and soft clouds */}
      <div style={{ background: `linear-gradient(135deg,${BRAND.sky},#BFE3FF)`, padding: "28px 36px 52px", position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ position: "absolute", top: 10, right: 190 }}><Cloud w={70} o={0.5} /></div><div style={{ position: "absolute", bottom: 14, left: 250 }}><Cloud w={54} o={0.4} /></div>
        <div style={{ background: "#fff", borderRadius: 22, padding: 5, width: 128, height: 128, flexShrink: 0, display: "grid", placeItems: "center", boxShadow: "0 6px 16px rgba(47,65,86,.15)", position: "relative" }}>
          <img src={INVOICE_LOGO} alt="Cloudy Toys" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 18 }} />
        </div>
        <div style={{ textAlign: "right", position: "relative", whiteSpace: "nowrap", flexShrink: 0 }}>
          <p style={{ fontFamily: hand, fontSize: 24, margin: 0, color: BRAND.ink }}>{BRAND.tagline} ✨</p>
          <h1 style={{ margin: "2px 0 4px", fontSize: 40, fontWeight: 900, letterSpacing: 3, color: BRAND.ink }}>INVOICE</h1>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{invoiceNo(o.orderNumber)}</p>
        </div>
      </div>
      {/* scalloped cloud edge (CSS circles, so the PNG export keeps it) */}
      <div aria-hidden="true" style={{ height: 20, marginTop: -20, position: "relative", backgroundImage: "radial-gradient(circle at 20px 20px, #fff 19.5px, rgba(255,255,255,0) 20px)", backgroundSize: "40px 20px", backgroundRepeat: "repeat-x" }} />

      <div style={{ padding: "6px 36px 30px" }}>
        {/* personal greeting */}
        <p style={{ fontFamily: hand, fontSize: 34, margin: "0 0 2px", color: BRAND.ink, lineHeight: 1.1 }}>Hello, {firstName(c.name)}! 🧸</p>
        <p style={{ margin: "0 0 20px", fontSize: 15, color: BRAND.mute, lineHeight: 1.5 }}>Thank you so much for shopping with us. Every toy is packed with care, just for you.</p>

        <div style={{ display: "flex", gap: 18, marginBottom: 22 }}>
          <div style={{ flex: 1, background: BRAND.skyPale, borderRadius: 20, padding: "16px 18px" }}>
            <p style={label}>Made for</p>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 17, textTransform: "capitalize" }}>{c.name}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.55 }}>{c.phone}{c.email ? <><br />{c.email}</> : null}<br />{areaLabel(o)}<br />{c.address}</p>
          </div>
          <div style={{ flex: 1, background: "#FFF6F9", borderRadius: 20, padding: "16px 18px" }}>
            <p style={{ ...label, color: "#c56a86" }}>Invoice details</p>
            <table style={{ fontSize: 13.5, borderCollapse: "collapse", width: "100%" }}><tbody>
              {([["Date", `${dateLong(o.createdAt)}, ${timeShort(o.createdAt)}`], ["Order no.", o.orderNumber], ["Payment", methodLabel(o.method)], ...(o.paidAt ? [["Paid on", dateLong(o.paidAt)]] : [])] as string[][]).map(([k, v]) => <tr key={k}><td style={{ padding: "2px 10px 2px 0", color: BRAND.mute, whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td><td style={{ padding: "2px 0", fontWeight: 700 }}>{v}</td></tr>)}
            </tbody></table>
            <span style={{ display: "inline-block", marginTop: 8, background: tone.bg, color: tone.fg, fontWeight: 900, fontSize: 12, letterSpacing: 1.2, padding: "5px 14px", borderRadius: 999, whiteSpace: "nowrap" }}>{st.label}</span>
          </div>
        </div>

        {/* items */}
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14.5 }}>
          <thead><tr>{["Product", "Qty", "Price", "Amount"].map((h, i) => <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 12px", background: BRAND.sky, color: BRAND.ink, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", borderRadius: i === 0 ? "14px 0 0 14px" : i === 3 ? "0 14px 14px 0" : 0 }}>{h}</th>)}</tr></thead>
          <tbody>{o.items.map((i, n) => <tr key={`${i.productId}-${n}`}>
            <td style={{ padding: "11px 12px", borderBottom: `1px dashed ${BRAND.border}` }}><b>{i.name}</b><br /><span style={{ fontSize: 11.5, color: BRAND.mute }}>SKU {i.sku}</span>{o.preorder && (i.opens ?? o.preorder.opens) && (i.closes ?? o.preorder.closes) && <><br /><span style={{ fontSize: 11.5, color: "#8a5a00" }}>Pre-order: {windowText({ preorderStart: i.opens ?? o.preorder.opens, preorderEnd: i.closes ?? o.preorder.closes })}</span></>}</td>
            <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px dashed ${BRAND.border}` }}>{i.qty}</td>
            <td style={{ padding: "11px 12px", textAlign: "right", borderBottom: `1px dashed ${BRAND.border}` }}>{usd(i.unitCents)}</td>
            <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 800, borderBottom: `1px dashed ${BRAND.border}` }}>{usd(i.lineCents)}</td></tr>)}</tbody>
        </table>

        {/* totals */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginTop: 16 }}>
          <div style={{ flex: 1, minWidth: 0, position: "relative", minHeight: 110 }}>
            <div style={{ transform: "rotate(-6deg)", display: "inline-block", border: `4px double ${tone.fg}`, color: tone.fg, borderRadius: 14, padding: "6px 18px", fontWeight: 900, letterSpacing: 3, fontSize: 22, opacity: 0.8, marginTop: 14, whiteSpace: "nowrap" }}>{st.label}</div>
          </div>
          <div style={{ width: 290, flexShrink: 0, fontSize: 14.5, whiteSpace: "nowrap" }}>
            <p style={{ display: "flex", justifyContent: "space-between", margin: "4px 0", color: BRAND.mute }}><span>Subtotal</span><span>{usd(o.subtotalCents)}</span></p>
            {o.discountCents > 0 && <p style={{ display: "flex", justifyContent: "space-between", margin: "4px 0", color: BRAND.mute }}><span>Discount{o.discountCode ? ` (${o.discountCode})` : ""}</span><span style={{ color: BRAND.red, fontWeight: 800 }}>−{usd(o.discountCents)}</span></p>}
            <p style={{ display: "flex", justifyContent: "space-between", margin: "4px 0", color: BRAND.mute }}><span>Delivery</span><span>{usd(o.shippingCents)}</span></p>
            <p style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 0", background: BRAND.ink, color: "#fff", borderRadius: 18, padding: "12px 18px", fontWeight: 900, fontSize: 20 }}><span>Total</span><span>{usd(o.totalCents)} {o.currency}</span></p>
          </div>
        </div>

        {c.notes ? <p style={{ margin: "16px 0 0", fontSize: 13.5, background: "#FFFBEA", borderRadius: 14, padding: "10px 14px" }}><b>Your note:</b> {c.notes}</p> : null}
        <p style={{ margin: "16px 0 0", fontSize: 14, background: BRAND.skyPale, borderRadius: 16, padding: "12px 16px", lineHeight: 1.55 }}>💌 {nextStep(o)}</p>
      </div>

      {/* footer with a hand written thank-you */}
      <div style={{ background: BRAND.skyPale, padding: "18px 36px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, borderTop: `2px dashed ${BRAND.border}` }}>
        <div><p style={{ fontFamily: hand, fontSize: 30, margin: 0, color: BRAND.ink, lineHeight: 1.2, whiteSpace: "nowrap" }}><span style={{ fontFamily: '"Nokora","Noto Sans Khmer","Khmer UI",sans-serif', fontSize: 24 }}>អរគុណ</span> · Thank you! 💙</p><p style={{ margin: "4px 0 0", fontFamily: hand, fontSize: 22, color: BRAND.ink }}>with love, {BRAND.name}</p></div>
        <p style={{ margin: 0, fontSize: 12.5, color: BRAND.ink, textAlign: "right", lineHeight: 1.6 }}>{contact.length ? contact.map((x) => <span key={x}>{x}<br /></span>) : <>Questions? Just reply to our email.<br /></>}Please keep this invoice for your records.</p>
      </div>
    </div>
  );
});
export default Invoice;
