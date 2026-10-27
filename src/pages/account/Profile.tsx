import { useEffect, useState, type FormEvent } from "react";
import RequireUser from "@/components/RequireUser";
import { supabase } from "@/lib/supabase";
import { ProfileInput } from "@shared/profile";
import { useTitle } from "@/lib/title";
import type { User } from "@supabase/supabase-js";
const cls = "w-full rounded-xl border border-sky-border bg-white px-4 py-3";
function Form({ user }: { user: User }) {
  const [loaded, setLoaded] = useState(false); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [s, setS] = useState<{ ok?: boolean; error?: string }>({});
  useEffect(() => { (async () => {
    const { data } = (await supabase?.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle()) ?? { data: null };
    setName(data?.display_name ?? (user.user_metadata?.full_name as string) ?? ""); setPhone(data?.phone ?? ""); setLoaded(true); })(); }, [user]);
  async function save(e: FormEvent) {
    e.preventDefault(); setS({});
    const p = ProfileInput.safeParse({ display_name: name, phone }); if (!p.success) return setS({ error: p.error.issues[0]?.message ?? "Invalid input" });
    const { error } = (await supabase?.from("profiles").upsert({ id: user.id, ...p.data, updated_at: new Date().toISOString() })) ?? { error: true };
    setS(error ? { error: "Could not save. Check that the database migration has been applied." } : { ok: true });
  }
  if (!loaded) return <div className="h-40 animate-pulse rounded-xl2 bg-sky-pale" aria-busy="true" />;
  return (<form onSubmit={save} className="space-y-3"><label className="block">Display name<input name="display_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={cls} /></label>
    <label className="block">Phone<input name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} /></label>
    {s.error && <p role="alert" className="text-red-700">{s.error}</p>}{s.ok && <p role="status" className="text-green-700">Saved</p>}
    <button className="min-h-11 rounded-full bg-sky px-6 font-bold hover:bg-sky-hover">Save changes</button></form>);
}
export default function Profile() {
  useTitle("Profile");
  return <RequireUser>{(user) => (<div className="max-w-xl space-y-4"><h1 className="text-2xl font-extrabold sm:text-3xl">Profile</h1><p className="text-mute">Email: {user.email} (managed by Google)</p><Form user={user} /></div>)}</RequireUser>;
}
