-- Allow a second admin account (run this in the Supabase SQL editor on an existing project).
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid())
      or (lower(coalesce(auth.jwt()->>'email','')) in ('toyscloudy@gmail.com','seangheng2006@gmail.com')
          and coalesce((auth.jwt()->'user_metadata'->>'email_verified')::boolean, false))
$$;
