import type { SupabaseClient } from '@supabase/supabase-js'
import { getReportJob, isJobDue } from './report-queue'

// Raporty sprzed kolejki (bez wiersza w report_jobs): generowanie trwa < 1 min,
// więc po tym czasie funkcja na pewno już nie żyje.
export const STUCK_AFTER_MS = 5 * 60 * 1000

interface ReportRow {
  id: string
  status: string
  created_at: string
}

export interface ReportState {
  status: string
  /** Zadanie czeka na workera — wywołujący powinien uruchomić runReportJob w after(). */
  kick: boolean
}

/**
 * Faktyczny status raportu. Dla raportu w kolejce mówi też, czy trzeba wznowić
 * zadanie (np. po przerwanej funkcji) — dzięki temu polling użytkownika jest
 * zarazem mechanizmem ponawiania.
 */
export async function resolveReportStatus(svc: SupabaseClient, report: ReportRow): Promise<ReportState> {
  if (report.status !== 'generating') return { status: report.status, kick: false }

  const job = await getReportJob(svc, report.id)
  if (job) {
    // Porażkę zapisujemy atomowo z raportem; tu tylko nie czekamy na następny odczyt.
    if (job.status === 'failed') return { status: 'failed', kick: false }
    return { status: 'generating', kick: isJobDue(job) }
  }

  if (Date.now() - new Date(report.created_at).getTime() <= STUCK_AFTER_MS) return { status: report.status, kick: false }

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
  if (Date.now() - startedAt <= STUCK_AFTER_MS) return { status: report.status, kick: false }

  await svc.from('reports').update({ status: 'failed' }).eq('id', report.id).eq('status', 'generating')
  return { status: 'failed', kick: false }
}
