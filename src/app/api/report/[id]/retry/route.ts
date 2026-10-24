import { after, NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { retryFailedReport } from '@/lib/report-retry'
import { runReportJob } from '@/lib/report-queue'
import { checkRateLimit } from '@/lib/rate-limit'

// Pierwsza próba ponowienia rusza od razu w after().
export const maxDuration = 60

const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW = 10 * 60 * 1000 // 10 min

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
  }

  const rl = checkRateLimit(`retry:${user.id}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Zbyt wiele ponowień. Poczekaj kilka minut i spróbuj jeszcze raz.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  const supabaseService = await createServiceClient()
  const result = await retryFailedReport(supabaseService, { reportId: id, userId: user.id })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  after(() => runReportJob(supabaseService, id))
  return NextResponse.json({ reportId: id, status: 'generating' })
}
