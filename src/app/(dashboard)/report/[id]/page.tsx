import { redirect, notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ReportView from '@/components/report/ReportView'

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

  return (
    <ReportView
      reportId={report.id}
      htmlContent={report.html_content}
      status={report.status}
      parcelId={report.parcel_id}
      gmina={report.gmina}
    />
  )
}
