-- Discount codes: created/edited ONLY by the admin. Customers can only use a code at checkout (server checks it).
create table if not exists public.discount_codes(
  code text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
  type text not null check (type in ('PERCENT','FIXED')),
  value numeric(10,2) not null check (value > 0),
  min_subtotal numeric(10,2) not null default 0 check (min_subtotal >= 0),
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz default now(),
  check (type <> 'PERCENT' or value <= 100)
);
alter table public.discount_codes enable row level security;
-- No customer/anon policy: codes can't be listed or guessed from the browser. Only the admin may read (for live updates).
drop policy if exists "admin read discount codes" on public.discount_codes;
create policy "admin read discount codes" on public.discount_codes for select using (public.is_admin());

-- Atomic use counter: never exceeds max_uses even with simultaneous buyers.
create or replace function public.consume_discount(p_code text) returns boolean language plpgsql security definer set search_path=public as $$
declare n int;
begin
  update public.discount_codes set used_count = used_count + 1
   where code = p_code and active and (max_uses is null or used_count < max_uses) and (expires_at is null or expires_at > now());
  get diagnostics n = row_count; return n = 1;
end $$;
create or replace function public.release_discount(p_code text) returns void language sql security definer set search_path=public as $$
  update public.discount_codes set used_count = greatest(0, used_count - 1) where code = p_code
$$;
revoke all on function public.consume_discount(text), public.release_discount(text) from public, anon, authenticated;
grant execute on function public.consume_discount(text), public.release_discount(text) to service_role;

alter publication supabase_realtime add table public.discount_codes;
notify pgrst, 'reload schema';
