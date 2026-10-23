-- ============================================================
-- STAGING: pełny schemat aplikacji dla NOWEGO, pustego projektu Supabase.
-- Wygenerowane przez: npm run staging:bootstrap — nie edytuj ręcznie.
-- Wklej całość w Supabase → SQL Editor projektu STAGINGU i uruchom.
-- Działa w jednej transakcji: przy błędzie nic nie zostaje zmienione.
-- NIE uruchamiaj na produkcji — tam stosuje się tylko brakujące migracje (docs/STAGING.md).
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'Ta baza ma już tabelę public.profiles. Skrypt jest tylko dla nowego, pustego projektu (staging). Przerwano, nic nie zmieniono.';
  END IF;
END $$;

-- Rejestr zastosowanych plików; schemat ops nie jest wystawiony przez API Supabase.
CREATE SCHEMA ops;
REVOKE ALL ON SCHEMA ops FROM PUBLIC;
CREATE TABLE ops.applied_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

-- ── schema.sql ──────────────────────────────────────────────
-- SprawdzDziałkę.pl – Schema SQL dla Supabase
-- Uruchom w Supabase SQL Editor

-- ============================================================
-- TABELE
-- ============================================================

-- Profile użytkowników (rozszerzenie auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  free_reports_used INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Raporty działek
CREATE TABLE IF NOT EXISTS public.reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcel_id     TEXT NOT NULL,
  gmina         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  html_content  TEXT,
  paid          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cache danych MPZP (1 wiersz = 1 symbol terenu)
CREATE TABLE IF NOT EXISTS public.mpzp_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmina_teryt       TEXT NOT NULL,
  symbol_terenu     TEXT NOT NULL,
  przeznaczenie     TEXT,
  wysokosc_max      NUMERIC,
  pbc_min           NUMERIC,
  typ_dachu         TEXT,
  source_pdf_url    TEXT,
  parsed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gmina_teryt, symbol_terenu)
);

-- Dane mediów / SIP (ręcznie uzupełniane przez admina)
CREATE TABLE IF NOT EXISTS public.sip_layers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmina_teryt   TEXT NOT NULL UNIQUE,
  gmina_nazwa   TEXT NOT NULL,
  wodociag      TEXT NOT NULL DEFAULT 'brak_danych'
                  CHECK (wodociag IN ('tak', 'nie', 'czesciowo', 'brak_danych')),
  kanalizacja   TEXT NOT NULL DEFAULT 'brak_danych'
                  CHECK (kanalizacja IN ('tak', 'nie', 'czesciowo', 'brak_danych')),
  gaz           TEXT NOT NULL DEFAULT 'brak_danych'
                  CHECK (gaz IN ('tak', 'nie', 'czesciowo', 'brak_danych')),
  energia       TEXT NOT NULL DEFAULT 'brak_danych'
                  CHECK (energia IN ('tak', 'nie', 'czesciowo', 'brak_danych')),
  uwagi         TEXT,
  sip_url       TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Płatności Stripe
CREATE TABLE IF NOT EXISTS public.payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id         UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount            NUMERIC NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: utwórz profil po rejestracji
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS – Row Level Security
-- ============================================================

ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpzp_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sip_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments   ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Użytkownik widzi własny profil"
  ON public.profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Użytkownik aktualizuje własny profil"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- reports
CREATE POLICY "Użytkownik widzi własne raporty"
  ON public.reports FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Użytkownik tworzy raporty"
  ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- mpzp_cache – wszyscy zalogowani mogą czytać
CREATE POLICY "Zalogowani czytają MPZP cache"
  ON public.mpzp_cache FOR SELECT USING (auth.role() = 'authenticated');

-- sip_layers – wszyscy zalogowani mogą czytać
CREATE POLICY "Zalogowani czytają SIP"
  ON public.sip_layers FOR SELECT USING (auth.role() = 'authenticated');

-- payments
CREATE POLICY "Użytkownik widzi własne płatności"
  ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- SERVICE ROLE – pełny dostęp dla edge functions / API routes
-- (service role key omija RLS automatycznie)
-- ============================================================

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_reports_user_id    ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_mpzp_gmina_teryt   ON public.mpzp_cache(gmina_teryt);
CREATE INDEX IF NOT EXISTS idx_sip_gmina_teryt    ON public.sip_layers(gmina_teryt);
CREATE INDEX IF NOT EXISTS idx_payments_report_id ON public.payments(report_id);

