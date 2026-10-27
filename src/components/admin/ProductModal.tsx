import { useState, type FormEvent } from "react";
import { LABELS, type Product } from "@shared/products";
import { api } from "@/lib/api";
import { compressFormData } from "@/lib/compress";
import { usePromotions } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import FilePicker from "./FilePicker";
import Icon from "./Icons";
import Modal from "./Modal";
export const LABEL_STYLE: Record<string, string> = { new_arrival: "bg-[#DD0000] text-white", restock: "bg-[#40F146] text-white", limited_edition: "bg-[#C1ADE4] text-white", preorder: "bg-[#FFE597] text-white", best_seller: "bg-[#99C3E4] text-white" };
const field = "w-full rounded-xl border border-sky-border bg-[#F3F9FE] px-3.5 py-2.5 outline-none";
const lab = "block text-sm font-bold";
const box = "space-y-3 rounded-2xl border border-sky-border bg-white p-4";
/** "Edit Product Details" window: add a new product (p undefined) or change an existing one. Saves through POST /api/admin/products/save. */
export default function ProductModal({ p, categories, onClose, onSaved, onManageCategories }: { p?: Product; categories: string[]; onClose: () => void; onSaved: () => void; onManageCategories: () => void }) {
  const { t } = useI18n(); const { promotions } = usePromotions();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [kept, setKept] = useState<string[]>(p?.images.map((i) => i.src) ?? []); const [pre, setPre] = useState(!!p?.labels?.includes("preorder")); const [sel, setSel] = useState<string[]>(p ? (p.labels ?? []) : ["new_arrival"]); // a NEW product starts as New Arrival; an existing product shows exactly the labels it has
  const cats = p?.category && !categories.includes(p.category) ? [...categories, p.category] : categories;
  async function submit(e: FormEvent<HTMLFormElement>, close: () => void) {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const r = await api("/admin/products/save", { method: "POST", body: await compressFormData(new FormData(e.currentTarget)) });
      if (r.status === 413) { setError("Images are too large. Try fewer or smaller photos."); return; }
      const j = await r.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (j.ok) { onSaved(); close(); return; }
      setError(j.error ?? "Could not save. Please try again.");
    } catch { setError("Could not reach the server. Please try again."); } finally { setBusy(false); }
  }
  return (<Modal wide icon="products" title={p ? t("Edit Product Details") : t("Add Product")} onClose={onClose}>{(close) => (
    <form onSubmit={(e) => submit(e, close)} className="p-5 sm:p-7">
      {p && <input type="hidden" name="id" value={p.id} />}
      {kept.map((src) => <input key={src} type="hidden" name="keep" value={src} />)}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]"><label className={lab}>{t("Product Code")} *<input name="sku" required minLength={2} maxLength={40} pattern="[A-Za-z0-9_#*\-]+" title="Letters, numbers and # * _ - only (no spaces)" autoCapitalize="characters" autoComplete="off" defaultValue={p?.sku} placeholder="CT-BNY-01" className={`${field} mt-1 font-mono`} /></label>
            <label className="flex items-center gap-2 pb-3 text-sm font-bold"><input type="checkbox" name="active" defaultChecked={p ? p.active !== false : true} className="h-4 w-4" />{t("Active Status")}</label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className={lab}>{t("Name (English)")} *<input name="name" required minLength={2} maxLength={120} defaultValue={p?.name} className={`${field} mt-1`} /></label>
            <label className={lab}>{t("Name (Khmer)")}<input name="nameKm" maxLength={120} lang="km" defaultValue={p?.nameKm} className={`${field} mt-1`} /></label></div>
          <label className={lab}>{t("Product Description")}<textarea name="description" rows={3} maxLength={2000} defaultValue={p?.description} placeholder="Soft hypoallergenic plushie crafted with love..." className={`${field} mt-1`} /></label>
          <div className="grid gap-4 sm:grid-cols-3"><label className={lab}>{t("Price ($)")} *<input name="price" type="number" step="0.01" min="0" required defaultValue={p?.price} className={`${field} mt-1`} /></label>
            <label className={lab}>{pre ? t("Pre-order slots") : t("Stock Qty")} *<input name="stock" type="number" step="1" min="0" required defaultValue={p?.stock ?? 0} className={`${field} mt-1`} /></label>
            <label className={lab}>{t("UOM")}<input name="uom" maxLength={20} defaultValue={p?.uom} placeholder="Pcs" className={`${field} mt-1`} /></label></div>
          {pre && <p className="rounded-xl bg-[#FFF6D8] p-3 text-xs text-ink">{t("Pre-order item: customers pay a {n}% deposit now and the rest at dispatch ({d}). Stock is the number of pre-order slots (max {c}).", { n: promotions.preorder.depositPercent, d: promotions.preorder.dispatchText, c: promotions.preorder.capSlots })}</p>}
          {pre && <div className={box}><h3 className="text-sm font-extrabold">{t("Pre-order dates for this item")}</h3>
            <div className="grid gap-3 sm:grid-cols-2"><label className={lab}>{t("Pre-Order Start Date")}<input name="preorderStart" type="date" required defaultValue={p?.preorderStart} className={`${field} mt-1`} /></label>
              <label className={lab}>{t("Pre-Order Deadline")}<input name="preorderEnd" type="date" required defaultValue={p?.preorderEnd} className={`${field} mt-1`} /></label></div>
            <p className="text-xs text-mute">{t("Each pre-order item has its own dates. Customers can order it from the start date until the end of the deadline day. They are shown in the shop and in the customer's emails.")}</p></div>}
          <div className="grid gap-4 sm:grid-cols-2"><label className={lab}>{t("Category")} *
            {cats.length ? <select name="category" required defaultValue={p?.category ?? ""} className={`${field} mt-1`}><option value="" disabled>{t("Choose a category")}</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              : <input name="category" required maxLength={40} placeholder="Plush Toys" className={`${field} mt-1`} />}
            <button type="button" onClick={onManageCategories} className="mt-1 text-xs font-semibold text-sky-hover hover:underline">{t("Manage Categories")}</button></label>
            <label className={lab}>{t("Brand")}<input name="brand" maxLength={60} defaultValue={p?.brand} placeholder="Cloudy Custom" className={`${field} mt-1`} /></label></div>
        </div>
        <div className="space-y-4">
          <section className={box}><div className="flex items-center justify-between"><h3 className="text-sm font-extrabold">{t("Product Images")}</h3><span className="text-xs text-mute">{t("Max 5 MB each (.jpg, .png, .webp)")}</span></div>
            <FilePicker name="images" multiple label={t("Click or drag image to upload")} />
            {p && p.images.length > 0 && <ul className="space-y-2">{p.images.map((i) => { const on = kept.includes(i.src); return (<li key={i.src} className={`flex items-center gap-3 rounded-xl bg-[#F3F9FE] p-2 ${on ? "" : "opacity-50"}`}>
              <img src={i.src} alt={i.alt} className="h-11 w-11 rounded-lg object-cover" /><div className="min-w-0 flex-1 text-xs"><p className="font-bold">{on ? t("Existing Product Image") : t("Will be removed")}</p>{on && <p className="font-semibold text-[#2F8F5B]">✓ {t("Uploaded & Ready")}</p>}</div>
              <button type="button" onClick={() => setKept((k) => (on ? k.filter((s) => s !== i.src) : [...k, i.src]))} aria-label={on ? t("Remove image") : t("Keep image")} className="grid h-8 w-8 place-items-center rounded-full text-mute hover:bg-white hover:text-red-600"><Icon name={on ? "trash" : "plus"} size={16} /></button></li>); })}</ul>}</section>
          <section className={box}><label className={lab}>{t("Product Option / Variants")}<input name="variants" maxLength={300} defaultValue={p?.variants} placeholder="e.g. Size: 11cm, Color: Pastel Pink" className={`${field} mt-2 bg-white`} /></label></section>
          <section className={box}><h3 className="text-sm font-extrabold">{t("Type of product / Product Labels")}</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">{LABELS.map((l) => <label key={l.id} className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="labels" value={l.id} checked={sel.includes(l.id)} onChange={(e) => { const on = e.target.checked; setSel((a) => { let n = l.id === "new_arrival" ? (on ? [...a, l.id] : a.filter((x) => x !== l.id)) : [...a.filter((x) => x === "new_arrival"), ...(on ? [l.id] : [])]; /* only ONE type at a time (Restock / Limited Edition / Pre-Order / Best Seller); New Arrival is a separate tick */ if (!p) { // NEW product only: New Arrival is automatic (ticked while no other type is chosen; choosing another type replaces it). The admin can still untick anything.
          if (on && l.id !== "new_arrival") n = n.filter((x) => x !== "new_arrival"); else if (!on && l.id !== "new_arrival" && n.length === 0) n = ["new_arrival"]; } return n; }); if (l.id !== "new_arrival") setPre(l.id === "preorder" && on); }} className="h-4 w-4" /><span className={`rounded-md px-2 py-1 ${LABEL_STYLE[l.id]}`}>{t(l.en)}</span></label>)}</div></section>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-sky-border pt-5">
        <button type="button" onClick={close} className="rounded-xl border border-sky-border bg-white px-6 py-2.5 font-bold hover:bg-sky-pale">{t("Cancel")}</button>
        <button disabled={busy} className="rounded-xl bg-sky px-6 py-2.5 font-extrabold shadow-soft hover:bg-sky-hover disabled:opacity-50">{busy ? t("Saving…") : t("Save Product")}</button></div>
    </form>)}</Modal>);
}
