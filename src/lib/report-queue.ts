/**
 * Kolejka generowania raportów na tabeli report_jobs (migracja 20261020).
 *
 * Zadanie zajmuje worker na czas dzierżawy (LEASE_SECONDS). Worker startuje:
 *  - od razu po utworzeniu zadania (after() w trasie generate / webhooku Stripe),
 *  - przy pollingu statusu przez użytkownika, gdy zadanie czeka albo dzierżawa wygasła,
 *  - z crona (/api/cron/report-jobs) — dla zadań, na które nikt nie czeka.
 * Jeśli platforma przerwie funkcję, kolejna próba korzysta z trwałego cache źródeł,
 * więc nie zaczyna od zera.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { ParcelNotFoundError } from './report/collect'
import { buildReport, type BuiltReport } from './report-generator'

/** Musi przekraczać maxDuration tras, które uruchamiają worker (60 s). */
export const LEASE_SECONDS = 90
/** Opóźnienie ponowienia po 1., 2. i 3. nieudanej próbie. */
export const RETRY_DELAYS_S = [15, 60, 180]
/** Ponowienie, gdy źródło kluczowe dla werdyktu nie odpowiedziało (tylko po pierwszej próbie). */
export const DEGRADED_RETRY_S = 20

export interface ReportJob {
  id: string
  report_id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  free_slot: boolean
  attempts: number
  max_attempts: number
  run_after: string
  locked_until: string | null
  lock_token: string | null
  last_error: string | null
  created_at: string
}

export type JobOutcome = 'none' | 'done' | 'retry' | 'failed' | 'lost'

type Builder = (parcelId: string, gmina: string, svc: SupabaseClient) => Promise<BuiltReport>

/** Raport bez kluczowych danych — wart jeszcze jednej próby, zanim go oddamy. */
class DegradedReportError extends Error {}

export async function enqueueReport(svc: SupabaseClient, reportId: string, { freeSlot }: { freeSlot: boolean }): Promise<ReportJob> {
  const { data, error } = await svc.rpc('enqueue_report_job', { p_report_id: reportId, p_free_slot: freeSlot })
  const job = (data as ReportJob[] | null)?.[0]
  if (error || !job) throw new Error(`Nie udało się dodać zadania do kolejki: ${error?.message ?? 'brak wiersza'}`)
  return job
}

export async function getReportJob(svc: SupabaseClient, reportId: string): Promise<ReportJob | null> {
  const { data } = await svc.from('report_jobs').select('*').eq('report_id', reportId).maybeSingle<ReportJob>()
  return data ?? null
}

/** Czy zadanie czeka na workera (termin minął, nikt nie trzyma dzierżawy). */
export function isJobDue(job: ReportJob, now = Date.now()): boolean {
  return (job.status === 'queued' || job.status === 'running')
    && Date.parse(job.run_after) <= now
    && (!job.locked_until || Date.parse(job.locked_until) < now)
}

function criticalSourceFailed(r: BuiltReport): boolean {
  return r.data.mpzp.status === 'error' || r.data.pog.inForce === null
}

/**
 * Zajmuje jedno zadanie (konkretnego raportu albo dowolne gotowe) i je wykonuje.
 * Nie rzuca — wynik opisuje, co się stało.
 */
export async function processNextReportJob(
  svc: SupabaseClient,
  { reportId, build = buildReport }: { reportId?: string; build?: Builder } = {},
): Promise<{ outcome: JobOutcome; job?: ReportJob; error?: string }> {
  const { data, error: claimErr } = await svc.rpc('claim_report_job', { p_report_id: reportId ?? null, p_lease_seconds: LEASE_SECONDS })
  if (claimErr) {
    console.error('[queue] claim nieudany:', claimErr.message)
    return { outcome: 'none', error: claimErr.message }
  }
  const job = (data as ReportJob[] | null)?.[0]
  if (!job) return { outcome: 'none' }

  try {
    const { data: report, error: repErr } = await svc.from('reports').select('parcel_id, gmina').eq('id', job.report_id).single()
    if (repErr || !report) throw new Error(`Brak raportu ${job.report_id}: ${repErr?.message}`)

    const built = await build(report.parcel_id, report.gmina, svc)
    if (criticalSourceFailed(built) && job.attempts === 1) {
      throw new DegradedReportError('Źródło MPZP lub planu ogólnego nie odpowiedziało')
    }

    const { data: ok, error } = await svc.rpc('complete_report_job', { p_job_id: job.id, p_token: job.lock_token, p_html: built.html })
    if (error) throw new Error(`Zapis raportu nie powiódł się: ${error.message}`)
    if (!ok) console.warn(`[queue] zadanie ${job.id}: dzierżawę przejął inny worker, wynik pominięty`)
    return { outcome: ok ? 'done' : 'lost', job }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const retryIn =
      e instanceof ParcelNotFoundError ? null
        : e instanceof DegradedReportError ? DEGRADED_RETRY_S
          : RETRY_DELAYS_S[Math.min(job.attempts, RETRY_DELAYS_S.length) - 1]
    const { data: next, error } = await svc.rpc('fail_report_job', {
      p_job_id: job.id, p_token: job.lock_token, p_error: msg.slice(0, 1000), p_retry_seconds: retryIn,
    })
    if (error) console.error(`[queue] fail_report_job nieudany (zadanie wróci po wygaśnięciu dzierżawy): ${error.message}`)
    console.warn(`[queue] raport ${job.report_id}, próba ${job.attempts}/${job.max_attempts}: ${msg} → ${next ?? 'bez zmian'}`)
    const outcome: JobOutcome = next === 'failed' ? 'failed' : next === 'lost' ? 'lost' : 'retry'
    return { outcome, job, error: msg }
  }
}

/** Do after(): wykonuje zadanie raportu, łapiąc wszystko, co mogłoby wyciec. */
export async function runReportJob(svc: SupabaseClient, reportId: string): Promise<void> {
  try {
    await processNextReportJob(svc, { reportId })
  } catch (e) {
    console.error('[queue] nieoczekiwany błąd workera:', e)
  }
}

/** Dla crona: wykonuje gotowe zadania po kolei, dopóki starcza czasu. */
export async function drainReportJobs(svc: SupabaseClient, { budgetMs, maxJobs = 5 }: { budgetMs: number; maxJobs?: number }) {
  const t0 = Date.now()
  const outcomes: JobOutcome[] = []
  // Zadanie trwa do ~40 s; nie zaczynamy nowego, jeśli może nie zdążyć.
  while (outcomes.length < maxJobs && Date.now() - t0 < budgetMs - 40_000) {
    const { outcome } = await processNextReportJob(svc)
    if (outcome === 'none') break
    outcomes.push(outcome)
  }
  return outcomes
}
