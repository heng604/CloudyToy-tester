import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { LangProvider } from "@/lib/i18n";
import CartProvider from "@/components/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Skeleton from "@/components/Skeleton";
import NotFound from "@/components/NotFound";
import RealtimeRefresh from "@/lib/realtime";
import { refreshStore, useSettings, usePages } from "@/lib/store";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductPage from "@/pages/ProductPage";
import Cart from "@/pages/Cart";
// Less-visited pages are loaded on demand so the first visit downloads less code.
const Checkout = lazy(() => import("@/pages/Checkout"));
const Payment = lazy(() => import("@/pages/Payment"));
const Login = lazy(() => import("@/pages/Login"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Account = lazy(() => import("@/pages/account/Account"));
const AccountOrders = lazy(() => import("@/pages/account/Orders"));
const Profile = lazy(() => import("@/pages/account/Profile"));
const ContentRoute = lazy(() => import("@/pages/ContentRoute"));
const AdminRoutes = lazy(() => import("@/pages/admin/AdminRoutes"));

function ScrollToTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }

function Shell() {
  const { settings } = useSettings(); const { hidden } = usePages();
  return (<>
    <RealtimeRefresh tables={["products", "site_settings"]} onChange={refreshStore} />
    <Header logoUrl={settings.logoUrl} />
    <main className="page-wrap flex-1 py-5 sm:py-8">
      <Suspense fallback={<Skeleton />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment/:orderNumber" element={<Payment />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/account" element={<Account />} />
          <Route path="/account/orders" element={<AccountOrders />} />
          <Route path="/account/profile" element={<Profile />} />
          <Route path="/about" element={<ContentRoute slug="about" title="About" />} />
          <Route path="/contact" element={<ContentRoute slug="contact" title="Contact" />} />
          <Route path="/shipping" element={<ContentRoute slug="shipping" title="Shipping Policy" />} />
          <Route path="/preorder" element={<ContentRoute slug="preorder" title="Pre-Order FAQ" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </main>
    <Footer logoUrl={settings.logoUrl} hidden={hidden} />
  </>);
}

export default function App() {
  const { pathname } = useLocation(); const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  return (<LangProvider><AuthProvider><CartProvider><ScrollToTop />
    {isAdmin
      ? <div className="admin-theme flex-1 p-2 sm:p-4"><Suspense fallback={<Skeleton />}><AdminRoutes /></Suspense></div>
      : <Shell />}
  </CartProvider></AuthProvider></LangProvider>);
}
