'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Loader2, Shield, User } from 'lucide-react'
import { toast } from 'sonner'

interface ProfileRow {
  user_id: string
  email: string
  role: 'admin' | 'user'
  free_reports_used: number
  created_at: string
}

export default function UsersList() {
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setRows((data as ProfileRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleRole(row: ProfileRow) {
    const newRole = row.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`Zmienić rolę ${row.email} na ${newRole}?`)) return

    setToggling(row.user_id)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('user_id', row.user_id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Rola zaktualizowana')
      load()
    }
    setToggling(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
      <Loader2 className="h-5 w-5 animate-spin" /> Ładowanie…
    </div>
  )

  if (!rows.length) return (
    <Card className="text-center py-12">
      <CardContent>
        <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Brak użytkowników.</p>
      </CardContent>
    </Card>
  )

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium text-center">Rola</th>
                <th className="px-3 py-2 font-medium text-center">Raporty</th>
                <th className="text-left px-4 py-2 font-medium">Dołączył</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.user_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">{r.email}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge className={r.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-600'
                    }>
                      {r.role === 'admin'
                        ? <><Shield className="h-3 w-3 inline mr-1" />Admin</>
                        : <><User className="h-3 w-3 inline mr-1" />User</>
                      }
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {r.free_reports_used}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      disabled={toggling === r.user_id}
                      onClick={() => toggleRole(r)}
                    >
                      {toggling === r.user_id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : r.role === 'admin' ? 'Degraduj' : 'Nadaj admin'
                      }
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
