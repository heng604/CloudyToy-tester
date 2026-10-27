import { useState } from "react";
import { Link } from "react-router-dom";
import { stockStatus, LOW_STOCK, type Product } from "@shared/products";
import { summarize, dailyRevenue, topProducts, sortOrders, dayKey, usd, stamp } from "@shared/stats";
import type { StoredOrder } from "@shared/types";
import ExportButtons from "@/components/admin/ExportButtons";
import { SmoothLine, Bars, Calendar, Ring, C } from "@/components/admin/charts";
import Icon from "@/components/admin/Icons";
import Skeleton from "@/components/Skeleton";
import { useTitle } from "@/lib/title";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useAdmin, displayName } from "./hooks";
const card = "rounded-3xl bg-white p-4 shadow-soft sm:p-5";
const Title = ({ children, to, more }: { children: React.ReactNode; to?: string; more?: string }) => <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-extrabold">{children}</h2>{to && <Link to={to} className="text-sm font-semibold text-sky-hover hover:underline">{more}</Link>}</div>;
export default function Dashboard() {
  const { t, locale } = useI18n(); useTitle(t("Dashboard"), true);
  const { user } = useAuth(); const [range, setRange] = useState<7 | 14>(7);
  const { data } = useAdmin<{ orders: StoredOrder[]; products: Product[] }>("/admin/dashboard");
  if (!data) return <Skeleton />;
  const { orders, products } = data;
  const s = summarize(orders), days = dailyRevenue(orders), lowest = sortOrders(orders, "low").slice(0, 5), highest = sortOrders(orders, "high").slice(0, 5);
  const out = products.filter((p) => stockStatus(p.stock) === "OUT"), low = products.filter((p) => stockStatus(p.stock) === "LOW");
  const top = topProducts(orders), stockValue = products.reduce((a, p) => a + (p.salePrice ?? p.price) * p.stock, 0);
  const today = days[days.length - 1].day, marks: Record<string, number> = {}; for (const o of orders) { const k = dayKey(o.createdAt); marks[k] = (marks[k] ?? 0) + 1; }
  const last7 = days.slice(-7), dlabel = (d: string) => d.slice(8);
  const paidBy = (d: string, st: string) => orders.filter((o) => dayKey(o.createdAt) === d && o.paymentStatus === st).length;
  const healthy = products.length - out.length - low.length, healthyShare = products.length ? (healthy / products.length) * 100 : 0;
  const seg = (n: number) => (products.length ? (n / products.length) * 100 : 0);
  const DAY = 86400000, nowMs = Date.now(), inWin = (o: StoredOrder, from: number, to: number) => { const a = nowMs - to * DAY, b = nowMs - from * DAY, c = Date.parse(o.createdAt); return c > a && c <= b; };
  const win = (from: number, to: number) => orders.filter((o) => inWin(o, from, to));
  const sold = (l: StoredOrder[]) => l.reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty, 0), 0);
  const paidSum = (l: StoredOrder[]) => l.filter((o) => o.paymentStatus === "PAID").reduce((a, o) => a + o.totalCents, 0);
  const custKey = (o: StoredOrder) => (o.customer.email || o.customer.phone || o.orderNumber).toLowerCase();
  const firstSeen = new Map<string, number>(); for (const o of [...orders].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) { const k = custKey(o); if (!firstSeen.has(k)) firstSeen.set(k, Date.parse(o.createdAt)); }
  const newCust = (from: number, to: number) => [...firstSeen.values()].filter((c) => c > nowMs - to * DAY && c <= nowMs - from * DAY).length;
  const cur = win(0, 7), prev = win(7, 14);
  const delta = (a: number, b: number): number | null => (b === 0 ? (a === 0 ? 0 : null) : ((a - b) / b) * 100);
  const cards = [
    { label: t("Total Orders"), value: String(orders.length), d: delta(cur.length, prev.length), tint: "#FFE3EC", fg: "#E0658C", icon: "orders" as const },
    { label: t("Total Revenue"), value: usd(s.paidCents), d: delta(paidSum(cur), paidSum(prev)), tint: "#FFF1C9", fg: "#D9A21B", icon: "transactions" as const },
    { label: t("New Customers"), value: String(firstSeen.size), d: delta(newCust(0, 7), newCust(7, 14)), tint: "#DCEEFF", fg: "#4F9FE0", icon: "home" as const },
    { label: t("Products Sold"), value: String(sold(orders)), d: delta(sold(cur), sold(prev)), tint: "#E7DEFF", fg: "#8B73DB", icon: "products" as const },
  ];
  const view = days.slice(-range);
  const catOf = new Map(products.map((p) => [p.sku, p.category || t("Other")]));
  const byCat = new Map<string, number>(); for (const o of orders) for (const i of o.items) { const k = catOf.get(i.sku) ?? t("Other"); byCat.set(k, (byCat.get(k) ?? 0) + i.lineCents); }
  const catList = [...byCat.entries()].sort((a, b) => b[1] - a[1]), catTotal = catList.reduce((a, [, v]) => a + v, 0);
  const catColors = [C.indigo, C.orange, C.yellow, C.teal, C.violet];
  const catParts = catList.slice(0, 4).map(([name, value], i) => ({ name, value, color: catColors[i] })); const rest = catList.slice(4).reduce((a, [, v]) => a + v, 0); if (rest > 0) catParts.push({ name: t("Other"), value: rest, color: catColors[4] });
  const recent = sortOrders(orders, "new").slice(0, 5), needStock = out.length + low.length;
  const pill = (st: string) => (st === "PAID" ? "bg-[#DDF6E8] text-[#2F8F5B]" : "bg-[#FFF1C9] text-[#A97A0B]");
  const name = displayName(user);
  const big = "text-2xl font-extrabold leading-tight sm:text-3xl";
  const Row = ({ o }: { o: StoredOrder }) => <li className="flex justify-between gap-3 border-b border-sky-border py-2 text-sm last:border-0"><span className="min-w-0"><span className="block truncate font-semibold">{o.orderNumber}</span><span className="block truncate text-xs text-mute">{o.customer.name} · {stamp(o.createdAt)} · {t(o.paymentStatus)}</span></span><b className="shrink-0">{usd(o.totalCents)}</b></li>;
  return (<div className="space-y-4">
    <section className="overflow-hidden rounded-3xl shadow-soft" aria-label={t("Dashboard")}>
      <h1 className="sr-only">{t("Welcome back, {name}!", { name })}</h1>
      <img src="/img/dashboard-banner.jpg" alt="" width={2576} height={361} className="block h-auto w-full min-h-[5.5rem] object-cover object-left" /></section>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
      {cards.map((c) => <section key={c.label} className={`${card} flex items-center gap-3 !p-4`}><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: c.tint, color: c.fg }}><Icon name={c.icon} size={22} /></span>
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-mute">{c.label}</p><p className="truncate text-xl font-extrabold leading-tight sm:text-2xl">{c.value}</p>
          <p className="truncate text-xs text-mute"><b className={c.d === null || c.d >= 0 ? "text-[#2F8F5B]" : "text-[#D6455D]"}>{c.d === null ? t("New") : `${c.d >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(c.d))}%`}</b> {t("vs last 7 days")}</p></div></section>)}</div>
    <div className="grid gap-4 xl:grid-cols-12">
      <section className={`${card} xl:col-span-7`}><div className="mb-2 flex items-center justify-between gap-2"><h2 className="font-extrabold">{t("Sales Overview")}</h2>
        <select value={range} onChange={(e) => setRange(Number(e.target.value) as 7 | 14)} aria-label={t("Sales Overview")} className="rounded-full border border-sky-border bg-white px-3 py-1 text-sm"><option value={7}>{t("Last 7 days")}</option><option value={14}>{t("Last 14 days")}</option></select></div>
        <div className="flex flex-col items-center gap-4 sm:flex-row"><div className="min-w-0 flex-1 self-stretch"><SmoothLine ariaLabel={t("Revenue")} series={[{ values: view.map((d) => d.cents), color: C.indigo }]} labels={view.map((d) => dlabel(d.day))} width={420} height={190} dots="max" fill /></div>
          <div className="flex shrink-0 flex-col items-center gap-3"><Ring ariaLabel={t("Sales by category")} size={130} parts={catParts} center={<div><p className="text-lg font-extrabold leading-none">{usd(catTotal)}</p><p className="mt-1 text-[11px] text-mute">{t("Total Sales")}</p></div>} />
            <ul className="space-y-1 text-xs">{catParts.map((p) => <li key={p.name} className="flex items-center justify-between gap-4"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} /><span className="max-w-[7rem] truncate">{p.name}</span></span><b>{catTotal ? Math.round((p.value / catTotal) * 100) : 0}%</b></li>)}{!catParts.length && <li className="text-mute">{t("No sales yet.")}</li>}</ul></div></div></section>
      <section className={`${card} xl:col-span-5`}><Title to="/admin/orders" more={t("View all")}>{t("Recent Orders")}</Title>
        {recent.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-mute"><tr><th className="pb-2 font-semibold">{t("Order #")}</th><th className="pb-2 font-semibold">{t("Customer")}</th><th className="pb-2 text-right font-semibold">{t("Total")}</th><th className="pb-2 pl-3 font-semibold">{t("Status")}</th></tr></thead>
          <tbody>{recent.map((o) => <tr key={o.orderNumber} className="border-t border-sky-border"><td className="py-2 pr-2 font-semibold"><Link to={`/admin/orders?q=${encodeURIComponent(o.orderNumber)}`} className="hover:underline">{o.orderNumber}</Link></td><td className="max-w-[8rem] truncate py-2 pr-2">{o.customer.name}</td><td className="py-2 text-right font-bold">{usd(o.totalCents)}</td><td className="py-2 pl-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pill(o.paymentStatus)}`}>{t(o.paymentStatus)}</span></td></tr>)}</tbody></table></div> : <p className="text-mute">{t("No orders yet.")}</p>}</section></div>
    <div className="grid gap-4 md:grid-cols-2">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-[#FFF6D8] p-4 shadow-soft sm:p-5"><div className="min-w-0"><h2 className="font-extrabold">{t("Promo codes")}</h2><p className="text-sm text-mute">{t("Create and manage discount codes for your customers.")}</p></div><Link to="/admin/promotions" className="shrink-0 rounded-full bg-white px-5 py-2 text-sm font-extrabold shadow-soft hover:bg-sky-pale">{t("Manage Promotions")}</Link></section>
      <section className={`${card} flex items-center gap-3`}><span className={`h-3 w-3 shrink-0 rounded-full ${needStock ? "bg-[#F5A25D]" : "bg-[#3CC28A]"}`} aria-hidden="true" /><div className="min-w-0"><h2 className="font-extrabold">{t("Stock status")}</h2><p className="text-sm text-mute">{needStock ? t("{n} products need restocking.", { n: needStock }) : t("All products have healthy stock.")}</p></div>{needStock > 0 && <Link to="/admin/stock" className="ml-auto shrink-0 text-sm font-semibold text-sky-hover hover:underline">{t("Manage stock")}</Link>}</section></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
      <section className={`${card} xl:col-span-4`} aria-label={t("Paid revenue")}><p className="text-sm font-semibold text-mute">{t("Paid revenue")}</p><p className={big}>{usd(s.paidCents)}</p><p className="mb-2 text-xs text-mute">{t("{n} paid orders", { n: s.paidCount })}</p>
        <SmoothLine ariaLabel={t("Paid revenue, last 14 days")} series={[{ values: days.map((d) => d.cents), color: C.indigo }]} labels={days.map((d) => dlabel(d.day))} height={110} /></section>
      <section className={`${card} grid grid-cols-2 content-start gap-4 xl:col-span-4`}>
        <div><p className="text-sm font-semibold text-mute">{t("All orders")}</p><p className={big}>{s.count}</p><p className="text-xs text-mute">{t("Average {v}", { v: usd(s.avgCents) })}</p></div>
        <div className="border-l border-sky-border pl-4"><p className="text-sm font-semibold text-mute">{t("Pay with delivery")}</p><p className={big}>{usd(orders.filter((o) => o.paymentStatus === "PENDING" && o.method === "COD").reduce((n, o) => n + o.totalCents, 0))}</p><p className="text-xs text-mute">{t("{n} pending orders", { n: orders.filter((o) => o.paymentStatus === "PENDING" && o.method === "COD").length })}</p></div>
        <div className="col-span-2 border-t border-sky-border pt-3"><p className="text-sm font-semibold text-mute">{t("Stock value")}</p><p className={big}>${stockValue.toFixed(2)}</p><p className="text-xs text-mute">{t("{n} products", { n: products.length })}</p></div>
        <div className="col-span-2"><SmoothLine ariaLabel={t("Orders per day")} series={[{ values: days.map((d) => d.orders), color: C.teal }]} height={60} dots="none" fill /></div></section>
      <section className={`${card} md:col-span-2 xl:col-span-4`} aria-label={t("Calendar")}><Title>{t("Calendar")}</Title><Calendar marks={marks} locale={locale} today={today} daysLabel={(n) => `${n} ${t("orders")}`} /><p className="mt-2 text-xs text-mute">{t("Days with orders are marked.")}</p></section></div>
    <div className="flex justify-end"><ExportButtons type="orders" /></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section className={card}><Title to="/admin/stock" more={t("Manage stock")}>{t("Stock alerts")}</Title>
        {out.length + low.length === 0 ? <p className="text-mute">{t("All products have healthy stock.")}</p> : <ul className="space-y-3">{[...out, ...low].slice(0, 6).map((p) => <li key={p.id} className="text-sm"><div className="flex justify-between gap-2"><Link to={`/admin/products/${p.id}`} className="min-w-0 truncate font-semibold hover:underline">{p.name}</Link><b className={p.stock <= 0 ? "text-red-600" : "text-amber-600"}>{p.stock <= 0 ? t("Out of stock") : t("{n} left", { n: p.stock })}</b></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#E6F2FC]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.stock / (LOW_STOCK + 1)) * 100)}%`, background: p.stock <= 0 ? "#EF4444" : C.yellow }} /></div></li>)}</ul>}
        <div className="mt-4"><p className="mb-1 text-xs font-semibold text-mute">{t("Healthy stock")} · {t("{a} of {b} products", { a: healthy, b: products.length })}</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-[#E6F2FC]" role="img" aria-label={t("In stock")}><i style={{ width: `${seg(healthy)}%`, background: C.indigo }} /><i style={{ width: `${seg(low.length)}%`, background: C.teal }} /><i style={{ width: `${seg(out.length)}%`, background: C.yellow }} /></div></div></section>
      <section className={card}><Title>{t("Orders per day")}</Title><div className="mb-2 flex gap-4 text-xs"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: C.indigo }} />{t("paid")}</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: C.yellow }} />{t("pending")}</span></div>
        <Bars ariaLabel={t("Orders per day")} groups={last7.map((d) => [paidBy(d.day, "PAID"), paidBy(d.day, "PENDING")])} labels={last7.map((d) => dlabel(d.day))} colors={[C.indigo, C.yellow]} /></section>
      <section className={`${card} md:col-span-2 xl:col-span-1`}><Title>{t("Best sellers")}</Title>{top.length ? <ul>{top.map((x) => <li key={x.sku} className="flex justify-between gap-3 border-b border-sky-border py-2 text-sm last:border-0"><span className="min-w-0 truncate">{x.name}</span><span className="shrink-0 text-mute">{t("{n} sold", { n: x.qty })} · {usd(x.cents)}</span></li>)}</ul> : <p className="text-mute">{t("No sales yet.")}</p>}</section>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <section className={card}><Title to="/admin/transactions?sort=high" more={t("See all")}>{t("Highest transactions")}</Title>{highest.length ? <ul>{highest.map((o) => <Row key={o.orderNumber} o={o} />)}</ul> : <p className="text-mute">{t("No orders yet.")}</p>}</section>
      <section className={card}><Title to="/admin/transactions?sort=low" more={t("See all")}>{t("Lowest transactions")}</Title>{lowest.length ? <ul>{lowest.map((o) => <Row key={o.orderNumber} o={o} />)}</ul> : <p className="text-mute">{t("No orders yet.")}</p>}</section></div>
    <section className={card}><Title>{t("Export all data")}</Title><div className="grid gap-3 sm:grid-cols-2">
      {(["orders", "transactions", "delivery", "products", "stock"] as const).map((k) => <div key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sky-pale p-3"><span className="font-semibold capitalize">{t(k === "orders" ? "Orders" : k === "transactions" ? "Sales Transaction Report" : k === "delivery" ? "Delivery Report" : k === "products" ? "Products" : "Stock")}</span><ExportButtons type={k} /></div>)}</div>
      <p className="mt-2 text-xs text-mute">PDF shows Latin letters only (Khmer prints as ?). Use CSV when you need Khmer names.</p></section></div>);
}
