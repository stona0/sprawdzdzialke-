import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cached } from './http'
import { AI_MODEL, buildFacts, generateInsights, type AiInsights } from './report/ai'
import { collectReportData, type ReportData, type SipRow } from './report/collect'
import { buildReportHtml } from './report/html'
import { enablePersistentCache } from './source-cache'
import { generateUtilityMap } from './utility-map'

export interface BuiltReport {
  data: ReportData
  insights: AiInsights
  html: string
}

const AI_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Zbiera dane, generuje rekomendacje i składa HTML raportu. Nie zapisuje raportu —
 * robi to worker kolejki (report-queue.ts), atomowo z zamknięciem zadania.
 */
export async function buildReport(parcelId: string, gmina: string, svc: SupabaseClient): Promise<BuiltReport> {
  enablePersistentCache(svc)

  const data = await collectReportData(parcelId, gmina, {
    sipLookup: async (name: string) => {
      const { data: row } = await svc
        .from('sip_layers')
        .select('wodociag, kanalizacja, gaz, energia, uwagi')
        .ilike('gmina_nazwa', name.replace(/\s*\(.*\)\s*/g, '').trim())
        .maybeSingle()
      return (row as SipRow | null) ?? null
    },
    utilityMap: (lat, lng, wkt) => generateUtilityMap(lat, lng, wkt),
  })

  // Te same fakty → te same rekomendacje; ponowiona próba nie płaci drugi raz za wywołanie modelu.
  // Rekomendacji z reguł (AI niedostępne) nie zapisujemy — następnym razem spróbujemy AI.
  const factsHash = createHash('sha256').update(JSON.stringify(buildFacts(data))).digest('hex').slice(0, 32)
  const insights = await cached(`ai:${AI_MODEL}:${factsHash}`, AI_TTL_MS, () => generateInsights(data), { shouldCache: i => i.model !== null })

  return { data, insights, html: buildReportHtml(data, insights) }
}
