import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import DashboardClient from '@/components/forms/DashboardClient'
import { AppHeader } from '@/components/layout/AppHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PayButton } from '@/components/report/PayButton'
import { RetryButton } from '@/components/report/RetryButton'
import { describeParcelId } from '@/lib/parcel-label'
import { REPORT_PRICE_LABEL } from '@/lib/pricing'
import { resolveReportStatus } from '@/lib/report-status'

export const metadata: Metadata = {
  title: 'Moje raporty',
  robots: { index: false },
}

interface ReportRow {
  id: string
  parcel_id: string
  gmina: string
  status: string
  created_at: string
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw',
})

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const supabaseService = await createServiceClient()

  const { data: profile } = await supabaseService
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: rows } = await supabaseService
    .from('reports')
    .select('id, parcel_id, gmina, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Płatności przyjęte przez webhook — raport „pending” z taką płatnością nie dostaje przycisku „Zapłać”.
  const { data: paidRows } = await supabaseService
    .from('payments')
    .select('report_id')
    .eq('user_id', user.id)
    .eq('status', 'paid')
  const paidReports = new Set((paidRows ?? []).map(p => p.report_id as string))

  // „W trakcie” może znaczyć porzucone generowanie — faktyczny stan liczy resolveReportStatus.
  const reports: ReportRow[] = await Promise.all(
    (rows ?? []).map(async r => (r.status === 'generating' ? { ...r, status: (await resolveReportStatus(supabaseService, r)).status } : r)),
  )

  const hasFreeReport = (profile?.free_reports_used ?? 0) === 0

  return (
    <main className="min-h-screen bg-white">
      <AppHeader email={user.email} isAdmin={profile?.role === 'admin'} />

      <div className="mx-auto max-w-5xl space-y-14 px-4 py-10 sm:px-6 sm:py-12">
        <div>
          <h1 className="font-playfair text-3xl text-gray-900 sm:text-4xl">Sprawdź działkę</h1>
          <p className="mt-2 text-muted-foreground">
            {hasFreeReport
              ? 'Masz 1 darmowy raport — skorzystaj teraz.'
              : `Każdy raport kosztuje ${REPORT_PRICE_LABEL}.`}
          </p>
        </div>

        <DashboardClient hasFreeReport={hasFreeReport} userId={user.id} />

        <section aria-labelledby="moje-raporty">
          <h2 id="moje-raporty" className="mb-6 font-playfair text-2xl text-gray-900">Moje raporty</h2>

          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
              <FileText className="mb-4 h-10 w-10 text-gray-300" aria-hidden />
              <p className="text-muted-foreground">Brak raportów — sprawdź swoją pierwszą działkę powyżej.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {reports.map(report => (
                <ReportItem key={report.id} report={report} paid={paidReports.has(report.id)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

function ReportItem({ report, paid }: { report: ReportRow; paid: boolean }) {
  const { numer, obreb, arkusz } = describeParcelId(report.parcel_id)
  return (
    <li className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-gray-900">
          Działka {numer}
          {obreb && <span className="font-normal text-muted-foreground"> · obręb {obreb}{arkusz && `, ark. ${arkusz}`}</span>}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {report.gmina} · <time dateTime={report.created_at}>{dateFormat.format(new Date(report.created_at))}</time>
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={report.parcel_id}>{report.parcel_id}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
        <ReportActions report={report} paid={paid} />
      </div>
    </li>
  )
}

function ReportActions({ report, paid }: { report: ReportRow; paid: boolean }) {
  switch (report.status) {
    case 'completed':
      return (
        <>
          <Badge variant="success">Gotowy</Badge>
          <Button asChild size="sm">
            <Link href={`/report/${report.id}`}>Otwórz</Link>
          </Button>
        </>
      )
    case 'generating':
      return (
        <>
          <Badge variant="muted"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />W trakcie</Badge>
          <Button asChild size="sm" variant="outline">
            <Link href={`/report/${report.id}`}>Podgląd</Link>
          </Button>
        </>
      )
    case 'pending':
      return paid ? (
        <>
          <Badge variant="warning">Płatność przyjęta</Badge>
          <span className="text-sm text-muted-foreground">Raport ruszy po potwierdzeniu płatności.</span>
        </>
      ) : (
        <>
          <Badge variant="warning">Czeka na płatność</Badge>
          <PayButton reportId={report.id} parcelId={report.parcel_id} gmina={report.gmina} />
        </>
      )
    case 'failed':
      return (
        <>
          <Badge variant="danger">Nie udało się</Badge>
          <RetryButton reportId={report.id} />
        </>
      )
    default:
      return <Badge variant="muted">{report.status}</Badge>
  }
}
