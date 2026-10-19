import type { SupabaseClient } from '@supabase/supabase-js'

// Generowanie trwa < 1 min; po tym czasie funkcja na pewno już nie żyje
// (timeout platformy), więc raport nie ma szans się zakończyć.
export const STUCK_AFTER_MS = 5 * 60 * 1000

interface ReportRow {
  id: string
  status: string
  created_at: string
}

/**
 * Zwraca faktyczny status raportu. Raport wiszący w „generating” dłużej niż
 * STUCK_AFTER_MS oznaczamy jako „failed”, żeby użytkownik nie czekał w nieskończoność.
 */
export async function resolveReportStatus(svc: SupabaseClient, report: ReportRow): Promise<string> {
  if (report.status !== 'generating') return report.status
  if (Date.now() - new Date(report.created_at).getTime() <= STUCK_AFTER_MS) return report.status

  // Raport płatny zaczyna się generować dopiero po webhooku Stripe — liczymy od płatności.
  const { data: payment } = await svc
    .from('payments')
    .select('created_at')
    .eq('report_id', report.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const startedAt = Math.max(
    new Date(report.created_at).getTime(),
    payment ? new Date(payment.created_at).getTime() : 0,
  )
  if (Date.now() - startedAt <= STUCK_AFTER_MS) return report.status

  await svc.from('reports').update({ status: 'failed' }).eq('id', report.id).eq('status', 'generating')
  return 'failed'
}
