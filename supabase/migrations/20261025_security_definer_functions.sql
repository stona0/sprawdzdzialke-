-- ============================================================
-- Funkcje SECURITY DEFINER ze schema.sql: poza API, stały search_path
-- Supabase domyślnie nadaje EXECUTE na nowe funkcje w public rolom anon i authenticated,
-- więc obie były wywoływalne przez /rest/v1/rpc/... z publicznym kluczem anon:
--   • increment_free_reports(uid) — każdy, kto zna UUID użytkownika, mógł zwiększyć mu
--     licznik i odebrać darmowy raport. Aplikacja jej nie używa (licznik zmienia
--     /api/report/generate kluczem service role); zostaje dla service role.
--   • handle_new_user() — funkcja triggera rejestracji; nie powinna być w API. Trigger
--     działa dalej: EXECUTE jest sprawdzane przy CREATE TRIGGER, nie przy wyzwoleniu.
-- Wykryte przez doradcę bezpieczeństwa Supabase na stagingu (lints 0011, 0028, 0029).
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.increment_free_reports(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_free_reports(UUID) TO service_role;

ALTER FUNCTION public.increment_free_reports(UUID) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
