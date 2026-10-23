// Szybkie sprawdzenie wdrożonego STAGINGU przez HTTP (bez logowania i bez płatności):
// strony publiczne, przekierowanie chronionych na /login, 404 dla nieznanych ścieżek,
// cron kolejki raportów (401 bez sekretu, 200 z sekretem) i kafle linii w Storage.
// Nie łączy się z adresami produkcyjnymi.
//
//   npm run staging:smoke -- .env.staging
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from './check-env.mjs'

const file = process.argv[2]
if (!file || !existsSync(file)) {
  console.error('użycie: npm run staging:smoke -- <plik ze zmiennymi stagingu, np. .env.staging>')
  process.exit(2)
}
const env = parseEnv(readFileSync(file, 'utf8'))
const base = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
if (!base) { console.error('brak NEXT_PUBLIC_APP_URL'); process.exit(2) }
if (/(^|\.)sprawdzdzialke\.(com|pl)$/.test(new URL(base).hostname) && !/staging/.test(base)) {
  console.error('NEXT_PUBLIC_APP_URL wygląda na adres produkcyjny — przerwano.')
  process.exit(2)
}

const get = (path, init = {}) => fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(30_000), ...init })
const checks = [
  ['strona główna 200', async () => (await get('/')).status === 200],
  ['/login 200', async () => (await get('/login')).status === 200],
  ['/dashboard bez sesji → /login', async () => { const r = await get('/dashboard'); return [302, 303, 307, 308].includes(r.status) && /\/login/.test(r.headers.get('location') ?? '') }],
  ['/api/report/x/status bez sesji → /login', async () => { const r = await get('/api/report/00000000-0000-0000-0000-000000000000/status'); return [302, 303, 307, 308].includes(r.status) && /\/login/.test(r.headers.get('location') ?? '') }],
  ['nieznana ścieżka → 404', async () => (await get('/nie-ma-takiej-strony-staging')).status === 404],
  ['cron bez sekretu → 401', async () => (await get('/api/cron/report-jobs')).status === 401],
  ['cron z CRON_SECRET → 200', async () => {
    if (!env.CRON_SECRET) return 'brak CRON_SECRET w pliku'
    const r = await get('/api/cron/report-jobs', { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })
    return r.status === 200 || `HTTP ${r.status}`
  }],
  ['kafle linii BDOT10k w Storage (opcjonalne)', async () => {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) return 'brak NEXT_PUBLIC_SUPABASE_URL'
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/power-lines/current.json`, { signal: AbortSignal.timeout(30_000) })
    return r.status === 200 || `brak (HTTP ${r.status}) — raport użyje OSM; wgraj kafle: npm run etl:power-lines:upload`
  }],
]

let failed = 0
for (const [name, fn] of checks) {
  let res
  try { res = await fn() } catch (e) { res = e instanceof Error ? e.message : String(e) }
  const optional = name.includes('opcjonalne')
  if (res !== true && !optional) failed++
  console.log(`${res === true ? '✔' : optional ? '–' : '✘'} ${name}${res === true ? '' : `: ${res === false ? 'nie' : res}`}`)
}
console.log(failed ? `\n${failed} sprawdzeń nie przeszło.` : '\nStaging odpowiada poprawnie. Dalej: scenariusz ręczny z docs/STAGING.md.')
process.exit(failed ? 1 : 0)
