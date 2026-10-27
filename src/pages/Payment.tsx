import { useEffect, useState } from "react";
import { areaLabel } from "@shared/delivery";
import { useNavigate, useParams } from "react-router-dom";
import PayQr from "@/components/PayQr";
import BakongPay from "@/components/BakongPay";
import NotFound from "@/components/NotFound";
import { useSettings } from "@/lib/store";
import { useTitle } from "@/lib/title";
import type { StoredOrder } from "@shared/types";
import { payNowCents } from "@shared/orders";
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
export default function Payment() {
  useTitle("Payment", true); const { orderNumber } = useParams(); const { settings: s } = useSettings();
  const [o, setO] = useState<StoredOrder | null | undefined>(undefined); const [justPaid, setJustPaid] = useState(false);
  useEffect(() => { let live = true; setO(undefined); fetch(`/api/orders/${encodeURIComponent(orderNumber ?? "")}`).then((r) => (r.ok ? r.json() : null)).then((j) => live && setO(j?.order ?? null)).catch(() => live && setO(null)); return () => { live = false; }; }, [orderNumber]);
  const navigate = useNavigate();
  useEffect(() => { if (o && o.method === "BAKONG" && (o.paymentStatus === "FAILED" || o.paymentStatus === "EXPIRED")) { const id = setTimeout(() => navigate("/"), 3500); return () => clearTimeout(id); } }, [o, navigate]); // a cancelled or expired Bakong order goes back to the home page
  if (o === undefined) return <div className="mx-auto max-w-xl animate-pulse space-y-4" aria-busy="true"><div className="h-9 w-64 rounded-full bg-sky-pale" /><div className="h-14 rounded-xl2 bg-sky-pale" /><div className="h-40 rounded-xl2 bg-sky-pale" /></div>;
  if (!o) return <NotFound />;
  return (<div className="mx-auto max-w-xl space-y-4"><h1 className="text-2xl font-extrabold sm:text-3xl">Order {o.orderNumber}</h1>
    <p role="status" className={`rounded-xl2 p-4 font-semibold ${o.paymentStatus === "FAILED" || o.paymentStatus === "EXPIRED" ? "bg-slate-200" : "bg-green-100"}`}>Order received. Status: {o.paymentStatus === "PAID" || justPaid ? "Paid" : o.paymentStatus === "FAILED" ? "Cancelled" : o.paymentStatus === "EXPIRED" ? "Expired (no payment received)" : o.method === "COD" ? "Pay with delivery" : o.method === "BAKONG" ? "Waiting for your Bakong payment" : "Waiting for payment verification"}</p>
    <ul className="rounded-xl2 border border-sky-border bg-white p-5">{o.items.map((i) => <li key={i.productId} className="flex justify-between"><span>{i.name} × {i.qty}</span><span>{usd(i.lineCents)}</span></li>)}
      {o.discountCents > 0 && <><li className="mt-2 flex justify-between border-t border-sky-border pt-2 text-mute"><span>Subtotal</span><span>{usd(o.subtotalCents)}</span></li>
        {(o.autoDiscounts ?? []).map((a) => <li key={a.id} className="flex justify-between font-semibold text-green-700"><span>{a.name}</span><span>−{usd(a.cents)}</span></li>)}
        {o.discountCents - (o.autoDiscounts ?? []).reduce((x, a) => x + a.cents, 0) > 0 && <li className="flex justify-between font-semibold text-green-700"><span>Discount{o.discountCode ? ` (${o.discountCode})` : ""}</span><span>−{usd(o.discountCents - (o.autoDiscounts ?? []).reduce((x, a) => x + a.cents, 0))}</span></li>}</>}
      <li className={`${o.discountCents > 0 ? "" : "mt-2 border-t border-sky-border pt-2 "}flex justify-between text-mute`}><span>Delivery ({areaLabel(o)})</span><span>{usd(o.shippingCents)}</span></li>
      <li className="flex justify-between text-lg font-extrabold"><span>Total</span><span>{usd(o.totalCents)} {o.currency}</span></li></ul>
    {o.preorder && <p className="rounded-xl2 bg-[#FFF6D8] p-4 text-sm"><b>Pre-order.</b> {o.preorder.balanceCents > 0 ? <>Pay the {o.preorder.percent}% deposit of <b>{usd(o.preorder.depositCents)}</b> now. The balance of <b>{usd(o.preorder.balanceCents)}</b> is paid when your order is dispatched (about {o.preorder.dispatch}).</> : <>Pay the full price of <b>{usd(o.preorder.depositCents)}</b> now. Nothing more to pay later. We dispatch in about {o.preorder.dispatch}.</>}</p>}
    {o.paymentStatus === "PENDING" && o.method === "COD" && <p className="rounded-xl2 bg-sky-pale p-5">Please prepare <b>{usd(o.totalCents)}</b> in cash for the delivery driver.</p>}
    {(o.paymentStatus === "PENDING" || justPaid) && o.method === "BAKONG" && <BakongPay orderNumber={o.orderNumber} total={usd(payNowCents(o))} onPaid={() => setJustPaid(true)} />}
    {o.paymentStatus === "PENDING" && o.method === "QR_IMAGE" && <PayQr orderNumber={o.orderNumber} total={usd(payNowCents(o))} telegram={s.telegramUrl} facebook={s.facebookUrl} />}
    <p className="text-xs text-mute">Admin email: {o.email.status === "SENT" ? "sent" : o.email.status === "SKIPPED" ? `not sent` : o.email.status === "FAILED" ? `failed` : o.method === "BAKONG" ? "will be sent as soon as your payment is confirmed" : o.method === "QR_IMAGE" ? "will be sent when you press “I have paid”" : "pending"}</p></div>);
}
