import { Link } from "react-router-dom";
import { type Product, FALLBACK_IMG, badgeLabels, LABEL_CLASS, LABEL_SHORT, money, isPreorder, nameFor } from "@shared/products";
import { useCart } from "./CartProvider";
import { useI18n } from "@/lib/i18n";
export default function ProductCard({p}:{p:Product}) {
  const { add } = useCart(); const { t, lang } = useI18n();
  const img = p.images[0];
  const out = p.stock<=0; const pre = isPreorder(p); const name = nameFor(p, lang);
  // badges: "Out of stock" when sold out, then (only when it is in stock) one badge for every label the admin ticked (New / Restock / Limited Edition / Pre-Order)
  const tags: { text: string; cls: string }[] = [];
  if (out) tags.push({ text: t("Out of stock"), cls: "bg-slate-700 text-white" });
  if (!out) for (const l of badgeLabels(p)) tags.push({ text: lang === "km" ? LABEL_SHORT[l.id].km : LABEL_SHORT[l.id].en, cls: LABEL_CLASS[l.id] });
  return (
    <article className="group transition-transform duration-200 hover:-translate-y-1.5 overflow-hidden rounded-xl2 border border-sky-border bg-white shadow-soft hover:shadow-lift">
      <Link to={`/product/${p.slug}`} className="relative block overflow-hidden bg-sky-pale">
        {tags.length > 0 && <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1">{tags.map((g) => <span key={g.text} className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide shadow-soft ${g.cls}`}>{g.text}</span>)}</div>}
        <img src={img?.src??FALLBACK_IMG} alt={img?.alt??name} loading="lazy" decoding="async" width={400} height={300} className={`aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105 ${out ? "opacity-60 grayscale" : ""}`}/>
      </Link>
      <div className="space-y-1.5 p-3 sm:space-y-2 sm:p-4">
        <Link to={`/product/${p.slug}`} className="block break-words font-bold leading-snug hover:underline">{name}</Link>
        <p className="text-mute text-sm">{p.category}</p>
        <p className="font-extrabold">{p.salePrice?<><span>{money(p.salePrice)}</span> <s className="text-mute font-normal">{money(p.price)}</s></>:money(p.price)}</p>
        <button type="button" disabled={out} onClick={()=>add(p.id)} className="min-h-11 w-full rounded-full bg-sky font-bold hover:bg-sky-hover disabled:cursor-not-allowed disabled:opacity-50">{out?t("Out of stock"):pre?t("Pre-order now"):t("Add to cart")}</button>
      </div>
    </article>
  );
}
