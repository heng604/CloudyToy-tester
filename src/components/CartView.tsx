import { Link } from "react-router-dom";
import { useCart } from "@/components/CartProvider";
import { FALLBACK_IMG, money, preorderPhase, windowText, dayShort } from "@shared/products";
import type { CartProduct } from "@shared/cartTypes";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { usePromotions } from "@/lib/store";
import { autoDiscounts, autoTotal } from "@shared/promotions";

const iconBtn = "grid h-10 w-10 place-items-center rounded-full text-lg font-bold text-ink transition hover:bg-sky disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

function CloudArt() {
  return (
    <svg viewBox="0 0 200 120" className="mx-auto h-28 w-auto" aria-hidden="true">
      <path d="M52 92a28 28 0 0 1 8-55 38 38 0 0 1 74-6 31 31 0 0 1 40 61z" fill="#8ECCFF" />
      <path d="M70 92a20 20 0 0 1 6-39 27 27 0 0 1 52-4 22 22 0 0 1 28 43z" fill="#EAF5FF" />
      <circle cx="92" cy="70" r="3.5" fill="#2f4156" /><circle cx="116" cy="70" r="3.5" fill="#2f4156" />
      <path d="M97 79q5 5 14 0" stroke="#2f4156" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function CartView({ products, telegram = "" }: { products: CartProduct[]; telegram?: string }) {
  const { lines, setQty, clear, ready } = useCart(); const { t } = useI18n(); const { user } = useAuth(); const { promotions } = usePromotions();
  const items = lines.map((l) => ({ l, p: products.find((p) => p.id === l.id) })).filter((x): x is { l: { id: string; qty: number }; p: CartProduct } => !!x.p);
  const unit = (p: CartProduct) => p.salePrice ?? p.price;
  const subtotal = items.reduce((s, x) => s + unit(x.p) * x.l.qty, 0);
  const saved = items.reduce((s, x) => s + (x.p.salePrice ? (x.p.price - x.p.salePrice) * x.l.qty : 0), 0);
  const count = items.reduce((s, x) => s + x.l.qty, 0);
  const autos = autoDiscounts(items.map((x) => ({ category: x.p.category ?? "", lineCents: Math.round(unit(x.p) * 100) * x.l.qty })), promotions.campaigns), autoOff = autoTotal(autos) / 100;
  const hasPre = items.some((x) => x.p.preorder);
  const closedPre = (p: CartProduct) => !!p.preorder && preorderPhase(p) !== "open"; // each pre-order item has its own dates
  const blocked = items.some((x) => (x.p.stock ?? Infinity) <= 0 || x.l.qty > (x.p.stock ?? Infinity) || closedPre(x.p));

  if (!ready) return <div className="h-64" aria-busy="true" />;

  if (!items.length) {
    return (
      <section className="mx-auto max-w-lg rounded-xl2 border border-sky-border bg-white px-6 py-12 text-center shadow-soft">
        <CloudArt />
        <h1 className="mt-4 text-2xl font-extrabold">{t("Your cart is empty")}</h1>
        <p className="mt-2 text-mute">No toys here yet. Let&apos;s find something that will make a little one smile.</p>
        <Link to="/shop" className="mt-6 inline-block rounded-full bg-sky px-8 py-3 font-bold transition hover:bg-sky-hover hover:shadow-lift">{t("Browse toys")}</Link>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{t("Your cart")}</h1>
          <p className="text-mute">{count} {count === 1 ? "toy" : "toys"} ready for a new home</p>
        </div>
        <button type="button" onClick={clear} className="rounded-full px-4 py-2 text-sm font-semibold text-mute hover:bg-sky-pale hover:text-ink">{t("Clear cart")}</button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_26rem]">
        <ul className="space-y-4">
          {items.map(({ l, p }) => {
            const stock = p.stock ?? Infinity;
            const out = stock <= 0;
            const over = !out && l.qty > stock;
            const atMax = l.qty >= stock;
            return (
              <li key={l.id} className="flex gap-4 rounded-xl2 border border-sky-border bg-white p-3 shadow-soft sm:p-4">
                <Link to={p.slug ? `/product/${p.slug}` : "/shop"} className="shrink-0 overflow-hidden rounded-xl bg-sky-pale">
                  <img src={p.image ?? FALLBACK_IMG} alt={p.name} width={112} height={112} loading="lazy" className="h-24 w-24 object-cover sm:h-28 sm:w-28" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {p.category && <p className="text-xs font-semibold uppercase tracking-wide text-mute">{p.category}</p>}
                      <Link to={p.slug ? `/product/${p.slug}` : "/shop"} className="block font-extrabold leading-snug hover:underline">{p.name}</Link>
                      <p className="mt-1 text-sm text-mute">
                        {p.salePrice ? <><span className="font-semibold text-ink">{money(p.salePrice)}</span> <s>{money(p.price)}</s></> : money(p.price)} each
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-extrabold">{money(unit(p) * l.qty)}</p>
                  </div>

                  {out && <p role="alert" className="text-sm font-semibold text-red-600">Sorry, this toy is out of stock. Please remove it.</p>}
                  {over && <p role="alert" className="text-sm font-semibold text-red-600">Only {stock} left. Please lower the quantity.</p>}
                  {p.preorder && windowText(p) && (preorderPhase(p) === "open" ? <p className="text-sm font-semibold text-[#A97A0B]">🕒 Pre-order: {windowText(p)}</p>
                    : <p role="alert" className="text-sm font-semibold text-red-600">{preorderPhase(p) === "upcoming" ? `Pre-order opens on ${dayShort(p.preorderStart!)}. Please remove it for now.` : `Pre-order closed on ${dayShort(p.preorderEnd!)}. Please remove it.`}</p>)}
                  {!out && !over && stock <= 5 && <p className="text-sm font-semibold text-amber-600">Only {stock} left</p>}

                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center rounded-full border border-sky-border bg-sky-pale p-1">
                      <button type="button" aria-label={`Decrease ${p.name}`} onClick={() => setQty(l.id, l.qty - 1)} className={iconBtn}>−</button>
                      <span aria-live="polite" className="min-w-8 text-center font-bold">{l.qty}</span>
                      <button type="button" aria-label={`Increase ${p.name}`} disabled={atMax} onClick={() => setQty(l.id, l.qty + 1)} className={iconBtn}>+</button>
                    </div>
                    <button type="button" onClick={() => setQty(l.id, 0)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-mute hover:bg-sky-pale hover:text-ink">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>
                      {t("Remove")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside aria-label="Order summary" className="space-y-4 rounded-xl2 border border-sky-border bg-white p-5 shadow-soft lg:sticky lg:top-24">
          <h2 className="text-xl font-extrabold">{t("Order summary")}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-mute">Items ({count})</dt><dd className="font-semibold">{money(subtotal)}</dd></div>
            {saved > 0 && <div className="flex justify-between text-green-700"><dt>{t("You save")}</dt><dd className="font-semibold">−{money(saved)}</dd></div>}
            {autos.map((a) => <div key={a.id} className="flex justify-between text-green-700"><dt>{a.name}</dt><dd className="font-semibold">−{money(a.cents / 100)}</dd></div>)}
            <div className="flex justify-between"><dt className="text-mute">{t("Delivery")}</dt><dd className="font-semibold">{t("Calculated at checkout")}</dd></div>
          </dl>
          <div className="flex items-baseline justify-between border-t border-sky-border pt-4">
            <span className="font-bold">{t("Subtotal")}</span>
            <span className="text-2xl font-extrabold">{money(subtotal - autoOff)}</span>
          </div>
          {hasPre && <p className="rounded-xl bg-[#FFF6D8] p-3 text-xs">Your cart has a <b>pre-order</b> item: you pay a {promotions.preorder.depositPercent}% deposit at checkout (or the full price if you prefer) and any rest when it is dispatched ({promotions.preorder.dispatchText}).</p>}
          <p className="text-xs text-mute">Display only. Delivery and your discount code (10% to 50% off the subtotal) are applied at checkout.</p>

          {blocked
            ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Please fix the items marked above before checking out.</p>
            : <Link to="/checkout" className="block rounded-full bg-sky px-6 py-3 text-center text-lg font-extrabold transition hover:bg-sky-hover hover:shadow-lift">{user ? t("Checkout") : "Sign in to checkout"}</Link>}
          <Link to="/shop" className="block text-center text-sm font-semibold text-mute hover:text-ink hover:underline">{t("← Continue shopping")}</Link>

          {telegram && (
            <a href={telegram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-sky-pale px-4 py-3 text-sm font-semibold hover:bg-sky">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
              Questions? Chat with our admin
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
