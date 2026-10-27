import { Navigate, useSearchParams } from "react-router-dom";
import EmailLogin from "@/components/EmailLogin";
import GoogleButton, { GOOGLE_ENABLED } from "@/components/GoogleButton";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/store";
import { useTitle } from "@/lib/title";
export default function AdminLogin() {
  useTitle("Admin login", true); const [sp] = useSearchParams(); const { isAdmin } = useAuth(); const { settings: { logoUrl } } = useSettings();
  if (isAdmin) return <Navigate to="/admin" replace />;
  return (<main className="page-wrap flex-1 py-5 sm:py-8"> <div className="mx-auto max-w-md space-y-4 rounded-xl2 border border-sky-border bg-white p-8 text-center shadow-soft">
    <img src={logoUrl} alt="Cloudy Toys" className="mx-auto h-24 w-auto rounded-xl" />
    <h1 className="text-2xl font-extrabold">Admin login</h1>
    <p className="text-mute">Only the store owner&apos;s account can sign in here. It opens the admin dashboard only.</p>
    {sp.get("error") === "denied" && <p role="alert" className="rounded-xl bg-red-100 p-3 text-red-800">That Google account is not the admin account.</p>}
    {sp.get("error") === "auth" && <p role="alert" className="rounded-xl bg-red-100 p-3 text-red-800">Sign-in was cancelled or failed. Please try again.</p>}
    <EmailLogin next="/admin" allowSignUp={false} />
    {GOOGLE_ENABLED && <p className="text-sm text-mute">or</p>}
    <GoogleButton next="/admin" label="Admin sign in with Google" /></div></main>);
}
