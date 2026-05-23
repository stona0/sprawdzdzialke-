import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AdminPanel from '@/components/admin/AdminPanel'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const supabaseService = await createServiceClient()
  const { data: profile } = await supabaseService
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="text-gray-200">|</span>
            <span
              className="font-semibold text-gray-900"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              Panel admina
            </span>
          </div>
          <span
            className="text-sm text-gray-400 hidden sm:block"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            {user.email}
          </span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1
            className="text-4xl text-gray-900"
            style={{ fontFamily: 'var(--font-playfair)', fontWeight: 400 }}
          >
            Panel admina
          </h1>
          <p
            className="mt-2 text-gray-400"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Zarządzaj danymi MPZP, mediami, raportami i użytkownikami.
          </p>
        </div>
        <AdminPanel />
      </div>
    </main>
  )
}
