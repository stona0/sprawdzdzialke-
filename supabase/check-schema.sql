-- ============================================================
-- Kontrola schematu — TYLKO ODCZYT, niczego nie zmienia.
-- Uruchom w Supabase → SQL Editor:
--   • na stagingu po bootstrap.sql: wszystkie wiersze powinny mieć ok = true;
--   • na produkcji PRZED migracjami: wiersze z ok = false pokazują, których
--     plików z kolumny "plik" brakuje (zwykle 20261020 i 20261024).
-- Wiersze z ok = false są na górze.
-- ============================================================
WITH expected(kind, name, plik) AS (VALUES
  ('tabela',          'public.profiles',             'schema.sql'),
  ('tabela',          'public.reports',              'schema.sql'),
  ('tabela',          'public.payments',             'schema.sql'),
  ('tabela',          'public.mpzp_cache',           'schema.sql'),
  ('tabela',          'public.sip_layers',           'schema.sql'),
  ('funkcja',         'public.handle_new_user',      'schema.sql'),
  ('funkcja',         'public.increment_free_reports', 'schema.sql'),
  ('trigger',         'on_auth_user_created',        'schema.sql'),
  ('tabela',          'public.mpzp_plans',           '20260523_mpzp_plans.sql'),
  ('bucket',          'utility-maps',                '20260529_utility_maps_bucket.sql'),
  ('polityka',        'Public read utility-maps',    '20260529_utility_maps_bucket.sql'),
  ('tabela',          'public.source_cache',         '20261020_source_cache_report_jobs.sql'),
  ('tabela',          'public.report_jobs',          '20261020_source_cache_report_jobs.sql'),
  ('funkcja',         'public.enqueue_report_job',   '20261020_source_cache_report_jobs.sql'),
  ('funkcja',         'public.claim_report_job',     '20261020_source_cache_report_jobs.sql'),
  ('funkcja',         'public.complete_report_job',  '20261020_source_cache_report_jobs.sql'),
  ('funkcja',         'public.fail_report_job',      '20261020_source_cache_report_jobs.sql'),
  ('anon bez dostępu', 'public.claim_report_job(uuid,integer)', '20261020_source_cache_report_jobs.sql'),
  ('anon bez dostępu', 'public.complete_report_job(uuid,uuid,text)', '20261020_source_cache_report_jobs.sql'),
  ('bucket',          'power-lines',                 '20261024_power_lines_bucket.sql'),
  ('polityka',        'Public read power-lines',     '20261024_power_lines_bucket.sql'),
  ('brak polityki',   'Service insert utility-maps', '20261024_utility_maps_write_policies.sql'),
  ('brak polityki',   'Service update utility-maps', '20261024_utility_maps_write_policies.sql')
), checked AS (
  SELECT kind, name, plik,
    CASE kind
      WHEN 'tabela'   THEN to_regclass(name) IS NOT NULL
      WHEN 'funkcja'  THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname || '.' || p.proname = name)
      WHEN 'trigger'  THEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = name)
      WHEN 'bucket'   THEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = name)
      WHEN 'polityka' THEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = name)
      WHEN 'brak polityki' THEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = name)
      -- tabele chroni RLS (Supabase domyślnie nadaje anon uprawnienia do tabel w public),
      -- funkcje kolejki mają odebrane EXECUTE — sprawdzamy to wprost
      WHEN 'anon bez dostępu' THEN to_regprocedure(name) IS NOT NULL AND NOT has_function_privilege('anon', name, 'EXECUTE')
    END AS ok
  FROM expected
), rls AS (
  -- każda tabela w public musi mieć włączone RLS (inaczej klucz anon czyta ją przez API)
  SELECT 'RLS włączone' AS kind, n.nspname || '.' || c.relname AS name, '—' AS plik, c.relrowsecurity AS ok
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
)
SELECT ok, kind, name, plik FROM checked
UNION ALL SELECT ok, kind, name, plik FROM rls
ORDER BY ok, plik, kind, name;
