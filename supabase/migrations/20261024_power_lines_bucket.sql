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
