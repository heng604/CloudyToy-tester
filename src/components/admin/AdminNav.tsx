import { Link, useLocation } from "react-router-dom";
import Icon, { type IconName } from "./Icons";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { can, type Perm } from "@shared/roles";
const LINKS: [string, string, IconName, Perm | null][] = [["/admin", "Dashboard", "home", null], ["/admin/orders", "Orders", "orders", "orders"], ["/admin/transactions", "Transactions", "transactions", "orders"], ["/admin/products", "Products & Inventory", "products", "products"], ["/admin/promotions", "Promotions", "discounts", "promotions"], ["/admin/stock", "Stock", "stock", "products"], ["/admin/pages", "Pages", "pages", "pages"], ["/admin/staff", "Admin Permissions", "users", "staff"], ["/admin/settings", "Settings", "settings", "settings"]];
/** White sidebar with the shop logo and labelled links. On phones it becomes a scrollable bar across the top. */
export default function AdminNav({ logoUrl, onSignOut }: { logoUrl: string; onSignOut: () => void }) {
  const path = useLocation().pathname; const { t } = useI18n(); const { role } = useAuth();
  const item = "flex h-11 shrink-0 items-center gap-3 rounded-2xl px-3 text-[15px] font-bold transition md:h-11";
  return (<aside className="flex shrink-0 items-center gap-2 border-b border-sky-border bg-white/90 p-2 md:w-60 md:flex-col md:items-stretch md:gap-1 md:rounded-l-[1.75rem] md:border-b-0 md:border-r md:px-4 md:py-5">
    <Link to="/admin" aria-label="Cloudy Toys" className="flex shrink-0 items-center md:mb-4 md:justify-center"><img src={logoUrl} alt="Cloudy Toys" className="h-10 w-auto rounded-xl object-cover md:h-20" /></Link>
    <nav aria-label="Admin" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex-none md:flex-col md:items-stretch md:overflow-visible">{LINKS.filter(([, , , perm]) => !perm || can(role, perm)).map(([href, label, icon]) => {
      const on = href === "/admin" ? path === "/admin" : path.startsWith(href);
      return <Link key={href} to={href} title={t(label)} aria-current={on ? "page" : undefined} className={`${item} ${on ? "bg-sky-pale text-ink shadow-soft ring-1 ring-sky-border" : "text-mute hover:bg-sky-pale hover:text-ink"}`}><Icon name={icon} size={20} /><span className="hidden md:inline">{t(label)}</span></Link>; })}</nav>
    <div className="hidden md:mt-auto md:block"><img src="/img/sidebar-mascot.png" alt="" width={812} height={522} className="mx-auto mb-3 h-auto w-full max-w-[13rem]" /></div>
    <Link to="/" title={t("View shop")} className={`${item} text-mute hover:bg-sky-pale hover:text-ink`}><Icon name="shop" size={20} /><span className="hidden md:inline">{t("View shop")}</span></Link>
    <button type="button" onClick={onSignOut} title={t("Sign out")} className={`${item} text-mute hover:bg-sky-pale hover:text-ink`}><Icon name="logout" size={20} /><span className="hidden md:inline">{t("Sign out")}</span></button>
  </aside>);
}
