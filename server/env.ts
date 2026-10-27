// Loads .env.local / .env. Accepts the old Next.js names (NEXT_PUBLIC_*) as well as the new VITE_* names.
import dotenv from "dotenv";
if (!(typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers")) { dotenv.config({ path: ".env.local" }); dotenv.config(); } // on Cloudflare the values come from wrangler secrets
export const env = {
  supabaseUrl: () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
};
