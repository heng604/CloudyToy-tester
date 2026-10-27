import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";
/** Signed-in customers only. Not signed in => /login. The admin email goes to /admin from customer account pages, except where allowAdmin is set (checkout: the admin can place an order like any customer). */
export default function RequireUser({ children, allowAdmin = false }: { children: (user: NonNullable<ReturnType<typeof useAuth>["user"]>) => ReactNode; allowAdmin?: boolean }) {
  const { user, ready, isAdmin } = useAuth(); const { pathname } = useLocation();
  if (!ready) return <div className="h-64" aria-busy="true" />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (isAdmin && !allowAdmin) return <Navigate to="/admin" replace />;
  return <>{children(user)}</>;
}
