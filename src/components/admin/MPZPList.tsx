'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Map, Loader2 } from 'lucide-react'

interface MpzpGroup {
  gmina_teryt: string
  symbols: string[]
  parsed_at: string
}

export default function MPZPList() {
  const [groups, setGroups] = useState<MpzpGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('mpzp_cache')
        .select('gmina_teryt, symbol_terenu, parsed_at')
        .order('parsed_at', { ascending: false })

      if (!data) { setLoading(false); return }

      // Grupuj po gminie
      const mapObj: Record<string, MpzpGroup> = {}
      for (const row of data) {
        if (!mapObj[row.gmina_teryt]) {
          mapObj[row.gmina_teryt] = { gmina_teryt: row.gmina_teryt, symbols: [], parsed_at: row.parsed_at }
        }
        mapObj[row.gmina_teryt].symbols.push(row.symbol_terenu)
      }
      setGroups(Object.values(mapObj))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Ładowanie…
      </div>
    )
  }

  if (!groups.length) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Map className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Brak danych MPZP w bazie. Dodaj pierwszą gminę powyżej.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gminy w bazie MPZP ({groups.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.gmina_teryt} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm font-mono">{g.gmina_teryt}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Zaktualizowano: {new Date(g.parsed_at).toLocaleDateString('pl-PL')}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 justify-end">
                {g.symbols.slice(0, 8).map(s => (
                  <Badge key={s} variant="outline" className="text-xs font-mono">{s}</Badge>
                ))}
                {g.symbols.length > 8 && (
                  <Badge variant="secondary" className="text-xs">+{g.symbols.length - 8}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
