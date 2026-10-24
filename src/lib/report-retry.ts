/**
 * Ponowienie raportu, którego generowanie ostatecznie się nie udało — bez opłaty,
 * bo błąd jest po naszej stronie (decyzja właściciela, 2026-10-23).
 *
 * Darmowa pula: przy ostatecznej porażce kolejka zwraca użytkownikowi darmowy raport
 * (report_job_failed_effects). Ponawiając, zajmujemy go z powrotem; jeśli zdążył go
 * już wykorzystać na inną działkę, ponawiamy mimo to, ale zadanie przestaje być
 * „darmowe” — inaczej kolejna porażka oddałaby mu drugi darmowy raport.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { enqueueReport, getReportJob } from './report-queue'
import { resolveReportStatus } from './report-status'

export type RetryResult =
  | { ok: true }
  | { ok: false; status: 404 | 409 | 500; error: string }

export async function retryFailedReport(
  svc: SupabaseClient,
  { reportId, userId }: { reportId: string; userId: string },
): Promise<RetryResult> {
  const { data: report } = await svc
    .from('reports')
    .select('id, status, paid, created_at')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!report) return { ok: false, status: 404, error: 'Nie znaleziono raportu' }

  const { status } = await resolveReportStatus(svc, report)
  if (status !== 'failed') return { ok: false, status: 409, error: 'Ten raport nie wymaga ponowienia.' }
  // paid = prawo do raportu (darmowy, admin albo opłacony przez Stripe)
  if (!report.paid) return { ok: false, status: 409, error: 'Ten raport nie został opłacony.' }

  // Warunkowa zmiana statusu jest blokadą: z dwóch równoczesnych kliknięć przejdzie jedno.
  const { data: locked } = await svc
    .from('reports')
    .update({ status: 'generating' })
    .eq('id', reportId)
    .eq('status', 'failed')
    .select('id')
  if (!locked?.length) return { ok: false, status: 409, error: 'Ponowienie już trwa.' }

  const job = await getReportJob(svc, reportId)
  let freeSlot = false
  if (job?.free_slot) {
    const { data: claimed } = await svc
      .from('profiles')
      .update({ free_reports_used: 1 })
      .eq('user_id', userId)
      .eq('free_reports_used', 0)
      .select('user_id')
    freeSlot = (claimed?.length ?? 0) > 0
    if (!freeSlot) await svc.from('report_jobs').update({ free_slot: false }).eq('report_id', reportId)
  }

  try {
    // Zadanie, które ostatecznie padło, enqueue_report_job uruchamia od nowa (licznik prób od zera).
    await enqueueReport(svc, reportId, { freeSlot })
  } catch (err) {
    console.error('[retry] enqueue failed:', err)
    await svc.from('reports').update({ status: 'failed' }).eq('id', reportId).eq('status', 'generating')
    if (freeSlot) {
      await svc.from('profiles').update({ free_reports_used: 0 }).eq('user_id', userId).eq('free_reports_used', 1)
    }
    return { ok: false, status: 500, error: 'Nie udało się ponowić generowania raportu.' }
  }
  return { ok: true }
}
