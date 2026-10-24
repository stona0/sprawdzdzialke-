/**
 * Wgrywa wynik ETL (scripts/etl/bdot-power-lines.mts) do publicznego bucketu Storage
 * `power-lines` (migracja 20261024_power_lines_bucket.sql).
 *
 *   ETL_SUPABASE_URL=https://<projekt>.supabase.co ETL_SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx --tsconfig tsconfig.json scripts/etl/upload-power-lines.mts [--dir data/power-lines] --yes
 *
 * Celowo inne zmienne niż aplikacji: NEXT_PUBLIC_SUPABASE_URL w .env.local wskazuje
 * produkcję, a wgranie danych ma być świadomą decyzją (cel + --yes).
 * Kolejność: najpierw wszystkie kafle nowej wersji (ścieżka z wersją, więc nie
 * nadpisują danych używanych przez raporty), na końcu current.json — raporty
 * przełączają się na nową wersję dopiero, gdy jest komplet.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PowerManifest } from '../../src/lib/power-lines'

export const BUCKET = 'power-lines'

export async function uploadPowerLines(
  svc: SupabaseClient,
  dir: string,
  { concurrency = 8, log = console.log }: { concurrency?: number; log?: (m: string) => void } = {},
): Promise<{ version: string; files: number }> {
  const manifestBody = await readFile(path.join(dir, 'current.json'), 'utf8')
  const m = JSON.parse(manifestBody) as PowerManifest
  const files = m.tiles.map(k => `${m.version}/${k}.json`)

  const put = async (rel: string, body: string, cacheControl: string) => {
    const { error } = await svc.storage.from(BUCKET).upload(rel, body, { contentType: 'application/json', upsert: true, cacheControl })
    if (error) throw new Error(`${rel}: ${error.message}`)
  }

  const queue = [...files]
  let done = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let rel = queue.shift(); rel; rel = queue.shift()) {
      // Ścieżki z wersją się nie zmieniają — CDN może je trzymać długo.
      await put(rel, await readFile(path.join(dir, rel), 'utf8'), '31536000')
      if (++done % 500 === 0) log(`  ${done}/${files.length}`)
    }
  }))
  await put('current.json', manifestBody, '300')
  return { version: m.version, files: files.length + 1 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--dir')
  const dir = i >= 0 ? process.argv[i + 1] : 'data/power-lines'
  const url = process.env.ETL_SUPABASE_URL
  const key = process.env.ETL_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Ustaw ETL_SUPABASE_URL i ETL_SUPABASE_SERVICE_ROLE_KEY (projekt docelowy).')
    process.exit(1)
  }
  console.log(`Cel: ${new URL(url).host}, bucket ${BUCKET}, katalog ${dir}`)
  if (!process.argv.includes('--yes')) {
    console.error('Dodaj --yes, aby potwierdzić wgranie do tego projektu.')
    process.exit(1)
  }
  const svc = createClient(url, key, { auth: { persistSession: false } })
  const r = await uploadPowerLines(svc, dir)
  console.log(`Wgrano wersję ${r.version}: ${r.files} plików`)
}
