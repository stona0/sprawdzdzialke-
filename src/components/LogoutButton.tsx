'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
      title="Wyloguj się"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Wyloguj</span>
    </button>
  )
}
