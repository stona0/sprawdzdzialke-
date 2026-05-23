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
