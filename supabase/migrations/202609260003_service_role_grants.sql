-- Trusted server workflows use this role only for staff profile administration.
-- The service key remains server-only and browser roles continue through RLS.
grant usage on schema public to service_role;
grant select, insert, update on public.profiles to service_role;
