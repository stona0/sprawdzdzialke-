import { after } from 'next/server'
import { redirect, notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ReportView from '@/components/report/ReportView'
import { resolveReportStatus } from '@/lib/report-status'
import { runReportJob } from '@/lib/report-queue'

// Odświeżanie strony może wznowić przerwane zadanie kolejki (after() poniżej).
export const maxDuration = 60

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // service role omija problem z odświeżaniem tokena przy RLS
  const supabaseService = await createServiceClient()
  const { data: report } = await supabaseService
    .from('reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!report) notFound()

  const { status, kick } = await resolveReportStatus(supabaseService, report)
  if (kick) after(() => runReportJob(supabaseService, report.id))

  return (
    <ReportView
      reportId={report.id}
      htmlContent={report.html_content}
      status={status}
      parcelId={report.parcel_id}
      gmina={report.gmina}
    />
  )
}
