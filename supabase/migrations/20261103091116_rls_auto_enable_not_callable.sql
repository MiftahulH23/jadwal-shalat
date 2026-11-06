-- Supabase's own trigger function that switches on RLS for new tables. It only needs to run as a
-- trigger, so nobody has to be able to call it through the API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
