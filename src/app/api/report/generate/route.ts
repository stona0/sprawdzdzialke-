import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/report-generator'
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { validateParcelId, validateGmina, sanitize } from '@/lib/validation'

// Rate limit: max 5 raportów na 10 minut per user
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 10 * 60 * 1000 // 10 min

export async function POST(request: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
    }

    // ── Rate limit ──────────────────────────────────────────────────
    const rlKey = getRateLimitKey(user.id, request)
    const rl = checkRateLimit(rlKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Zbyt wiele zapytań. Poczekaj kilka minut i spróbuj ponownie.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    // ── Input validation ────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Nieprawidłowy JSON' }, { status: 400 })
    }

    const parcelIdRaw = body.parcelId
    const gminaRaw = body.gmina

    const parcelIdError = validateParcelId(parcelIdRaw)
    if (parcelIdError) {
      return NextResponse.json({ error: parcelIdError }, { status: 400 })
    }

    const gminaError = validateGmina(gminaRaw)
    if (gminaError) {
      return NextResponse.json({ error: gminaError }, { status: 400 })
    }

    const parcelId = sanitize(parcelIdRaw as string, 60)
    const gmina = sanitize(gminaRaw as string, 100)

    // ── Profile ─────────────────────────────────────────────────────
    const supabaseService = await createServiceClient()

    const { data: profile_data } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    let profile = profile_data

    if (!profile) {
      const { data: newProfile } = await supabaseService
        .from('profiles')
        .insert({ user_id: user.id, email: user.email ?? '', role: 'user', free_reports_used: 0 })
        .select()
        .single()
      profile = newProfile
    }

    if (!profile) {
      return NextResponse.json({ error: 'Nie udało się utworzyć profilu' }, { status: 500 })
    }

    const canGenerateFree = profile.free_reports_used === 0 || profile.role === 'admin'

    // ── Create report ───────────────────────────────────────────────
    const { data: report, error: reportError } = await supabaseService
      .from('reports')
      .insert({
        user_id: user.id,
        parcel_id: parcelId,
        gmina,
        status: 'generating',
        paid: canGenerateFree,
      })
      .select()
      .single()

    if (reportError || !report) {
      console.error('Report insert error:', JSON.stringify(reportError))
      return NextResponse.json({ error: 'Nie udało się utworzyć raportu' }, { status: 500 })
    }

    if (!canGenerateFree) {
      await supabaseService
        .from('reports')
        .update({ status: 'pending' })
        .eq('id', report.id)

      return NextResponse.json({ requiresPayment: true, reportId: report.id })
    }

    // ── Generate ────────────────────────────────────────────────────
    try {
      await generateReport(parcelId, gmina, user.id, report.id)
      return NextResponse.json({ reportId: report.id, status: 'completed' })
    } catch (err) {
      await supabaseService
        .from('reports')
        .update({ status: 'failed' })
        .eq('id', report.id)

      const message = err instanceof Error ? err.message : 'Błąd generowania raportu'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (err) {
    console.error('Unhandled error in /api/report/generate:', err)
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 })
  }
}
