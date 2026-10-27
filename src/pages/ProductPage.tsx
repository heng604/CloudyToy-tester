import { Link, useParams } from "react-router-dom";
import ProductGallery from "@/components/ProductGallery";
import ProductCard from "@/components/ProductCard";
import Skeleton from "@/components/Skeleton";
import NotFound from "@/components/NotFound";
import { badgeLabels, LABEL_CLASS, LABEL_SHORT, money, isPreorder, nameFor, stockStatus, preorderPhase, windowText, dayShort } from "@shared/products";
import { useI18n } from "@/lib/i18n";
import { useListedProducts, usePromotions } from "@/lib/store";
import { useTitle } from "@/lib/title";
import AddButton from "./AddButton";
export default function ProductPage() {
  const { slug } = useParams(); const { data: all } = useListedProducts(); const { lang } = useI18n(); const { promotions } = usePromotions();
  const p = all?.find((x) => x.slug === slug);
  useTitle(all ? (p ? nameFor(p, lang) : "Not found") : undefined);
  if (!all) return <Skeleton />;
  if (!p) return <NotFound />;
  const others = all.filter((x) => x.id !== p.id);
  const more = [...others.filter((x) => x.category === p.category), ...others.filter((x) => x.category !== p.category)].slice(0, 8);
  const st = stockStatus(p.stock), pre = isPreorder(p), name = nameFor(p, lang);
  return (<div className="space-y-12">
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-mute"><Link to="/shop" className="hover:underline">Shop</Link>{p.category && <> <span aria-hidden="true">/</span> <Link to={`/shop?category=${encodeURIComponent(p.category)}`} className="hover:underline">{p.category}</Link></>}</nav>
      <div className="grid items-start gap-8 md:grid-cols-2 lg:gap-12">
        <ProductGallery key={p.id} images={p.images} name={name} />
        <div className="space-y-4 md:sticky md:top-24">
          <div className="flex flex-wrap gap-2">{badgeLabels(p).filter(() => st !== "OUT").map((l) => <span key={l.id} className={`rounded-full px-3 py-1 text-sm font-extrabold uppercase tracking-wide ${LABEL_CLASS[l.id]}`}>{lang === "km" ? LABEL_SHORT[l.id].km : LABEL_SHORT[l.id].en}</span>)}{p.category && <span className="rounded-full bg-sky-pale px-3 py-1 text-sm font-semibold">{p.category}</span>}</div>
          <h1 className="text-3xl font-extrabold leading-tight md:text-4xl">{name}</h1>
          {lang === "km" && p.nameKm && <p className="-mt-2 text-sm text-mute">{p.name}</p>}
          <p className="text-2xl font-extrabold sm:text-3xl">{money(p.price)}{p.uom && <span className="ml-1 text-base font-semibold text-mute">/ {p.uom}</span>}</p>
          <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${st === "OUT" ? "bg-red-100 text-red-800" : st === "LOW" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}><span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />{st === "OUT" ? "Out of stock" : st === "LOW" ? `Only ${p.stock} left` : pre ? `${p.stock} pre-order slots left` : `${p.stock} in stock`}</p>
          {pre && <p className="rounded-xl2 bg-[#FFF6D8] p-3 text-sm"><b>Pre-order:</b> pay a {promotions.preorder.depositPercent}% deposit when you order, the rest when it is dispatched. Estimated dispatch: {promotions.preorder.dispatchText}.{windowText(p) && <> <b>Pre-order dates:</b> {windowText(p)}.</>}</p>}
          {pre && preorderPhase(p) === "upcoming" && <p role="alert" className="rounded-xl2 bg-sky-pale p-3 text-sm font-bold">This pre-order opens on {dayShort(p.preorderStart!)}.</p>}
          {pre && preorderPhase(p) === "closed" && <p role="alert" className="rounded-xl2 bg-red-100 p-3 text-sm font-bold text-red-800">This pre-order closed on {dayShort(p.preorderEnd!)}.</p>}
          {p.variants && <p className="text-sm"><b>Options:</b> {p.variants}</p>}
          {p.description && <p className="whitespace-pre-line leading-relaxed text-ink/90">{p.description}</p>}
          <AddButton key={p.id} id={p.id} disabled={p.stock <= 0 || (pre && preorderPhase(p) !== "open")} />
          <p className="text-sm text-mute">SKU {p.sku}{p.brand ? ` · ${p.brand}` : ""} · Delivery across Cambodia</p>
        </div></div></div>
    {more.length > 0 && <section aria-labelledby="more-h"><div className="mb-4 flex items-end justify-between gap-3"><h2 id="more-h" className="text-2xl font-extrabold">More toys you may like</h2><Link to="/shop" className="font-semibold underline">See all</Link></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{more.map((x) => <ProductCard key={x.id} p={x} />)}</div></section>}
  </div>);
}
