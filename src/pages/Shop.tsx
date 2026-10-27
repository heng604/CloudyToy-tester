import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import Skeleton from "@/components/Skeleton";
import { useListedProducts } from "@/lib/store";
import { LABELS, categoriesOf } from "@shared/products";
import { useTitle } from "@/lib/title";
import { useI18n } from "@/lib/i18n";
/** The "All" button. Click it to open the categories (Doll, Perfume, ...): they are hidden inside this button. */
function CategoryMenu({ cats, category, active, chip, on, allLabel }: { cats: string[]; category: string | null; active: boolean; chip: string; on: string; allLabel: string }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }, key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const items = [{ label: allLabel, to: "/shop", sel: !category }, ...cats.map((c) => ({ label: c, to: `/shop?category=${encodeURIComponent(c)}`, sel: category === c }))];
  return (<div ref={ref} className="relative"><button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${chip} inline-flex items-center gap-2 ${active ? on : ""}`}>{category ?? allLabel}
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={open ? "rotate-180" : ""}><path d="m6 9 6 6 6-6" /></svg></button>
    {open && <ul role="menu" className="absolute left-0 z-20 mt-2 min-w-44 overflow-hidden rounded-2xl border border-sky-border bg-white p-1 shadow-lift">{items.map((i) => <li key={i.to} role="none"><Link role="menuitem" to={i.to} onClick={() => setOpen(false)} className={`block rounded-xl px-4 py-2 hover:bg-sky-pale ${i.sel ? "bg-sky-pale font-bold" : ""}`}>{i.label}</Link></li>)}</ul>}</div>);
}
export default function Shop() {
  const { t, lang } = useI18n(); useTitle(t("Product"));
  const [sp] = useSearchParams(); const { data: all } = useListedProducts();
  if (!all) return <Skeleton />;
  const q = (sp.get("q") ?? "").toLowerCase(), category = sp.get("category"), sort = sp.get("sort"), type = LABELS.find((l) => l.id === sp.get("type")), sale = sp.get("sale") === "1";
  const chip = "rounded-full border border-sky-border bg-white px-4 py-2", on = "!border-sky !bg-sky font-bold";
  let list = all.filter((p) => p.name.toLowerCase().includes(q) && (!category || p.category === category) && (!type || !!p.labels?.includes(type.id)) && (!sale || p.salePrice != null));
  if (sort === "price-asc") list = [...list].sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
  if (sort === "price-desc") list = [...list].sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
  return (<div><h1 className="mb-4 text-2xl font-extrabold sm:text-3xl">{t("Product")}</h1>
    <nav className="mb-6 flex flex-wrap gap-2 text-sm sm:text-base" aria-label="Categories"><CategoryMenu cats={categoriesOf(all)} category={category} active={!type} chip={chip} on={on} allLabel={t("All")} />
      {LABELS.map((l) => <Link key={l.id} to={`/shop?type=${l.id}`} aria-current={type?.id === l.id ? "page" : undefined} className={`${chip} ${type?.id === l.id ? on : ""}`}>{lang === "km" ? l.km : l.en}</Link>)}
      <Link to="?sort=price-asc" className="ml-auto text-sm text-mute">{t("Price ↑")}</Link><Link to="?sort=price-desc" className="text-sm text-mute">{t("Price ↓")}</Link></nav>
    {list.length === 0 ? <p className="rounded-xl2 bg-sky-pale p-8 text-center">{t("No products match.")} <Link to="/shop" className="underline">{t("Clear filters")}</Link></p>
      : <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>}</div>);
}
