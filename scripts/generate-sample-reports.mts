/**
 * Generuje przykładowe raporty dla działek testowych do /reports-sample/ — bez bazy
 * danych i bez zapisu do Supabase Storage (mapa osadzona jako data URI).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/generate-sample-reports.mts [slug...]
 *
 * Wymaga ANTHROPIC_API_KEY (bez niego rekomendacje powstaną regułami).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { generateInsights } from '../src/lib/report/ai'
import { collectReportData } from '../src/lib/report/collect'
import { buildReportHtml } from '../src/lib/report/html'
import { generateUtilityMap } from '../src/lib/utility-map'
import { TEST_PARCELS } from '../tests/parcels'

const OUT = path.join(process.cwd(), 'reports-sample')
mkdirSync(OUT, { recursive: true })

const only = process.argv.slice(2)
const parcels = only.length ? TEST_PARCELS.filter(p => only.includes(p.slug)) : TEST_PARCELS

for (const p of parcels) {
  const t0 = Date.now()
  try {
    const data = await collectReportData(p.id, '', {
      utilityMap: (lat, lng, wkt) => generateUtilityMap(lat, lng, wkt, { storage: false }),
    })
    const ai = await generateInsights(data)
    writeFileSync(path.join(OUT, `${p.slug}.html`), buildReportHtml(data, ai))
    const { utilityMapUrl, ...rest } = data
    writeFileSync(
      path.join(OUT, `${p.slug}.json`),
      JSON.stringify({ ...rest, utilityMap: utilityMapUrl ? 'osadzona w HTML' : null, ai }, null, 2),
    )
    const st = data.sources.map(s => `${s.source.split(' –')[0]}:${s.status}`).join(' ')
    console.log(`✔ ${p.slug} (${Date.now() - t0} ms) — ${data.assessment.verdict}; AI: ${ai.model ?? 'reguły'} (odrzucono ${ai.odrzucone}); ${st}`)
  } catch (e) {
    console.error(`✘ ${p.slug}: ${e instanceof Error ? e.message : e}`)
  }
}
