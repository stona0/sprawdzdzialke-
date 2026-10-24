-- ============================================================
-- utility-maps: zapis tylko przez service role
-- Polityki z 20260529_utility_maps_bucket.sql nie miały klauzuli TO, więc obejmowały
-- role anon i authenticated: każdy z publicznym kluczem anon mógł wgrać albo
-- podmienić obraz mapy pokazywany w raportach. Aplikacja zapisuje mapy kluczem
-- service role (src/lib/utility-map.ts), który omija RLS — polityki są zbędne.
-- ============================================================
DROP POLICY IF EXISTS "Service insert utility-maps" ON storage.objects;
DROP POLICY IF EXISTS "Service update utility-maps" ON storage.objects;
