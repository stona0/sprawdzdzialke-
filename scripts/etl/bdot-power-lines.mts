/**
 * ETL: linie elektroenergetyczne (OT_SULN_L) i rurociągi (OT_SUPR_L) z paczek powiatowych
 * BDOT10k (GUGiK, schemat 2021) → kafle JSON 10 × 10 km w EPSG:2180 + manifest.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/etl/bdot-power-lines.mts [--out data/power-lines] [--powiaty 0223,1261] [--concurrency 3]
 *
 * Wynik: <out>/<wersja>/<kafel>.json oraz <out>/current.json (manifest z listą kafli
 * i datami aktualizacji powiatów). Cały kraj to ~380 paczek, ~11 GB pobrania (serwer
 * nie obsługuje Range, więc paczka jest pobierana w całości i od razu usuwana).
 * Gdy któryś powiat nie da się przetworzyć, skrypt kończy się błędem i nie zapisuje
 * current.json — niepełny zbiór dawałby fałszywe „brak linii” (chyba że --allow-partial).
 * Wymaga programu `unzip`. Wgranie do Storage: scripts/etl/upload-power-lines.mts.
 */
import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { addToTiles, FORMAT_VERSION, parseBdotXml, TILE_M, type PowerManifest, type TileFeature } from '../../src/lib/power-lines'

const run = promisify(execFile)
const INDEX_URL = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WFS/PobieranieBDOT10k?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:BDOT10k_powiaty&PROPERTYNAME=ms:TERYT,ms:NAZWA_POWIATU,ms:Data_aktualizacji,ms:URL_GML'
const UA = 'SprawdzDzialke-ETL/1.0 (+https://sprawdzdzialke.com)'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const OUT = arg('out') ?? 'data/power-lines'
const ONLY = arg('powiaty')?.split(',').map(s => s.trim()).filter(Boolean)
const CONCURRENCY = Number(arg('concurrency') ?? 3)
const ALLOW_PARTIAL = process.argv.includes('--allow-partial')

interface Powiat { teryt: string; nazwa: string; data: string; url: string }

async function index(): Promise<Powiat[]> {
  const res = await fetch(INDEX_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`Indeks BDOT10k: HTTP ${res.status}`)
  const xml = await res.text()
  const get = (f: string, tag: string) => f.match(new RegExp(`<ms:${tag}>([^<]*)</ms:${tag}>`))?.[1]?.trim() ?? ''
  return [...xml.matchAll(/<ms:BDOT10k_powiaty\b[\s\S]*?<\/ms:BDOT10k_powiaty>/g)].map(([f]) => ({
    teryt: get(f, 'TERYT'), nazwa: get(f, 'NAZWA_POWIATU'), data: get(f, 'Data_aktualizacji').slice(0, 10), url: get(f, 'URL_GML'),
  })).filter(p => /^\d{4}$/.test(p.teryt) && p.url.startsWith('https://'))
}

async function download(url: string, file: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15 * 60_000) })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(file))
      return
    } catch (e) {
      if (attempt >= 3) throw e
      await new Promise(r => setTimeout(r, 5000 * attempt))
    }
  }
}

async function entry(zip: string, cls: 'SULN' | 'SUPR'): Promise<string> {
  try {
    const { stdout } = await run('unzip', ['-p', zip, `*OT_${cls}_L.xml`], { maxBuffer: 1024 * 1024 * 1024, encoding: 'utf8' })
    return stdout
  } catch (e) {
    // unzip zwraca 11, gdy w paczce nie ma pliku klasy (powiat bez obiektów tej klasy)
    if ((e as { code?: number }).code === 11) return ''
    throw e
  }
}

async function processPowiat(p: Powiat, tmp: string) {
  const zip = path.join(tmp, `${p.teryt}.zip`)
  try {
    await download(p.url, zip)
    const lines = parseBdotXml(await entry(zip, 'SULN'), 'SULN', p.teryt)
    const pipes = parseBdotXml(await entry(zip, 'SUPR'), 'SUPR', p.teryt)
    return { features: [...lines.features, ...pipes.features], skipped: lines.skipped + pipes.skipped }
  } finally {
    await rm(zip, { force: true })
  }
}

const t0 = Date.now()
const all = await index()
const powiaty = ONLY ? all.filter(p => ONLY.includes(p.teryt)) : all
if (ONLY && powiaty.length !== ONLY.length) {
  console.error(`Nieznane powiaty: ${ONLY.filter(t => !powiaty.some(p => p.teryt === t)).join(', ')}`)
  process.exit(1)
}
console.log(`Powiatów do przetworzenia: ${powiaty.length} z ${all.length}`)

const tmp = await mkdtemp(path.join(tmpdir(), 'bdot-'))
const tiles = new Map<string, TileFeature[]>()
const counts: Record<string, number> = {}
const failed: string[] = []
let skipped = 0
let done = 0

const queue = [...powiaty]
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let p = queue.shift(); p; p = queue.shift()) {
    try {
      const r = await processPowiat(p, tmp)
      addToTiles(tiles, r.features)
      for (const f of r.features) counts[f.t] = (counts[f.t] ?? 0) + 1
      skipped += r.skipped
      console.log(`[${++done}/${powiaty.length}] ${p.teryt} ${p.nazwa} (${p.data}): ${r.features.length} obiektów`)
    } catch (e) {
      failed.push(p.teryt)
      console.error(`[${++done}/${powiaty.length}] ${p.teryt} ${p.nazwa}: BŁĄD ${e instanceof Error ? e.message : e}`)
    }
  }
}))
await rm(tmp, { recursive: true, force: true })

if (failed.length && !ALLOW_PARTIAL) {
  console.error(`Nieudane powiaty (${failed.length}): ${failed.join(', ')} — nie zapisuję zbioru. Uruchom ponownie albo użyj --allow-partial.`)
  process.exit(1)
}

const version = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const dir = path.join(OUT, version)
await mkdir(dir, { recursive: true })
let bytes = 0
for (const [key, f] of tiles) {
  const body = JSON.stringify({ v: FORMAT_VERSION, f })
  bytes += body.length
  await writeFile(path.join(dir, `${key}.json`), body)
}
const included = powiaty.filter(p => !failed.includes(p.teryt))
const manifest: PowerManifest & { stats: Record<string, unknown> } = {
  v: FORMAT_VERSION,
  version,
  generatedAt: new Date().toISOString(),
  tileM: TILE_M,
  tiles: [...tiles.keys()].sort(),
  powiaty: Object.fromEntries(included.map(p => [p.teryt, { nazwa: p.nazwa, data: p.data }])),
  stats: { counts, skipped, failed, tiles: tiles.size, bytes },
}
await writeFile(path.join(OUT, 'current.json'), JSON.stringify(manifest))
console.log(`Gotowe w ${Math.round((Date.now() - t0) / 1000)} s: ${JSON.stringify(manifest.stats)} → ${dir}`)
