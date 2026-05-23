import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/report-generator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
    }

    const { parcelId, gmina } = await request.json()
    if (!parcelId || !gmina) {
      return NextResponse.json({ error: 'Brak parcelId lub gmina' }, { status: 400 })
    }

    const supabaseService = await createServiceClient()

    const { data: profile_data } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    let profile = profile_data

    if (!profile) {
      const { data: newProfile, error: insertError } = await supabaseService
        .from('profiles')
        .insert({ user_id: user.id, email: user.email ?? '', role: 'user', free_reports_used: 0 })
        .select()
        .single()
      profile = newProfile
    }

    if (!profile) {
      return NextResponse.json({ error: 'Nie udało się utworzyć profilu' }, { status: 500 })
    }

    const { data: canGenerateFree, error: claimError } = await supabaseService
      .rpc('claim_free_report', { uid: user.id })

    if (claimError) {
      console.error('claim_free_report error:', JSON.stringify(claimError))
      return NextResponse.json(
        { error: 'Błąd sprawdzania darmowego raportu' },
        { status: 500 }
      )
    }

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
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
