import { after, NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { drainReportJobs } from '@/lib/report-queue'
import { pruneSourceCache } from '@/lib/source-cache'

export const maxDuration = 60

/**
 * Cron kolejki raportów: wykonuje zadania, na które nikt nie czeka (np. płatny raport,
 * którego pierwsza próba padła po zamknięciu karty), i czyści przeterminowany cache.
 * Wywoływany co 5 min przez netlify/functions/report-jobs-cron.mts; format nagłówka
 * jest zgodny z Vercel Cron (Authorization: Bearer CRON_SECRET).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
  }

  const svc = await createServiceClient()
  // Odpowiadamy od razu — wywołujący (funkcja zaplanowana) ma krótszy limit czasu niż ta trasa.
  after(async () => {
    const outcomes = await drainReportJobs(svc, { budgetMs: (maxDuration - 5) * 1000 })
    if (outcomes.length) console.log('[cron] zadania:', outcomes.join(', '))
    await pruneSourceCache(svc)
  })
  return NextResponse.json({ ok: true })
}
