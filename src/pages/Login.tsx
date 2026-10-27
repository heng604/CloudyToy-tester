import { useSearchParams } from "react-router-dom";
import EmailLogin from "@/components/EmailLogin";
import GoogleButton, { GOOGLE_ENABLED } from "@/components/GoogleButton";
import { safeNext } from "@shared/safeRedirect";
import { useTitle } from "@/lib/title";
export default function Login() {
  useTitle("Sign in"); const [sp] = useSearchParams();
  return (<div className="mx-auto max-w-md space-y-4 rounded-xl2 border border-sky-border bg-white p-8 text-center shadow-soft"><h1 className="text-2xl font-extrabold">Sign in to Cloudy-Toy</h1>
    <p className="text-mute">{safeNext(sp.get("next")) === "/checkout" ? "Please sign in or create an account to place your order. Your cart is kept." : "Your cart is kept while you sign in."}</p>
    {sp.get("error") && <p role="alert" className="text-red-700">Sign-in was cancelled or failed. Please try again.</p>}
    <EmailLogin next={safeNext(sp.get("next"))} />
    {GOOGLE_ENABLED && <p className="text-sm text-mute">or</p>}
    <GoogleButton next={safeNext(sp.get("next"))} /></div>);
}
