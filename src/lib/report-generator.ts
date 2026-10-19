import { createServiceClient } from './supabase/server'
import { generateInsights } from './report/ai'
import { collectReportData, type SipRow } from './report/collect'
import { buildReportHtml } from './report/html'
import { generateUtilityMap } from './utility-map'

export async function generateReport(
  parcelId: string,
  gmina: string,
  _userId: string,
  reportId: string,
): Promise<string> {
  const supabase = await createServiceClient()

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

  const insights = await generateInsights(data)
  const html = buildReportHtml(data, insights)

  const { error } = await supabase
    .from('reports')
    .update({ html_content: html, status: 'completed' })
    .eq('id', reportId)
  if (error) throw new Error(`Zapis raportu nie powiódł się: ${error.message}`)

  return html
}
