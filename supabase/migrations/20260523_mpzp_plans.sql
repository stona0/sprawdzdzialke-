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
