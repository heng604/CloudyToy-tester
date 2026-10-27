// Server-only Supabase client with the service-role key (bypasses RLS). Never ship this key to the browser.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
let cached: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (cached) return cached;
  const url = env.supabaseUrl(), key = env.serviceKey();
  if (!url || !key) throw new Error("Database not configured: set VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
export function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