-- ============================================================
-- FUNKCJE RPC
-- ============================================================

-- Inkrementuje free_reports_used (wywołuje report-generator po wygenerowaniu darmowego raportu)
CREATE OR REPLACE FUNCTION public.increment_free_reports(uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET free_reports_used = free_reports_used + 1
  WHERE user_id = uid;
END;
$$;

INSERT INTO ops.applied_migrations (name) VALUES ('schema.sql');

-- ── supabase/migrations/20260523_mpzp_plans.sql ─────────────
-- ============================================================
-- Tabela: mpzp_plans
-- Przechowuje metadane planów MPZP + linki do plików w Storage
-- Uruchom w Supabase SQL Editor: https://supabase.com/dashboard/project/dpabcijnuzrkzstpnxlz/sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mpzp_plans (
  id            SERIAL PRIMARY KEY,
  gmina_teryt   TEXT NOT NULL,              -- kod TERYT gminy (np. '026101')
  gmina_nazwa   TEXT NOT NULL,              -- nazwa gminy (np. 'Długołęka')
  plan_id       INTEGER NOT NULL,           -- ID Zoomify (folder na wrosip.pl)
  plan_name     TEXT NOT NULL,              -- tytuł planu
  uchwala_nr    TEXT,                       -- numer uchwały rady gminy
  uchwala_data  DATE,                       -- data uchwalenia
  -- Bounding box WGS84 (szacunkowy ±200m)
  west          DOUBLE PRECISION NOT NULL,
  east          DOUBLE PRECISION NOT NULL,
  south         DOUBLE PRECISION NOT NULL,
  north         DOUBLE PRECISION NOT NULL,
  -- Parametry obrazu
  img_w         INTEGER NOT NULL,           -- szerokość px
  img_h         INTEGER NOT NULL,           -- wysokość px
  m_per_px      DOUBLE PRECISION NOT NULL,  -- metry na piksel (ze scale bar)
  map_w_frac    DOUBLE PRECISION NOT NULL DEFAULT 0.75, -- ułamek szer. = mapa (reszta = legenda)
  -- Pliki w Supabase Storage (bucket: mpzp-maps)
  image_url     TEXT,                       -- publiczny URL pełnej mapy JPEG
  pdf_url       TEXT,                       -- publiczny URL PDF uchwały
  -- Meta
  source        TEXT NOT NULL DEFAULT 'wrosip',
  aktywny       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS mpzp_plans_teryt_idx
  ON public.mpzp_plans(gmina_teryt);

CREATE INDEX IF NOT EXISTS mpzp_plans_bbox_idx
  ON public.mpzp_plans(south, north, west, east);

-- RLS (plany są publiczne do odczytu, zapis tylko service role)
ALTER TABLE public.mpzp_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mpzp_plans_public_read"
  ON public.mpzp_plans FOR SELECT
  TO anon, authenticated
  USING (aktywny = TRUE);

-- ============================================================
-- Seed: Plan #40 — MPZP Obręb wsi Długołęka
-- (skala zmierzona ze scale bar: 1050px = 500m → 0.4762 m/px)
-- ============================================================
INSERT INTO public.mpzp_plans (
  gmina_teryt, gmina_nazwa, plan_id, plan_name,
  uchwala_nr, uchwala_data,
  west, east, south, north,
  img_w, img_h, m_per_px, map_w_frac,
  image_url, pdf_url, source
) VALUES (
  '026101',
  'Długołęka',
  40,
  'MPZP Obręb wsi Długołęka',
  'NR XXXVIII/581/2005',
  '2005-03-30',
  17.1620, 17.2082, 51.1168, 51.1373,
  8132, 4798, 0.4762, 0.75,
  'https://dpabcijnuzrkzstpnxlz.supabase.co/storage/v1/object/public/mpzp-maps/dlugoleka/plan-40-mapa.jpg',
  'https://dpabcijnuzrkzstpnxlz.supabase.co/storage/v1/object/public/mpzp-maps/dlugoleka/plan-40-uchwala.pdf',
  'wrosip'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: Plan #101 — Długołęka II (URZĄD)
-- ============================================================
INSERT INTO public.mpzp_plans (
  gmina_teryt, gmina_nazwa, plan_id, plan_name,
  west, east, south, north,
  img_w, img_h, m_per_px, map_w_frac, source
) VALUES (
  '026101', 'Długołęka', 101, 'Długołęka II – URZĄD',
  17.1830, 17.1970, 51.1230, 51.1310,
  4720, 2814, 0.4762, 0.78, 'wrosip'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: Plan #113 — Długołęka IV dz. 49/4
-- ============================================================
INSERT INTO public.mpzp_plans (
  gmina_teryt, gmina_nazwa, plan_id, plan_name,
  west, east, south, north,
  img_w, img_h, m_per_px, map_w_frac, source
) VALUES (
  '026101', 'Długołęka', 113, 'Długołęka IV – dz. 49/4',
  17.1770, 17.1920, 51.1190, 51.1290,
  6495, 4487, 0.4762, 0.78, 'wrosip'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: Plan #124 — Długołęka dz. 437/3
-- ============================================================
INSERT INTO public.mpzp_plans (
  gmina_teryt, gmina_nazwa, plan_id, plan_name,
  west, east, south, north,
  img_w, img_h, m_per_px, map_w_frac, source
) VALUES (
  '026101', 'Długołęka', 124, 'Długołęka dz. 437/3',
  17.1860, 17.2000, 51.1200, 51.1300,
  6614, 4676, 0.4762, 0.78, 'wrosip'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: Plan #125 — Długołęka dz. 79/10
-- ============================================================
INSERT INTO public.mpzp_plans (
  gmina_teryt, gmina_nazwa, plan_id, plan_name,
  west, east, south, north,
  img_w, img_h, m_per_px, map_w_frac, source
) VALUES (
  '026101', 'Długołęka', 125, 'Długołęka dz. 79/10',
  17.1780, 17.1950, 51.1240, 51.1340,
  6614, 4676, 0.4762, 0.78, 'wrosip'
) ON CONFLICT DO NOTHING;

INSERT INTO ops.applied_migrations (name) VALUES ('supabase/migrations/20260523_mpzp_plans.sql');

-- ── supabase/migrations/20260529_utility_maps_bucket.sql ────
-- Bucket dla cache map uzbrojenia terenu (Playwright/Leaflet renders)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('utility-maps', 'utility-maps', true, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Publiczny dostęp do odczytu (CDN URL działa bez auth)
create policy "Public read utility-maps"
  on storage.objects for select
  using (bucket_id = 'utility-maps');

-- Service role może zapisywać (używane przez report-generator)
create policy "Service insert utility-maps"
  on storage.objects for insert
  with check (bucket_id = 'utility-maps');

-- Service role może nadpisywać (upsert przy regeneracji)
create policy "Service update utility-maps"
  on storage.objects for update
  using (bucket_id = 'utility-maps');

INSERT INTO ops.applied_migrations (name) VALUES ('supabase/migrations/20260529_utility_maps_bucket.sql');

-- ── supabase/migrations/20261020_source_cache_report_jobs.sql 
-- ============================================================
-- Trwały cache źródeł + kolejka generowania raportów
-- Uruchom w Supabase SQL Editor (najpierw na stagingu).
-- Testowane na PGlite (Postgres 18) w tests/db/queue.test.ts.
-- ============================================================

-- ─── Cache odpowiedzi usług zewnętrznych ─────────────────────────────────────
-- Klucz = wersja formatu + źródło + działka (np. "v1:gdos:026401_1.0001.1"),
-- wartość = SourceResult / ParcelData / rekomendacje AI w JSON.
-- Po fresh_until wynik jest pobierany ponownie; do keep_until wolno go użyć,
-- gdy źródło nie odpowiada (z adnotacją w raporcie).
CREATE TABLE IF NOT EXISTS public.source_cache (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  fresh_until  TIMESTAMPTZ NOT NULL,
  keep_until   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_cache_keep_until ON public.source_cache(keep_until);

-- Bez polityk: dostęp wyłącznie przez service role.
ALTER TABLE public.source_cache ENABLE ROW LEVEL SECURITY;

-- ─── Kolejka generowania raportów ────────────────────────────────────────────
-- Jedno zadanie na raport. Worker zajmuje zadanie na czas dzierżawy (locked_until);
-- jeśli platforma zabije funkcję, dzierżawa wygasa i zadanie podejmuje kolejny
-- worker (polling statusu przez użytkownika albo cron).
CREATE TABLE IF NOT EXISTS public.report_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL UNIQUE REFERENCES public.reports(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'done', 'failed')),
  -- raport z darmowej puli: przy ostatecznej porażce zwracamy użytkownikowi darmowy raport
  free_slot     BOOLEAN NOT NULL DEFAULT FALSE,
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 4,
  run_after     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until  TIMESTAMPTZ,
  lock_token    UUID,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_due
  ON public.report_jobs(run_after) WHERE status IN ('queued', 'running');

ALTER TABLE public.report_jobs ENABLE ROW LEVEL SECURITY;

-- Skutki ostatecznej porażki: raport „failed”, darmowy raport wraca do puli.
CREATE OR REPLACE FUNCTION public.report_job_failed_effects(p_report_id UUID, p_free_slot BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID;
BEGIN
  UPDATE reports SET status = 'failed'
  WHERE id = p_report_id AND status = 'generating'
  RETURNING user_id INTO v_user;

  IF p_free_slot AND v_user IS NOT NULL THEN
    UPDATE profiles SET free_reports_used = 0
    WHERE user_id = v_user AND free_reports_used = 1;
  END IF;
END;
$$;

-- Dodaje zadanie (idempotentnie). Ponowne dodanie zadania, które ostatecznie
-- padło, uruchamia je od nowa — np. gdy Stripe ponawia webhook.
CREATE OR REPLACE FUNCTION public.enqueue_report_job(p_report_id UUID, p_free_slot BOOLEAN DEFAULT FALSE)
RETURNS SETOF public.report_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  INSERT INTO report_jobs AS j (report_id, free_slot)
  VALUES (p_report_id, p_free_slot)
  ON CONFLICT (report_id) DO UPDATE SET
    status       = CASE WHEN j.status = 'failed' THEN 'queued' ELSE j.status END,
    attempts     = CASE WHEN j.status = 'failed' THEN 0 ELSE j.attempts END,
    run_after    = CASE WHEN j.status = 'failed' THEN NOW() ELSE j.run_after END,
    locked_until = CASE WHEN j.status = 'failed' THEN NULL ELSE j.locked_until END,
    lock_token   = CASE WHEN j.status = 'failed' THEN NULL ELSE j.lock_token END,
    updated_at   = NOW()
  RETURNING j.*;
END;
$$;

-- Zajmuje jedno zadanie gotowe do wykonania (opcjonalnie konkretnego raportu).
-- Najpierw domyka zadania, których ostatnia próba przepadła (funkcja zabita
-- w trakcie) przy wyczerpanym limicie prób — inaczej raport wisiałby w „generating”.
CREATE OR REPLACE FUNCTION public.claim_report_job(p_report_id UUID DEFAULT NULL, p_lease_seconds INTEGER DEFAULT 90)
RETURNS SETOF public.report_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dead RECORD;
BEGIN
  FOR dead IN
    UPDATE report_jobs
    SET status = 'failed', locked_until = NULL, lock_token = NULL, updated_at = NOW(),
        last_error = COALESCE(last_error || ' | ', '') || 'ostatnia próba przerwana (przekroczony czas)'
    WHERE status = 'running' AND locked_until < NOW() AND attempts >= max_attempts
      AND (p_report_id IS NULL OR report_id = p_report_id)
    RETURNING report_id, free_slot
  LOOP
    PERFORM report_job_failed_effects(dead.report_id, dead.free_slot);
  END LOOP;

  RETURN QUERY
  UPDATE report_jobs j
  SET status = 'running',
      attempts = j.attempts + 1,
      locked_until = NOW() + make_interval(secs => p_lease_seconds),
      lock_token = gen_random_uuid(),
      updated_at = NOW()
  WHERE j.id = (
    SELECT c.id FROM report_jobs c
    WHERE c.status IN ('queued', 'running')
      AND c.run_after <= NOW()
      AND (c.locked_until IS NULL OR c.locked_until < NOW())
      AND c.attempts < c.max_attempts
      AND (p_report_id IS NULL OR c.report_id = p_report_id)
    ORDER BY c.run_after
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING j.*;
END;
$$;

-- Zapisuje gotowy raport i zamyka zadanie — atomowo i tylko przez workera, który
-- nadal trzyma dzierżawę (lock_token). Zwraca false, gdy dzierżawa przepadła.
CREATE OR REPLACE FUNCTION public.complete_report_job(p_job_id UUID, p_token UUID, p_html TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_report UUID;
BEGIN
  UPDATE report_jobs
  SET status = 'done', locked_until = NULL, lock_token = NULL, updated_at = NOW()
  WHERE id = p_job_id AND lock_token = p_token AND status = 'running'
  RETURNING report_id INTO v_report;

  IF v_report IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE reports SET html_content = p_html, status = 'completed' WHERE id = v_report;
  RETURN TRUE;
END;
$$;

-- Rejestruje nieudaną próbę. p_retry_seconds = NULL → błąd trwały (bez ponowień).
-- Zwraca nowy status zadania: 'queued' (będzie ponowione), 'failed' albo 'lost'
-- (dzierżawę przejął inny worker).
CREATE OR REPLACE FUNCTION public.fail_report_job(p_job_id UUID, p_token UUID, p_error TEXT, p_retry_seconds INTEGER)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  j public.report_jobs;
BEGIN
  SELECT * INTO j FROM report_jobs
  WHERE id = p_job_id AND lock_token = p_token AND status = 'running'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'lost';
  END IF;

  IF p_retry_seconds IS NOT NULL AND j.attempts < j.max_attempts THEN
    UPDATE report_jobs
    SET status = 'queued', run_after = NOW() + make_interval(secs => p_retry_seconds),
        locked_until = NULL, lock_token = NULL, last_error = p_error, updated_at = NOW()
    WHERE id = p_job_id;
    RETURN 'queued';
  END IF;

  UPDATE report_jobs
  SET status = 'failed', locked_until = NULL, lock_token = NULL, last_error = p_error, updated_at = NOW()
  WHERE id = p_job_id;
  PERFORM report_job_failed_effects(j.report_id, j.free_slot);
  RETURN 'failed';
END;
$$;

-- Funkcje tylko dla service role (Supabase domyślnie nadaje EXECUTE także anon i authenticated).
REVOKE EXECUTE ON FUNCTION public.report_job_failed_effects(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_report_job(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_report_job(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_report_job(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_report_job(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_report_job(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_report_job(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_report_job(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_report_job(UUID, UUID, TEXT, INTEGER) TO service_role;

INSERT INTO ops.applied_migrations (name) VALUES ('supabase/migrations/20261020_source_cache_report_jobs.sql');

-- ── supabase/migrations/20261024_power_lines_bucket.sql ─────
-- ============================================================
-- Bucket z kaflami linii elektroenergetycznych i rurociągów (BDOT10k)
-- Zapis: tylko service role (ETL: scripts/etl/upload-power-lines.mts) — omija RLS,
-- więc nie potrzebuje polityk insert/update. Odczyt: publiczny (raport pobiera kafle).
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('power-lines', 'power-lines', true, 5242880, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read power-lines"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'power-lines');

INSERT INTO ops.applied_migrations (name) VALUES ('supabase/migrations/20261024_power_lines_bucket.sql');

-- ── supabase/migrations/20261024_utility_maps_write_policies.sql 
-- ============================================================
-- utility-maps: zapis tylko przez service role
-- Polityki z 20260529_utility_maps_bucket.sql nie miały klauzuli TO, więc obejmowały
-- role anon i authenticated: każdy z publicznym kluczem anon mógł wgrać albo
-- podmienić obraz mapy pokazywany w raportach. Aplikacja zapisuje mapy kluczem
-- service role (src/lib/utility-map.ts), który omija RLS — polityki są zbędne.
-- ============================================================
DROP POLICY IF EXISTS "Service insert utility-maps" ON storage.objects;
DROP POLICY IF EXISTS "Service update utility-maps" ON storage.objects;

INSERT INTO ops.applied_migrations (name) VALUES ('supabase/migrations/20261024_utility_maps_write_policies.sql');

COMMIT;
