import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { safeNext } from "@shared/safeRedirect";
import { fetchRole } from "@/lib/auth";
/** Google sign-in lands here. supabase-js exchanges the ?code for a session by itself; we only decide where to send the person. */
export default function AuthCallback() {
  const navigate = useNavigate(); const [sp] = useSearchParams();
  useEffect(() => {
    const next = safeNext(sp.get("next")); const wantsAdmin = next === "/admin" || next.startsWith("/admin/");
    const fail = wantsAdmin ? "/admin/login?error=auth" : "/login?error=auth";
    (async () => {
      if (!supabase || !sp.get("code")) return navigate(fail, { replace: true });
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (!user) return navigate(fail, { replace: true });
      if (wantsAdmin && (await fetchRole())) return navigate(next, { replace: true }); // owners, admins and editors (the server decides)
      if (wantsAdmin) { await supabase.auth.signOut(); return navigate("/admin/login?error=denied", { replace: true }); }
      navigate(next, { replace: true });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p className="py-16 text-center text-mute" aria-busy="true">Signing you in…</p>;
}
