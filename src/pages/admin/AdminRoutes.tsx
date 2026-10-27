import type { FormEvent } from "react";
import { Link, Navigate, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
import Icon from "@/components/admin/Icons";
import { useI18n, LangSwitch } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/store";
import RealtimeRefresh from "@/lib/realtime";
import AdminNav from "@/components/admin/AdminNav";
import NotFound from "@/components/NotFound";
import Skeleton from "@/components/Skeleton";
import type { StoredOrder } from "@shared/types";
import { refreshAdmin, AdminErrorBanner, useAdmin, displayName } from "./hooks";
import AdminLogin from "./Login";
import Dashboard from "./Dashboard";
import Orders from "./Orders";
import Invoice from "./Invoice";
import Transactions from "./Transactions";
import Products from "./Products";
import Stock from "./Stock";
import Pages from "./Pages";
import Settings from "./Settings";
import Promotions from "./Discounts";
import Staff from "./Staff";
import { can, ROLE_NAME, type Perm } from "@shared/roles";
import type { ReactNode } from "react";

/** Bell: number of orders still waiting for payment, links to that list. */
function Bell() {
  const { t } = useI18n(); const { data } = useAdmin<{ orders: StoredOrder[] }>("/admin/dashboard");
  const n = data?.orders.filter((o) => o.paymentStatus === "PENDING").length ?? 0;
  return (<Link to="/admin/orders?status=PENDING" title={t("Waiting for payment")} aria-label={`${t("Waiting for payment")}: ${n}`} className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-soft hover:bg-sky-pale"><Icon name="bell" size={20} />
    {n > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#FF8FAE] px-1 text-[11px] font-extrabold text-white">{n > 99 ? "99+" : n}</span>}</Link>);
}
function Layout() {
  const { user, ready, isAdmin, role, signOut } = useAuth(); const { settings } = useSettings(); const navigate = useNavigate(); const { t } = useI18n();
  if (!ready) return <Skeleton />;
  if (!isAdmin) return <NotFound />; // unauthorized => branded 404, no data revealed
  const search = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const q = String(new FormData(e.currentTarget).get("q") ?? "").trim(); navigate(q ? `/admin/orders?q=${encodeURIComponent(q)}` : "/admin/orders"); };
  const name = displayName(user);
  return (<div className="admin-shell mx-auto flex w-full max-w-[110rem] flex-col overflow-hidden rounded-[1.75rem] bg-white/50 shadow-xl ring-1 ring-sky-border md:min-h-[calc(100vh-2rem)] md:flex-row">
    <AdminNav logoUrl={settings.logoUrl} onSignOut={async () => { await signOut(); navigate("/"); }} />
    <div className="admin-main min-w-0 flex-1 space-y-4 p-3 sm:p-5 lg:p-6">
      <header className="flex flex-wrap items-center gap-2 sm:gap-3">
        <form onSubmit={search} role="search" className="order-last flex min-w-0 basis-full items-center rounded-full border border-sky-border bg-white p-1 pl-4 shadow-soft sm:order-none sm:basis-auto sm:w-72 lg:w-[28rem]">
          <Icon name="search" size={18} />
          <input name="q" type="search" placeholder={t("Search orders…")} aria-label={t("Search orders…")} className="min-w-0 flex-1 bg-transparent px-2 py-1.5 outline-none" />
          <button aria-label={t("Search")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky text-ink hover:bg-sky-hover"><Icon name="search" size={18} /></button></form>
        <div className="ml-auto flex items-center gap-2 text-sm"><RealtimeRefresh tables={["orders", "products", "site_settings", "store_discounts"]} onChange={refreshAdmin} indicator pollMs={60000} />{can(role, "orders") && <Bell />}<LangSwitch />
          <div className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow-soft"><span className="grid h-8 w-8 place-items-center rounded-full bg-sky text-base font-extrabold uppercase text-ink" aria-hidden="true">{name.slice(0, 1)}</span><span className="hidden leading-tight sm:block"><span className="block max-w-[10rem] truncate text-sm font-extrabold">{name}</span><span className="block text-[11px] text-mute">{t(ROLE_NAME[role ?? "admin"])}</span></span></div></div></header>
      <AdminErrorBanner /><Outlet /></div></div>);
}
/** Shows the page only when the signed-in role may use it; otherwise sends the person to a page they can use. */
function Guard({ perm, to, children }: { perm: Perm; to?: string; children: ReactNode }) {
  const { role } = useAuth();
  return can(role, perm) ? <>{children}</> : <Navigate to={to ?? (can(role, "products") ? "/admin/products" : "/")} replace />;
}
const OldProduct = () => { const { id } = useParams(); return <Navigate to={`/admin/products?edit=${encodeURIComponent(id ?? "")}`} replace />; };
export default function AdminRoutes() {
  return (<Routes>
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/admin" element={<Layout />}>
      <Route index element={<Guard perm="orders" to="/admin/products"><Dashboard /></Guard>} />
      <Route path="orders" element={<Guard perm="orders"><Orders /></Guard>} />
      <Route path="invoice/:orderNumber" element={<Guard perm="orders"><Invoice /></Guard>} />
      <Route path="transactions" element={<Guard perm="orders"><Transactions /></Guard>} />
      <Route path="products" element={<Products />} />
      <Route path="products/new" element={<Navigate to="/admin/products?new=1" replace />} />
      <Route path="products/:id" element={<OldProduct />} />
      <Route path="stock" element={<Stock />} />
      <Route path="pages" element={<Guard perm="pages"><Pages /></Guard>} />
      <Route path="settings" element={<Guard perm="settings"><Settings /></Guard>} />
      <Route path="promotions" element={<Guard perm="promotions"><Promotions /></Guard>} />
      <Route path="discounts" element={<Navigate to="/admin/promotions" replace />} />
      <Route path="staff" element={<Guard perm="staff"><Staff /></Guard>} />
      <Route path="*" element={<NotFound />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>);
}
