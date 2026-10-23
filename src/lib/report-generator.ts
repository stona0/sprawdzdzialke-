import { createHash } from 'node:crypto'
import { createServiceClient } from './supabase/server'
import { cached } from './http'
import { AI_MODEL, buildFacts, generateInsights } from './report/ai'
import { collectReportData, type SipRow } from './report/collect'
import { buildReportHtml } from './report/html'
import { enablePersistentCache } from './source-cache'
import { generateUtilityMap } from './utility-map'

const AI_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function generateReport(
  parcelId: string,
  gmina: string,
  _userId: string,
  reportId: string,
): Promise<string> {
  const supabase = await createServiceClient()
  enablePersistentCache(supabase)

  const data = await collectReportData(parcelId, gmina, {
    sipLookup: async (name: string) => {
      const { data: row } = await supabase
        .from('sip_layers')
        .select('wodociag, kanalizacja, gaz, energia, uwagi')
        .ilike('gmina_nazwa', name.replace(/\s*\(.*\)\s*/g, '').trim())
        .maybeSingle()
      return (row as SipRow | null) ?? null
    },
    utilityMap: (lat, lng, wkt) => generateUtilityMap(lat, lng, wkt),
  })

  // Te same fakty → te same rekomendacje; ponowna generacja nie płaci drugi raz za wywołanie modelu.
  // Rekomendacji z reguł (AI niedostępne) nie zapisujemy — następnym razem spróbujemy AI.
  const factsHash = createHash('sha256').update(JSON.stringify(buildFacts(data))).digest('hex').slice(0, 32)
  const insights = await cached(`ai:${AI_MODEL}:${factsHash}`, AI_TTL_MS, () => generateInsights(data), i => i.model !== null)
  const html = buildReportHtml(data, insights)

  const { error } = await supabase
    .from('reports')
    .update({ html_content: html, status: 'completed' })
    .eq('id', reportId)
  if (error) throw new Error(`Zapis raportu nie powiódł się: ${error.message}`)

  return html
}
