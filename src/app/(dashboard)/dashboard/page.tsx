import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { FileText, LogOut } from 'lucide-react'
import Link from 'next/link'
import DashboardClient from '@/components/forms/DashboardClient'

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

  const { data: reports } = await supabaseService
    .from('reports')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const hasFreeReport = (profile?.free_reports_used ?? 0) === 0

  return (
    <main className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold text-gray-900"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Sprawdź<span className="text-green-700">Działkę</span>.pl
          </Link>
          <div className="flex items-center gap-4">
            {profile?.role === 'admin' && (
              <Link
                href="/admin"
                className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                Panel admina
              </Link>
            )}
            <span
              className="text-sm text-gray-400 hidden sm:block"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              {user.email}
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-14">

        {/* Header strony */}
        <div>
          <h1
            className="text-4xl text-gray-900"
            style={{ fontFamily: 'var(--font-playfair)', fontWeight: 400 }}
          >
            Sprawdź działkę
          </h1>
          <p
            className="mt-2 text-gray-500"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            {hasFreeReport
              ? 'Masz 1 darmowy raport — skorzystaj teraz.'
              : 'Każdy raport kosztuje 29 PLN.'}
          </p>
        </div>

        {/* Wyszukiwarka */}
        <DashboardClient hasFreeReport={hasFreeReport} userId={user.id} />

        {/* Lista raportów */}
        <section>
          <h2
            className="text-2xl text-gray-900 mb-6"
            style={{ fontFamily: 'var(--font-playfair)', fontWeight: 400 }}
          >
            Twoje raporty
          </h2>

          {!reports || reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-2xl text-center">
              <FileText className="h-10 w-10 text-gray-200 mb-4" />
              <p
                className="text-gray-400"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                Brak raportów — sprawdź swoją pierwszą działkę powyżej
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <div
                  key={report.id}
                  className="flex items-center justify-between px-5 py-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <div>
                    <p
                      className="text-sm font-semibold text-gray-800"
                      style={{ fontFamily: 'var(--font-playfair)' }}
                    >
                      {report.parcel_id}
                    </p>
                    <p
                      className="text-xs text-gray-400 mt-0.5"
                      style={{ fontFamily: 'var(--font-playfair)' }}
                    >
                      {report.gmina}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={report.status} />
                    {report.status === 'completed' && (
                      <Link
                        href={`/report/${report.id}`}
                        className="text-sm px-4 py-1.5 border border-gray-200 rounded-full text-gray-700 hover:bg-gray-50 transition-colors"
                        style={{ fontFamily: 'var(--font-playfair)' }}
                      >
                        Zobacz raport
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: 'Gotowy', className: 'text-green-700 bg-green-50 border border-green-200' },
    generating: { label: 'Generuję…', className: 'text-blue-700 bg-blue-50 border border-blue-200' },
    pending: { label: 'Oczekuje', className: 'text-yellow-700 bg-yellow-50 border border-yellow-200' },
    failed: { label: 'Błąd', className: 'text-red-700 bg-red-50 border border-red-200' },
  }
  const s = map[status] ?? { label: status, className: 'text-gray-600 bg-gray-50 border border-gray-200' }
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full font-medium ${s.className}`}
      style={{ fontFamily: 'var(--font-playfair)' }}
    >
      {s.label}
    </span>
  )
}
