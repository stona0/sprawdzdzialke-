import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PaymentSuccessClient from './PaymentSuccessClient'

interface Props {
  searchParams: Promise<{ session_id?: string; report?: string }>
}

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const { session_id, report } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Jeśli nie ma parametrów – wróć do dashboardu
  if (!session_id && !report) redirect('/dashboard')

  // Pobierz raport jeśli jest ID
  const reportData = report
    ? await supabase
        .from('reports')
        .select('id, parcel_id, gmina, status')
        .eq('id', report)
        .eq('user_id', user.id)
        .single()
        .then(r => r.data)
    : null

  return (
    <PaymentSuccessClient
      reportId={report ?? null}
      parcelId={reportData?.parcel_id ?? null}
      gmina={reportData?.gmina ?? null}
      initialStatus={reportData?.status ?? null}
    />
  )
}
