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
