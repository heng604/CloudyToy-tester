import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useCart } from "./CartProvider";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { useListedProducts } from "@/lib/store";
import { categoriesOf } from "@shared/products";
const NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/shop", label: "Product", match: (p: string) => p.startsWith("/shop") || p.startsWith("/product") },
  { href: "/account", label: "Account", match: (p: string) => p.startsWith("/account") || p.startsWith("/login") },
];
const CART_MATCH = (p: string) => p.startsWith("/cart");
const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const CartIcon = () => <Svg><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6" /></Svg>;
const UserIcon = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
/** The four coloured pill buttons (same style as the design): New Arrival, Pre-Order, Category, Special Offer. */
const PILLS: { id: "new" | "pre" | "cat" | "sale"; label: string; to: string; bg: string; fg: string; icon: ReactNode }[] = [
  { id: "new", label: "New Arrival", to: "/shop?type=new_arrival", bg: "#D6ECFF", fg: "#2F7FC6", icon: <Svg size={20}><path d="M12 3l2.2 5.3L20 9l-4.2 3.9L17 19l-5-2.9L7 19l1.2-6.1L4 9l5.8-.7z" /></Svg> },
  { id: "pre", label: "Pre-Order", to: "/shop?type=preorder", bg: "#FFEFC2", fg: "#B98A0B", icon: <Svg size={20}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg> },
  { id: "cat", label: "Category", to: "/shop", bg: "#FFD9E6", fg: "#D9467A", icon: <Svg size={20}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></Svg> },
  { id: "sale", label: "Special Offer", to: "/shop?sale=1", bg: "#E6DCFB", fg: "#7A4FD0", icon: <Svg size={20}><path d="M3 12.5V4h8.5l9 9a1.8 1.8 0 0 1 0 2.5l-5.5 5.5a1.8 1.8 0 0 1-2.5 0z" /><circle cx="7.5" cy="8.5" r="1.3" /></Svg> },
];
const pillCls = "relative inline-flex h-11 shrink-0 items-center gap-2 rounded-full py-1 pl-1.5 pr-4 text-[13px] font-extrabold text-ink shadow-soft transition duration-200 hover:-translate-y-0.5 active:scale-95 xl:text-sm";
function Pill({ p, active, children }: { p: (typeof PILLS)[number]; active: boolean; children?: ReactNode }) {
  return (<><span className="grid h-8 w-8 place-items-center rounded-full bg-white/85" style={{ color: p.fg }}>{p.icon}</span>{children}{active && <span aria-hidden="true" className="absolute inset-0 rounded-full ring-2 ring-[#1F4E9C]/40" />}</>);
}
/** "Category" pill on a computer: opens the list of categories. */
function CategoryPill({ active, cats, label }: { active: boolean; cats: string[]; label: string }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null); const p = PILLS[2]; const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }, key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (<div ref={ref} className="relative"><button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={pillCls} style={{ background: p.bg }}><Pill p={p} active={active}>{label}</Pill></button>
    {open && <ul role="menu" className="absolute left-0 top-full z-50 mt-2 max-h-80 min-w-48 overflow-y-auto rounded-2xl border border-sky-border bg-white p-1 shadow-lift">
      {[{ label: t("All"), to: "/shop" }, ...cats.map((c) => ({ label: c, to: `/shop?category=${encodeURIComponent(c)}` }))].map((i) => <li key={i.to} role="none"><Link role="menuitem" to={i.to} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-2 font-semibold hover:bg-sky-pale">{i.label}</Link></li>)}</ul>}</div>);
}
export default function Header({ logoUrl = "/img/logo.png" }: { logoUrl?: string }) {
  const { count } = useCart(); const { t } = useI18n(); const { data: products } = useListedProducts();
  const loc = useLocation(); const pathname = loc.pathname; const navigate = useNavigate(); const q = new URLSearchParams(loc.search);
  const [open, setOpen] = useState(false); const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [pathname]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const search = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); navigate(`/shop?q=${encodeURIComponent(input.current?.value ?? "")}`); };
  const cats = categoriesOf(products ?? []); const onShop = pathname.startsWith("/shop");
  const isOn = (id: string) => id === "new" ? q.get("type") === "new_arrival" : id === "pre" ? q.get("type") === "preorder" : id === "sale" ? q.get("sale") === "1" : onShop && !!q.get("category");
  const cartOn = CART_MATCH(pathname), icon = "relative grid h-10 w-10 place-items-center rounded-full transition hover:scale-110 hover:bg-white active:scale-95 sm:h-11 sm:w-11";
  const home = pathname === "/"; // the purple "Special Offer" pill is only shown in the header of the home page
  const pills = (dropdown: boolean) => PILLS.filter((p) => p.id !== "sale" || home).map((p) => p.id === "cat" && dropdown
    ? <CategoryPill key={p.id} active={isOn(p.id)} cats={cats} label={t(p.label)} />
    : <Link key={p.id} to={p.to} aria-current={isOn(p.id) ? "page" : undefined} className={pillCls} style={{ background: p.bg }}><Pill p={p} active={isOn(p.id)}>{t(p.label)}</Pill></Link>);
  // Home / Product buttons: centred in the top row, but on the Product page (/shop) they sit right next to the search icon
  const navLinks = <div className={`hidden items-center gap-1 lg:flex ${onShop ? "mr-1" : ""}`}>{[NAV[0], NAV[1]].map(({ href, label, match }) => { const on = match(pathname); return (
          <Link key={href} to={href} aria-current={on ? "page" : undefined} className={`rounded-full px-5 py-2 text-base font-bold transition duration-200 hover:-translate-y-0.5 ${on ? "bg-sky text-ink shadow-soft" : "hover:bg-white"}`}>{t(label)}</Link>); })}</div>;
  return (
    <header className="sticky top-0 z-50 border-b border-[#F0E6C8] bg-[#FFFBF0]/95 backdrop-blur" onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setMenu(false); } }}>
      <div className="page-wrap flex items-center justify-between gap-3 py-2 lg:py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img src={logoUrl} alt="" width={56} height={56} className="h-11 w-11 shrink-0 rounded-full object-cover sm:h-14 sm:w-14" />
          <span className="min-w-0 leading-tight"><span className="block truncate font-['Caveat'] text-3xl font-bold text-[#1F4E9C] sm:text-4xl">Cloudy Toys</span><span className="hidden truncate text-xs text-[#1F4E9C]/80 min-[400px]:block sm:text-sm">♡ {t("Collect a little happiness")} ♡</span></span></Link>
        {!onShop && navLinks}
        {!onShop && <div className="hidden items-center gap-2 2xl:flex">{pills(true)}</div>}
        <nav className="flex items-center gap-0.5 sm:gap-1.5">
          {onShop && navLinks}
          <button type="button" aria-label={open ? t("Close search") : t("Open search")} aria-expanded={open} onClick={() => { setOpen(!open); setMenu(false); }} className={icon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>}</svg></button>
          <LangSwitch className="mx-0.5 sm:mx-1" />
          <Link to="/account" aria-label={t("Account")} title={t("Account")} aria-current={pathname.startsWith("/account") || pathname.startsWith("/login") ? "page" : undefined} className={`${icon} hidden lg:grid`}><UserIcon /></Link>
          <Link to="/cart" aria-label={t("Cart")} title={t("Cart")} aria-current={cartOn ? "page" : undefined} className={`${icon} hidden lg:grid ${cartOn ? "bg-white shadow-soft" : ""}`}><CartIcon />
            {count > 0 && <span key={count} className="badge-pop absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#FF8FAE] px-1 text-[11px] font-extrabold text-white" aria-label={`${count} items`}>{count}</span>}</Link>
          <button type="button" aria-label={menu ? t("Close menu") : t("Open menu")} aria-expanded={menu} aria-controls="mobile-menu" onClick={() => { setMenu(!menu); setOpen(false); }} className={`${icon} lg:hidden`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={`transition-transform duration-300 ${menu ? "rotate-90" : ""}`}>{menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
            {!menu && count > 0 && <span key={count} className="badge-pop absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#FF8FAE] px-1 text-[11px] font-extrabold text-white" aria-label={`${count} items`}>{count}</span>}</button>
        </nav>
      </div>
      {/* phone / iPad / tablet: the four pills scroll sideways under the logo; on a wide screen they sit in the top row */}
      {/* the Product page (/shop) has its own filter chips, so the pills are hidden there */}
      {!onShop && <div className="page-wrap flex gap-2 overflow-x-auto pb-2 lg:hidden [scrollbar-width:none]">{pills(false)}</div>}
      {/* laptop / desktop: the pills sit centred under the logo row (on a very wide screen they move into the top row) */}
      {!onShop && <div className="page-wrap hidden justify-center gap-2 pb-2 lg:flex 2xl:hidden">{pills(true)}</div>}
      {menu && (
        <div id="mobile-menu" className="menu-in page-wrap max-h-[calc(100dvh-8rem)] overflow-y-auto pb-3 lg:hidden">
          <ul className="flex flex-col gap-1 text-base font-semibold">
            {[...NAV.map((n) => ({ ...n, cart: false })), { href: "/cart", label: "Cart", match: CART_MATCH, cart: true }].map(({ href, label, match, cart }, i) => { const on = match(pathname); return (
              <li key={href} className="menu-item" style={{ animationDelay: `${i * 60}ms` }}>
                <Link to={href} aria-current={on ? "page" : undefined} className={`flex items-center justify-between rounded-full px-5 py-3 transition duration-200 active:scale-95 ${on ? "bg-sky text-ink shadow-soft font-extrabold translate-x-1" : "hover:bg-sky-pale hover:translate-x-1"}`}>
                  <span className="flex items-center gap-2">{cart && <CartIcon />}{t(label)}</span>
                  {cart && count > 0 && <span key={count} className="badge-pop rounded-full bg-white px-2 text-sm" aria-label={`${count} items`}>{count}</span>}</Link></li>); })}
          </ul>
        </div>
      )}
      {open && (
        <form onSubmit={search} role="search" className="menu-in page-wrap pb-3">
          <input ref={input} type="search" name="q" placeholder={t("Search products")} aria-label={t("Search products")} className="w-full rounded-full border border-sky-border bg-white px-5 py-3" />
        </form>
      )}
    </header>
  );
}
