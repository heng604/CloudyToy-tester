import { Link, useNavigate } from "react-router-dom";
import RequireUser from "@/components/RequireUser";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/data";
import { apiJson } from "@/lib/api";
import { useTitle } from "@/lib/title";
import type { StoredOrder } from "@shared/types";
function OrdersCard({ email }: { email: string }) {
  // same cache key as the Order history page, so opening it afterwards is instant
  const { data } = useResource<{ orders: StoredOrder[] }>(`account:orders:${email}`, () => apiJson("/account/orders"));
  const n = data?.orders.length;
  return (<Link to="/account/orders" className="rounded-xl2 border border-sky-border bg-white p-5 font-bold shadow-soft">Order history
    {n !== undefined && <span className="mt-1 block text-sm font-normal text-mute">{n === 0 ? "No orders yet" : `${n} order${n === 1 ? "" : "s"}`}</span>}</Link>);
}
export default function Account() {
  useTitle("My account"); const { signOut } = useAuth(); const navigate = useNavigate();
  return (<RequireUser>{(user) => (<div className="max-w-xl space-y-4"><h1 className="text-2xl font-extrabold sm:text-3xl">My account</h1>
    <p className="text-mute">Signed in as {user.email}</p>
    <div className="grid gap-3 sm:grid-cols-2"><Link to="/account/profile" className="rounded-xl2 border border-sky-border bg-white p-5 font-bold shadow-soft">Profile</Link><OrdersCard email={user.email ?? user.id} /></div>
    <button onClick={async () => { await signOut(); navigate("/"); }} className="min-h-11 rounded-full border border-sky-border bg-white px-6 font-bold">Sign out</button></div>)}</RequireUser>);
}
