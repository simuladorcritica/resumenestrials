-- Impide que un cliente autenticado cambie id, email o marcas del sistema.
-- Las preferencias editables siguen protegidas por RLS y privilegios de columna.
revoke update on table public.profiles from authenticated;
grant update (first_name, last_name, username, newsletter_opt_in, newsletter_opt_in_at)
  on table public.profiles to authenticated;
