import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseConfigured = !!url && !!key;
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null;
export const TELEGRAM_FALLBACK: string = import.meta.env.VITE_TELEGRAM_URL ?? import.meta.env.NEXT_PUBLIC_TELEGRAM_URL ?? "";
export const ADMIN_INBOX: string = import.meta.env.VITE_ADMIN_NOTIFICATION_EMAIL ?? import.meta.env.NEXT_PUBLIC_ADMIN_NOTIFICATION_EMAIL ?? "";
