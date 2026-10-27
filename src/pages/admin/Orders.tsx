import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Link, useSearchParams } from "react-router-dom";
import { methodLabel, areaLabel } from "@shared/delivery";
import { filterOrders, sortOrders, summarize, usd, stamp } from "@shared/stats";
import { invoiceNo, firstName } from "@shared/invoice";
import type { StoredOrder } from "@shared/types";
import { windowText } from "@shared/products";
import ExportButtons from "@/components/admin/ExportButtons";
import Skeleton from "@/components/Skeleton";
import { getSubmit } from "@/lib/forms";
import { post } from "@/lib/api";
import { useTitle } from "@/lib/title";
import { useAdmin, refreshAdmin } from "./hooks";

const hand = '"Caveat","Segoe Print","Bradley Hand","Comic Sans MS",cursive';
type Proofs = Record<string, string>;
const TABS = [{ id: "ALL", label: "All orders" }, { id: "CHECK", label: "Needs checking" }, { id: "PENDING", label: "Pay with delivery" }, { id: "PAID", label: "Paid" }];

/** "5 min ago" style label (relative time only). */
const ago = (iso: string, now = Date.now()) => { const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
/** Customer says they paid / uploaded a screenshot, but the admin has not confirmed yet. */
const needsCheck = (o: StoredOrder) => o.paymentStatus === "PENDING" && !!(o.claimedPaidAt || o.paymentProof);
const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
const link = (v: string | undefined, base: string) => (!v ? "" : /^https?:\/\//.test(v) ? v : `${base}${v.replace(/^@/, "")}`);

/** One calm status per order: label, soft colour and the colour of its dot. */
function statusOf(o: StoredOrder) {
  if (o.paymentStatus === "PAID") return { label: "Paid", chip: "bg-green-100 text-green-800", dot: "bg-green-500" };
  if (o.paymentStatus === "REFUNDED") return { label: "Refunded", chip: "bg-slate-100 text-slate-700", dot: "bg-slate-400" };
  if (o.paymentStatus === "FAILED" || o.paymentStatus === "EXPIRED") return { label: o.paymentStatus === "FAILED" ? "Failed" : "Expired", chip: "bg-red-100 text-red-800", dot: "bg-red-500" };
  if (needsCheck(o)) return { label: "Check payment", chip: "bg-amber-100 text-amber-900", dot: "bg-amber-500" };
  return { label: o.method === "COD" ? "Pay on delivery" : "Waiting", chip: "bg-sky-pale text-ink", dot: "bg-sky-hover" };
}
const Chip = ({ children, cls }: { children: ReactNode; cls: string }) => <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${cls}`}>{children}</span>;
const Avatar = ({ name, size = "h-11 w-11 text-lg" }: { name: string; size?: string }) => <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-pale to-sky font-black uppercase text-ink ${size}`}>{firstName(name).charAt(0)}</span>;
const H3 = ({ children }: { children: ReactNode }) => <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-mute">{children}</h3>;
const Row = ({ k, children }: { k: string; children: ReactNode }) => <div className="grid grid-cols-[5.5rem_1fr] gap-2 py-1.5 text-sm"><dt className="text-mute">{k}</dt><dd className="min-w-0 break-words font-semibold">{children}</dd></div>;
const mailText = (s: string) => (s === "SENT" ? "sent" : s === "FAILED" ? "failed" : s === "SKIPPED" ? "skipped" : s === "NO EMAIL" ? "no email" : "not sent");
const mailCls = (s: string) => (s === "SENT" ? "text-green-700" : s === "FAILED" ? "text-red-600" : "text-mute");

/** Day heading: Today / Yesterday / 2026-10-23 (Phnom Penh calendar day). */
const dayLabel = (iso: string, now = Date.now()) => { const d = stamp(iso).slice(0, 10); return d === stamp(new Date(now).toISOString()).slice(0, 10) ? "Today" : d === stamp(new Date(now - 86400000).toISOString()).slice(0, 10) ? "Yesterday" : d; };

export default function AdminOrders() {
  const { t } = useI18n(); useTitle(t("Orders"), true);
  const [sp, setSp] = useSearchParams(); const { data } = useAdmin<{ orders: StoredOrder[]; proofs: Proofs }>("/admin/orders?proofs=1");
  const [busy, setBusy] = useState(""); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [zoom, setZoom] = useState(""); const [sel, setSel] = useState("");
  if (!data) return <Skeleton />;
  const tab = sp.get("status") ?? "ALL", q = sp.get("q") ?? undefined; const proofs = data.proofs ?? {};
  const f = { status: tab === "ALL" || tab === "CHECK" ? undefined : tab, q };
  const all = data.orders, s = summarize(all), checkN = all.filter(needsCheck).length, codPending = all.filter((o) => o.paymentStatus === "PENDING" && o.method === "COD");
  const orders = sortOrders(filterOrders(all, f), "new").filter((o) => tab !== "CHECK" || needsCheck(o)).filter((o) => tab !== "PENDING" || o.method === "COD");
  const counts: Record<string, number> = { ALL: s.count, CHECK: checkN, PENDING: codPending.length, PAID: s.paidCount };
  const setTab = (id: string) => { const p = new URLSearchParams(sp); if (id === "ALL") p.delete("status"); else p.set("status", id); setSp(p); };
  const picked = all.find((o) => o.orderNumber === sel) ?? null;
  const groups: { day: string; list: StoredOrder[] }[] = [];
  for (const o of orders) { const day = dayLabel(o.createdAt); const g = groups[groups.length - 1]; if (g && g.day === day) g.list.push(o); else groups.push({ day, list: [o] }); }

  // every action reports success or the real reason it failed, instead of silently doing nothing
  const act = async (key: string, path: string, okText: string) => {
    setBusy(key); setMsg(null);
    try { const r = await post(path); const j = await r.json().catch(() => ({})) as { ok?: boolean; detail?: string; status?: string };
      if (r.ok && j.ok !== false && j.status !== "SKIPPED" && j.status !== "FAILED") setMsg({ ok: true, text: okText });
      else setMsg({ ok: false, text: `Could not do that${j.detail ? `: ${j.detail.replace(/\.+$/, "")}` : j.status ? ` (${j.status.toLowerCase()})` : ` (server error ${r.status})`}.` });
    } catch { setMsg({ ok: false, text: "Network error. Please try again." }); }
    setBusy(""); refreshAdmin();
  };
  const path = (o: StoredOrder, end: string) => `/admin/orders/${encodeURIComponent(o.orderNumber)}/${end}`;
  const markPaid = (o: StoredOrder) => { if (window.confirm(`Mark ${o.orderNumber} (${usd(o.totalCents)}) as PAID?\nOnly do this after you checked your ABA / bank app. The customer gets a “payment received” email.`)) void act(`paid:${o.orderNumber}`, path(o, "mark-paid"), `${o.orderNumber} is paid. Receipt sent to the customer.`); };
  const markFailed = (o: StoredOrder) => { if (window.confirm(`Mark the payment of ${o.orderNumber} (${usd(o.totalCents)}) as FAILED?\nThe invoice will show the FAILED PAYMENT stamp. Stock is not changed.`)) void act(`fail:${o.orderNumber}`, path(o, "mark-failed"), `${o.orderNumber} is marked as failed payment.`); };

  const pill = "rounded-full border border-sky-border bg-white px-4 py-2";
  const tool = "flex w-full items-center justify-between gap-3 rounded-2xl border border-sky-border bg-white px-4 py-3 text-left text-sm font-bold transition hover:bg-sky-pale disabled:opacity-60";

  /** The side panel: everything about ONE order, in calm sections. */
  const detail = (o: StoredOrder) => {
    const c = o.customer, st = statusOf(o), proof = o.paymentProof ? proofs[o.paymentProof] : "", check = needsCheck(o);
    const tg = link(c.telegram, "https://t.me/"), fb = link(c.facebook, "https://facebook.com/");
    const custMail = o.customerEmail?.status ?? (c.email ? "NOT SENT" : "NO EMAIL");
    return (<>
      <div className="flex items-center justify-between border-b border-sky-border px-5 py-3 lg:hidden">
        <button onClick={() => setSel("")} className="rounded-full px-3 py-1.5 text-sm font-bold hover:bg-sky-pale">← Orders</button><span className="text-xs font-bold text-mute">{o.orderNumber}</span></div>
      <div className="space-y-6 overflow-y-auto p-5 lg:max-h-[calc(100vh-2rem)]">
        <div>
          <div className="flex items-start gap-3"><Avatar name={c.name} size="h-14 w-14 text-2xl" />
            <div className="min-w-0 flex-1"><p className="break-words text-xl font-extrabold capitalize leading-tight">{c.name}</p>
              <p className="mt-0.5 text-xs text-mute">{o.orderNumber} · {ago(o.createdAt)}</p><p className="text-xs text-mute">{stamp(o.createdAt)}</p></div>
            <button onClick={() => setSel("")} aria-label="Close" className="hidden rounded-full px-2.5 py-1 text-lg font-black text-mute hover:bg-sky-pale lg:block">×</button></div>
          <div className="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-sky-pale p-4">
            <div><p className="text-xs font-bold text-mute">Total</p><p className="text-3xl font-black leading-none">{usd(o.totalCents)}</p></div>
            <div className="flex flex-col items-end gap-1.5"><Chip cls={st.chip}><span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />{st.label}</Chip><span className="text-xs font-bold text-mute">{methodLabel(o.method)}</span></div></div>
        </div>

        {(o.paymentStatus === "PENDING") && <div className="space-y-2">
          {check && o.claimedPaidAt && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Customer says they paid · {stamp(o.claimedPaidAt)}. Check your ABA app before confirming.</p>}
          <button disabled={!!busy} onClick={() => markPaid(o)} className="w-full rounded-2xl bg-sky py-3 font-extrabold shadow-soft hover:bg-sky-hover disabled:opacity-60">{busy === `paid:${o.orderNumber}` ? "Saving…" : `✓ ${t("Mark as paid (I verified it)")}`}</button>
          <button disabled={!!busy} onClick={() => markFailed(o)} className="w-full rounded-2xl py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">{busy === `fail:${o.orderNumber}` ? "Saving…" : "Payment failed"}</button></div>}
        {o.paymentStatus === "PAID" && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">Paid{o.paidAt ? ` · ${stamp(o.paidAt)}` : ""}{o.paidManuallyBy ? ` · confirmed by ${o.paidManuallyBy}` : ""}</p>}

        <section><H3>Items</H3>
          <ul className="divide-y divide-sky-border rounded-2xl border border-sky-border">{o.items.map((i, n) => { const from = i.opens ?? o.preorder?.opens, to = i.closes ?? o.preorder?.closes;
            return <li key={`${i.productId}-${n}`} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0"><p className="text-sm font-bold">{i.name}</p><p className="text-xs text-mute">{i.qty} × {usd(i.unitCents)} · {i.sku}</p>
                {from && to && <p className="mt-1 inline-block rounded-full bg-[#FFF1C9] px-2 py-0.5 text-xs font-bold text-[#8a5a00]">🕒 Pre-order {windowText({ preorderStart: from, preorderEnd: to })}</p>}</div>
              <p className="shrink-0 text-sm font-extrabold">{usd(i.lineCents)}</p></li>; })}</ul>
          <dl className="mt-3 space-y-1 px-1 text-sm">
            <div className="flex justify-between text-mute"><dt>Subtotal</dt><dd>{usd(o.subtotalCents)}</dd></div>
            {o.discountCents > 0 && <div className="flex justify-between text-green-700"><dt>Discount{o.discountCode ? ` (${o.discountCode})` : ""}</dt><dd>−{usd(o.discountCents)}</dd></div>}
            <div className="flex justify-between text-mute"><dt>Delivery</dt><dd>{usd(o.shippingCents)}</dd></div>
            <div className="flex justify-between border-t border-sky-border pt-1.5 font-extrabold"><dt>Total</dt><dd>{usd(o.totalCents)}</dd></div>
            {o.preorder && <div className="flex justify-between text-[#8a5a00]"><dt>{o.preorder.balanceCents > 0 ? "Deposit now · balance at dispatch" : "Pre-order · paid in full"}</dt><dd>{usd(o.preorder.depositCents)}{o.preorder.balanceCents > 0 ? ` · ${usd(o.preorder.balanceCents)}` : ""}</dd></div>}
          </dl></section>

        <section><H3>Customer</H3>
          <dl className="divide-y divide-sky-border/60">
            <Row k="Phone"><a className="hover:underline" href={tel(c.phone)}>{c.phone}</a></Row>
            {c.email && <Row k="Email"><a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a></Row>}
            {tg && <Row k="Telegram"><a className="hover:underline" href={tg} target="_blank" rel="noopener noreferrer">{c.telegram}</a></Row>}
            {fb && <Row k="Facebook"><a className="hover:underline" href={fb} target="_blank" rel="noopener noreferrer">{c.facebook}</a></Row>}
            <Row k="Deliver to"><span className="block text-mute">{areaLabel(o)}</span>{c.address}</Row>
            {c.notes && <Row k="Note"><span className="rounded-lg bg-[#FFFBEA] px-2 py-1">{c.notes}</span></Row>}
          </dl></section>

        {o.method === "QR_IMAGE" && <section><H3>Payment screenshot</H3>
          {proof ? <button type="button" onClick={() => setZoom(proof)} className="group block w-full text-left" aria-label={`Open payment screenshot for ${o.orderNumber}`}>
            <img loading="lazy" src={proof} alt={`Payment screenshot for ${o.orderNumber}`} className="h-40 w-full rounded-2xl border border-sky-border bg-sky-pale object-contain transition group-hover:shadow-soft" /><span className="mt-1 block text-center text-xs font-bold text-mute">Tap to enlarge</span></button>
            : <p className="rounded-2xl border-2 border-dashed border-sky-border p-4 text-center text-sm text-mute">No screenshot uploaded yet</p>}</section>}

        <section><H3>Invoice &amp; emails</H3>
          <div className="space-y-2">
            <Link to={`/admin/invoice/${encodeURIComponent(o.orderNumber)}`} title={invoiceNo(o.orderNumber)} className={tool}><span>🧾 Open invoice · print 58 / 80 mm / A4</span><span aria-hidden="true">→</span></Link>
            {c.email && <button disabled={!!busy} onClick={() => void act(`inv:${o.orderNumber}`, path(o, "resend-invoice"), `Invoice emailed to ${c.email}.`)} className={tool}><span>{busy === `inv:${o.orderNumber}` ? "Sending…" : "✉️ Send invoice to customer"}</span><span className={`text-xs ${mailCls(custMail)}`}>{mailText(custMail)}</span></button>}
            {c.email && <button disabled={!!busy} onClick={() => void act(`itm:${o.orderNumber}`, path(o, "resend-items"), `"Meet your toys" email sent to ${c.email}.`)} className={tool}><span>{busy === `itm:${o.orderNumber}` ? "Sending…" : "🧸 Send product email to customer"}</span><span aria-hidden="true">→</span></button>}
            <button disabled={!!busy || o.email.status === "SENT"} onClick={() => void act(`adm:${o.orderNumber}`, path(o, "resend-email"), "Order email sent to the admin inbox.")} className={tool}><span>{busy === `adm:${o.orderNumber}` ? "Sending…" : "↻ Resend admin email"}</span><span className={`text-xs ${mailCls(o.email.status)}`}>{o.email.status === "SENT" ? "sent" : mailText(o.email.status)}</span></button>
          </div></section>
      </div></>);
  };

  return (<div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-3xl leading-none sm:text-4xl" style={{ fontFamily: hand, fontWeight: 700 }}>Your little shop orders 🧸</p>
        <h1 className="mt-1.5 text-sm font-semibold text-mute">{s.count} {s.count === 1 ? "order" : "orders"} · <span className="text-green-700">{usd(s.paidCents)} paid</span> · {usd(codPending.reduce((n, o) => n + o.totalCents, 0))} pay with delivery</h1></div>
      <ExportButtons type="orders" params={{ status: f.status, q }} /></div>

    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Order status" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-soft">
        {TABS.map((x) => { const on = tab === x.id; return <button key={x.id} role="tab" aria-selected={on} onClick={() => setTab(x.id)} className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${on ? "bg-ink text-white" : "text-ink hover:bg-sky-pale"}`}>
          {t(x.label)}<span className={`rounded-full px-2 py-0.5 text-xs font-black ${on ? "bg-white/20" : x.id === "CHECK" && counts.CHECK > 0 ? "bg-amber-200 text-amber-900" : "bg-sky-pale text-mute"}`}>{counts[x.id]}</span></button>; })}</div>
      <form key={sp.toString()} onSubmit={getSubmit(setSp)} className="flex min-w-60 flex-1 gap-2"><input name="q" defaultValue={q} placeholder="Search order, name, phone, email" className={`${pill} min-w-0 flex-1`} aria-label="Search orders" />
        {tab !== "ALL" && <input type="hidden" name="status" value={tab} />}
        <button className="rounded-full bg-sky px-5 py-2 font-bold hover:bg-sky-hover">{t("Filter")}</button>{(q || tab !== "ALL") && <Link to="/admin/orders" className={pill}>{t("Reset")}</Link>}</form></div>

    {msg && <p role={msg.ok ? "status" : "alert"} className={`flex items-center justify-between gap-3 rounded-2xl p-3 text-sm font-semibold ${msg.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}><span>{msg.ok ? "✓ " : "⚠ "}{msg.text}</span><button onClick={() => setMsg(null)} aria-label="Dismiss" className="rounded-full px-2 font-black">×</button></p>}

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_25rem] xl:grid-cols-[minmax(0,1fr)_27rem]">
      <div className="space-y-5">
        {orders.length === 0 && <div className="rounded-3xl bg-white p-10 text-center shadow-soft"><p className="text-3xl" style={{ fontFamily: hand, fontWeight: 700 }}>No orders here yet ☁️</p><p className="mt-1 text-sm text-mute">Try another tab or clear the search.</p></div>}
        {groups.map((g) => <section key={g.day} aria-label={g.day}>
          <h2 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-[0.14em] text-mute">{g.day}</h2>
          <ul className="space-y-2">{g.list.map((o) => { const st = statusOf(o), on = sel === o.orderNumber; const first = o.items[0], more = o.items.length - 1;
            return <li key={o.orderNumber}><button type="button" onClick={() => setSel(on ? "" : o.orderNumber)} aria-pressed={on} className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-soft ring-2 transition hover:-translate-y-0.5 hover:shadow-lift ${on ? "ring-sky-hover" : "ring-transparent"}`}>
              <Avatar name={o.customer.name} />
              <span className="min-w-0 flex-1"><span className="block truncate font-extrabold capitalize leading-tight">{o.customer.name}</span>
                <span className="block truncate text-sm text-mute">{first ? `${first.qty}× ${first.name}` : "—"}{more > 0 ? ` +${more} more` : ""}</span>
                <span className="block text-xs text-mute/80">{o.orderNumber} · {ago(o.createdAt)}</span></span>
              <span className="flex shrink-0 flex-col items-end gap-1.5"><span className="text-lg font-black leading-none">{usd(o.totalCents)}</span><Chip cls={st.chip}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} aria-hidden="true" />{st.label}</Chip></span></button></li>; })}</ul></section>)}
      </div>

      {picked
        ? <aside aria-label={`Order ${picked.orderNumber}`} className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-white lg:sticky lg:top-4 lg:z-auto lg:block lg:overflow-hidden lg:rounded-3xl lg:shadow-lift">{detail(picked)}</aside>
        : <aside className="hidden rounded-3xl border-2 border-dashed border-sky-border p-10 text-center text-mute lg:block"><p className="text-4xl" aria-hidden="true">🧸</p><p className="mt-2 font-bold">Pick an order</p><p className="text-sm">Click any order on the left to see its items, customer and actions.</p></aside>}
    </div>

    {zoom && <div role="dialog" aria-modal="true" aria-label="Payment screenshot" onClick={() => setZoom("")} onKeyDown={(e) => e.key === "Escape" && setZoom("")} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="relative max-h-full" onClick={(e) => e.stopPropagation()}><img src={zoom} alt="Payment screenshot" className="max-h-[85vh] max-w-full rounded-2xl border-4 border-white object-contain" />
        <div className="mt-2 flex justify-center gap-2"><a href={zoom} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-4 py-2 text-sm font-bold">Open full size</a><button autoFocus onClick={() => setZoom("")} className="rounded-full bg-sky px-4 py-2 text-sm font-bold">Close</button></div></div></div>}
  </div>);
}
