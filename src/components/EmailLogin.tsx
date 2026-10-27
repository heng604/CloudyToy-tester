import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { fetchRole } from "@/lib/auth";
/** Email + password sign-in (works without enabling Google in Supabase). `allowSignUp` is off for the admin page. */
const friendly = (m: string) => /invalid login/i.test(m) ? "Wrong email or password." : /not confirmed/i.test(m) ? "Please confirm your email first (check your inbox), then sign in." : /already registered/i.test(m) ? "This email already has an account. Please sign in." : /password/i.test(m) && /least|short|weak/i.test(m) ? "Password is too short. Use at least 6 characters." : m;
export default function EmailLogin({ next = "/account", allowSignUp = true }: { next?: string; allowSignUp?: boolean }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in"); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [again, setAgain] = useState("");
  const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [busy, setBusy] = useState(false);
  const wantsAdmin = next === "/admin" || next.startsWith("/admin/");
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(""); setInfo("");
    if (!supabase) return setErr("Sign-in is not configured yet. Add the Supabase environment variables.");
    setBusy(true);
    try {
      if (mode === "up") {
        if (password !== again) return setErr("The two passwords are not the same.");
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim(), phone: phone.trim() },  emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
        if (error) return setErr(friendly(error.message));
        if (data.user && (data.user.identities?.length ?? 1) === 0) return setErr("This email already has an account. Please sign in.");
        if (data.session) return navigate(next, { replace: true }); // account created and saved: signed in straight away
        return setInfo("Account created and saved. Please confirm your email (check your inbox), then sign in.");
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setErr(friendly(error.message));
      const u = data.user;
      if (wantsAdmin && !(await fetchRole())) { await supabase.auth.signOut(); return setErr("That account is not the admin account."); }
      navigate(next, { replace: true });
    } catch { setErr("Something went wrong. Please try again."); } finally { setBusy(false); }
  }
  const field = "w-full rounded-xl border border-sky-border px-4 py-3 text-left";
  return (<form onSubmit={submit} className="space-y-3 text-left">
    {mode === "up" && <><label className="block text-sm font-bold">Full name<input type="text" required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={field} /></label>
    <label className="block text-sm font-bold">Phone <span className="font-normal text-mute">(optional)</span><input type="tel" maxLength={20} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} /></label></>}
    <label className="block text-sm font-bold">Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></label>
    <label className="block text-sm font-bold">Password<input type="password" required minLength={6} autoComplete={mode === "up" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={field} /></label>
    {mode === "up" && <label className="block text-sm font-bold">Confirm password<input type="password" required minLength={6} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={field} /></label>}
    {err && <p role="alert" className="text-sm text-red-700">{err}</p>}{info && <p role="status" className="text-sm text-green-700">{info}</p>}
    <button type="submit" disabled={busy} className="min-h-11 w-full rounded-full bg-sky px-6 font-bold hover:bg-sky-hover disabled:opacity-60">{busy ? "Please wait…" : mode === "up" ? "Create account" : "Sign in with email"}</button>
    {allowSignUp && <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); setInfo(""); }} className="w-full text-sm underline">{mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}</button>}
  </form>);
}
