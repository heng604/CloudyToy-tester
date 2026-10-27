import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LABELS, stockStatus, isListed, isPreorder, isPreorderClosed, type Product } from "@shared/products";
import ExportButtons from "@/components/admin/ExportButtons";
import CategoriesModal from "@/components/admin/CategoriesModal";
import ProductModal, { LABEL_STYLE } from "@/components/admin/ProductModal";
import Icon from "@/components/admin/Icons";
import Skeleton from "@/components/Skeleton";
import { api, post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTitle } from "@/lib/title";
import { useAdmin, refreshAdmin, Msg } from "./hooks";
const stockCls = { OUT: "text-red-600", LOW: "text-amber-600", OK: "text-[#2F8F5B]" } as const;
export default function AdminProducts() {
  const { t, lang } = useI18n(); useTitle(t("Products & Inventory"), true);
  const [sp, setSp] = useSearchParams(); const { data } = useAdmin<{ products: Product[] }>("/admin/products"); const { data: cats } = useAdmin<{ categories: { name: string }[] }>("/admin/categories");
  const [q, setQ] = useState(""); const [show, setShow] = useState("all"); const [manage, setManage] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!data) return <Skeleton />;
  const editId = sp.get("edit"), adding = sp.get("new") === "1", editing = editId ? data.products.find((p) => p.id === editId) : undefined;
  const closeModal = () => setSp((p) => { const n = new URLSearchParams(p); n.delete("edit"); n.delete("new"); return n; }, { replace: true });
  const open = (k: "edit" | "new", v: string) => setSp((p) => { const n = new URLSearchParams(p); n.delete("edit"); n.delete("new"); n.set(k, v); return n; });
  const needle = q.trim().toLowerCase();
  const list = data.products.filter((p) => `${p.name} ${p.nameKm ?? ""} ${p.sku} ${p.category} ${p.brand ?? ""}`.toLowerCase().includes(needle) && (show === "all" || (show === "low" && stockStatus(p.stock) !== "OK") || (show === "hidden" && p.active === false)));
  const del = async (p: Product) => {
    if (!confirm(`Delete "${p.name}" permanently? Past orders keep their own copy of the item.`)) return;
    const r = await api(`/admin/products/${p.id}`, { method: "DELETE" }); refreshAdmin();
    setMsg(r.ok ? { ok: true, text: t("Product deleted") } : { ok: false, text: "Could not delete the product. Please try again." });
  };
  const dropLabel = async (p: Product, id: string, name: string) => {
    if (!confirm(`Remove the "${name}" label from "${p.name}"? It disappears from the shop card until you tick it again.`)) return;
    try { const j = await (await post(`/admin/products/${p.id}/labels`, { labels: (p.labels ?? []).filter((x) => x !== id) })).json().catch(() => ({})) as { ok?: boolean; error?: string }; refreshAdmin(); setMsg(j.ok ? { ok: true, text: t("Label removed") } : { ok: false, text: j.error ?? "Could not remove the label." }); }
    catch { setMsg({ ok: false, text: "Could not reach the server. Please try again." }); }
  };
  const categories = (cats?.categories ?? []).map((c) => c.name);
  const th = "px-4 py-3 text-xs font-bold uppercase tracking-wide text-mute";
  return (<div className="space-y-4">
    <h1 className="text-2xl font-extrabold sm:text-3xl">{t("Products & Inventory")}</h1>
    {msg && <Msg ok={msg.ok ? msg.text : null} err={msg.ok ? null : msg.text} />}
    <div className="flex flex-wrap items-center gap-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search products…")} aria-label={t("Search products…")} className="min-w-52 flex-1 rounded-xl border border-sky-border bg-white px-4 py-2.5 shadow-soft outline-none sm:max-w-xs sm:flex-none" />
      <select value={show} onChange={(e) => setShow(e.target.value)} aria-label={t("Show")} className="rounded-xl border border-sky-border bg-white px-3 py-2.5 shadow-soft"><option value="all">{t("All")}</option><option value="low">{t("Low or out of stock")}</option><option value="hidden">{t("Hidden")}</option></select>
      <button type="button" onClick={() => setManage(true)} className="inline-flex items-center gap-2 rounded-xl border border-sky-border bg-white px-4 py-2.5 text-sm font-bold shadow-soft hover:bg-sky-pale"><Icon name="folder" size={18} />{t("Manage Categories")}</button>
      <div className="ml-auto flex flex-wrap items-center gap-2"><ExportButtons type="products" />
        <button type="button" onClick={() => open("new", "1")} className="inline-flex items-center gap-2 rounded-xl bg-sky px-5 py-2.5 font-extrabold shadow-soft hover:bg-sky-hover"><Icon name="plus" size={18} />{t("Add Product")}</button></div></div>
    <div className="overflow-x-auto rounded-3xl bg-white shadow-soft"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-sky-border">{["Product", "Code", "Category", "Price", "Stock", "Badges", ""].map((h, i) => <th key={i} className={`${th} ${i === 6 ? "text-right" : ""}`}>{h && t(h)}</th>)}</tr></thead>
      <tbody>{list.map((p) => { const st = stockStatus(p.stock), pre = isPreorder(p); return (<tr key={p.id} className="border-b border-sky-border/70 last:border-0">
        <td className="px-4 py-3"><div className="flex items-center gap-3">{p.images[0] ? <img loading="lazy" src={p.images[0].src} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-pale text-sky-hover"><Icon name="products" size={20} /></span>}
          <div className="min-w-0"><p className="truncate font-extrabold">{p.name}</p>{p.nameKm && <p lang="km" className="truncate text-xs text-mute">{p.nameKm}</p>}</div></div></td>
        <td className="px-4 py-3 font-mono text-xs">{p.sku}</td><td className="px-4 py-3">{p.category}</td>
        <td className="px-4 py-3 font-extrabold">{p.salePrice != null ? <>${p.salePrice.toFixed(2)} <s className="font-normal text-mute">${p.price.toFixed(2)}</s></> : `$${p.price.toFixed(2)}`}</td>
        <td className={`px-4 py-3 font-bold ${stockCls[st]}`}>{st === "OUT" ? t("Out of stock") : pre ? t("{n} slots left", { n: p.stock }) : t("{n} in stock", { n: p.stock })}</td>
        <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{LABELS.filter((l) => p.labels?.includes(l.id)).map((l) => <span key={l.id} className={`inline-flex items-center gap-1 rounded-md py-0.5 pl-2 pr-1 text-xs font-bold ${LABEL_STYLE[l.id]}`}>{lang === "km" ? l.km : l.en}<button type="button" onClick={() => dropLabel(p, l.id, l.en)} aria-label={`Remove ${l.en} label from ${p.name}`} title={t("Remove label")} className="grid h-4 w-4 place-items-center rounded hover:bg-black/10"><Icon name="close" size={11} /></button></span>)}
          {p.active === false && <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold">{t("Hidden")}</span>}{p.active !== false && !isListed(p) && <span title="Out of stock for 2+ days. Add stock to show it again." className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{t("Hidden from shop")}</span>}{p.active !== false && isPreorderClosed(p) && <span title="Pre-order deadline passed. Customers cannot order it and the shop no longer shows it. Change the dates to open it again." className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{t("Pre-order closed")}</span>}</div></td>
        <td className="px-4 py-3"><div className="flex items-center justify-end gap-4 text-sm font-bold"><button type="button" onClick={() => open("edit", p.id)} className="text-sky-hover hover:underline">{t("Edit")}</button><button type="button" onClick={() => del(p)} className="text-[#E0456B] hover:underline">{t("Delete")}</button></div></td></tr>); })}</tbody></table>
      {list.length === 0 && <p className="p-8 text-center text-mute">{t("No products match.")}</p>}</div>
    {(adding || editing) && <ProductModal key={editing?.id ?? "new"} p={editing} categories={categories} onClose={closeModal} onSaved={() => { refreshAdmin(); setMsg({ ok: true, text: t("Saved") }); }} onManageCategories={() => setManage(true)} />}
    {manage && <CategoriesModal onClose={() => setManage(false)} />}
  </div>);
}
