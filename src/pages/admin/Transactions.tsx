import { useI18n } from "@/lib/i18n";
import { Link, useSearchParams } from "react-router-dom";
import { methodLabel } from "@shared/delivery";
import { filterOrders, sortOrders, summarize, usd, stamp } from "@shared/stats";
import { PAYMENT_STATUSES } from "@shared/orders";
import type { StoredOrder } from "@shared/types";
import ExportButtons from "@/components/admin/ExportButtons";
import DeleteButton from "@/components/admin/DeleteButton";
import Skeleton from "@/components/Skeleton";
import { getSubmit } from "@/lib/forms";
import { post } from "@/lib/api";
import { useTitle } from "@/lib/title";
import { useAdmin, refreshAdmin, Msg } from "./hooks";
export default function Transactions() {
  const { t } = useI18n(); useTitle(t("Transactions"), true);
  const [sp, setSp] = useSearchParams(); const { data } = useAdmin<{ orders: StoredOrder[]; proofs: Record<string, string> }>("/admin/orders?proofs=1");
  if (!data) return <Skeleton />;
  const sortQ = sp.get("sort") ?? ""; const sort = ["low", "high", "new", "oldest"].includes(sortQ) ? sortQ : "high";
  const f = { status: sp.get("status") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined };
  const rows = sortOrders(filterOrders(data.orders, f), sort), s = summarize(rows); const urls = data.proofs;
  const cls = "rounded-full border border-sky-border bg-white px-4 py-2", card = "rounded-xl2 border border-sky-border bg-white p-4";
  const clear = async () => { const r = await post("/admin/transactions/clear"); refreshAdmin(); setSp(r.ok ? { cleared: "1" } : { error: "Could not clear the transactions. Please try again." }); };
  return (<div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold sm:text-3xl">{t("Transactions")}</h1><div className="flex flex-wrap items-center gap-2"><ExportButtons type="transactions" params={{ ...f, sort }} /><DeleteButton action={clear} label="Clear all transactions" message="Delete ALL transactions and orders permanently? This cannot be undone. Export them first if you need a copy." /></div></div>
    <Msg ok={sp.get("cleared") && "All transactions cleared"} err={sp.get("error")} />
    <form key={sp.toString()} onSubmit={getSubmit(setSp)} className="flex flex-wrap items-end gap-2">
      <label className="text-sm">Sort<select name="sort" defaultValue={sort} className={`${cls} block`}><option value="high">Highest first</option><option value="low">Lowest first</option><option value="new">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <label className="text-sm">Status<select name="status" defaultValue={f.status ?? "ALL"} className={`${cls} block`}><option value="ALL">All</option>{PAYMENT_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="text-sm">From<input type="date" name="from" defaultValue={f.from} className={`${cls} block`} /></label>
      <label className="text-sm">To<input type="date" name="to" defaultValue={f.to} className={`${cls} block`} /></label>
      <button className="rounded-full bg-sky px-5 py-2 font-bold hover:bg-sky-hover">Apply</button><Link to="/admin/transactions" className={cls}>Reset</Link></form>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className={card}><p className="text-sm text-mute">Transactions</p><p className="text-xl font-extrabold">{s.count}</p></div><div className={card}><p className="text-sm text-mute">Lowest</p><p className="text-xl font-extrabold">{usd(s.minCents)}</p></div><div className={card}><p className="text-sm text-mute">Highest</p><p className="text-xl font-extrabold">{usd(s.maxCents)}</p></div><div className={card}><p className="text-sm text-mute">Average · Paid total</p><p className="text-xl font-extrabold">{usd(s.avgCents)} · {usd(s.paidCents)}</p></div></div>
    {rows.length === 0 ? <p className="rounded-xl2 bg-sky-pale p-6">No transactions match.</p> :
      <div className="overflow-x-auto rounded-xl2 border border-sky-border bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-sky-pale"><tr>{["Order", "Date", "Customer", "Method", "Payment screenshot", "Status", "Delivery", "Total"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{rows.map((o) => <tr key={o.orderNumber} className="border-t border-sky-border"><td className="p-3 font-semibold">{o.orderNumber}</td><td className="p-3">{stamp(o.createdAt)}</td><td className="p-3">{o.customer.name}</td><td className="p-3">{methodLabel(o.method)}</td><td className="p-3">{o.paymentProof && urls[o.paymentProof] ? <a href={urls[o.paymentProof]} target="_blank" rel="noopener noreferrer" title="Open full image"><img loading="lazy" src={urls[o.paymentProof]} alt={`Payment screenshot for ${o.orderNumber}`} className="h-16 w-16 rounded-lg border border-sky-border object-cover" /></a> : <span className="text-mute">{o.method === "QR_IMAGE" ? "Not uploaded" : "-"}</span>}</td><td className="p-3">{o.paymentStatus}</td><td className="p-3">{usd(o.shippingCents)}</td><td className="p-3 font-bold">{usd(o.totalCents)}</td></tr>)}</tbody></table></div>}</div>);
}
