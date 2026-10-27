-- Product details used by the new admin product form: Khmer name, brand, unit, variants and labels (New Arrival / Restock / Limited Edition / Pre-Order Item).
alter table public.products add column if not exists name_km text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists uom text;
alter table public.products add column if not exists variants text;
alter table public.products add column if not exists labels text[] not null default '{}';
-- Admin staff accounts (Admin Permissions page). The two owner emails in shared/admin.ts always keep access and cannot be removed here.
-- RLS is on with no policy: only the server (service-role key) can read or write this table.
create table if not exists public.staff_members(
  email text primary key,
  name text not null default '',
  role text not null default 'admin' check (role in ('owner','admin','editor')),
  active boolean not null default true,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
notify pgrst, 'reload schema';
