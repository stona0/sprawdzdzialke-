'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface ReportRow {
  id: string
  parcel_id: string
  gmina: string
  status: string
  paid: boolean
  created_at: string
  profiles: { email: string } | null
}

export default function ReportsList() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('reports')
        .select('id, parcel_id, gmina, status, paid, created_at, profiles(email)')
        .order('created_at', { ascending: false })
        .limit(100)
      setRows((data as unknown as ReportRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
      <Loader2 className="h-5 w-5 animate-spin" /> Ładowanie…
    </div>
  )

  if (!rows.length) return (
    <Card className="text-center py-12">
      <CardContent>
        <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Brak wygenerowanych raportów.</p>
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
                <th className="text-left px-4 py-2 font-medium">Data</th>
                <th className="text-left px-4 py-2 font-medium">Działka</th>
                <th className="text-left px-4 py-2 font-medium">Gmina</th>
                <th className="text-left px-4 py-2 font-medium">Użytkownik</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Płatność</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.parcel_id}</td>
                  <td className="px-4 py-2 text-xs">{r.gmina}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {r.profiles?.email ?? '–'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge className={r.paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                      {r.paid ? 'Opłacony' : 'Nie'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === 'completed' && (
                      <Link href={`/report/${r.id}`} target="_blank">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    generating: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    completed: 'Gotowy', generating: 'Generuję', pending: 'Oczekuje', failed: 'Błąd',
  }
  return <Badge className={`text-xs ${map[status] ?? ''}`}>{labels[status] ?? status}</Badge>
}
