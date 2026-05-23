'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Loader2, Layers } from 'lucide-react'
import { toast } from 'sonner'
import type { SipLayer } from '@/types'

type MediaStatus = 'tak' | 'nie' | 'czesciowo' | 'brak_danych'

const STATUS_OPTS: { value: MediaStatus; label: string }[] = [
  { value: 'tak', label: 'Tak' },
  { value: 'nie', label: 'Nie' },
  { value: 'czesciowo', label: 'Częściowo' },
  { value: 'brak_danych', label: 'Brak danych' },
]

const STATUS_BADGE: Record<MediaStatus, string> = {
  tak: 'bg-green-100 text-green-800',
  nie: 'bg-red-100 text-red-800',
  czesciowo: 'bg-yellow-100 text-yellow-800',
  brak_danych: 'bg-gray-100 text-gray-600',
}

const EMPTY_FORM: Omit<SipLayer, 'id' | 'updated_at'> = {
  gmina_teryt: '',
  gmina_nazwa: '',
  wodociag: 'brak_danych',
  kanalizacja: 'brak_danych',
  gaz: 'brak_danych',
  energia: 'brak_danych',
  uwagi: null,
  sip_url: null,
}

export default function SipManager() {
  const [rows, setRows] = useState<SipLayer[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/sip')
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setOpen(true)
  }

  function openEdit(row: SipLayer) {
    setForm({
      gmina_teryt: row.gmina_teryt,
      gmina_nazwa: row.gmina_nazwa,
      wodociag: row.wodociag,
      kanalizacja: row.kanalizacja,
      gaz: row.gaz,
      energia: row.energia,
      uwagi: row.uwagi,
      sip_url: row.sip_url,
    })
    setEditId(row.id)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.gmina_teryt.trim() || !form.gmina_nazwa.trim()) {
      toast.error('Wypełnij TERYT i nazwę gminy')
      return
    }
    setSaving(true)
    const payload = { ...form, updated_at: new Date().toISOString() }

    const res = editId
      ? await fetch('/api/admin/sip', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...payload }) })
      : await fetch('/api/admin/sip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

    const result = await res.json()
    if (!res.ok) {
      toast.error(result.error ?? 'Błąd zapisu')
    } else {
      toast.success(editId ? 'Zaktualizowano' : 'Dodano gminę')
      setOpen(false)
      load()
    }
    setSaving(false)
  }

  const set = (k: keyof typeof form, v: string) =>
    setForm(f => ({ ...f, [k]: v || null }))

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Media / SIP ({rows.length} gmin)</h2>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" /> Dodaj gminę
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Ładowanie…
        </div>
      ) : rows.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Brak danych SIP. Dodaj pierwszą gminę.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Gmina</th>
                    <th className="text-left px-4 py-2 font-medium">TERYT</th>
                    <th className="px-3 py-2 font-medium text-center">Woda</th>
                    <th className="px-3 py-2 font-medium text-center">Kan.</th>
                    <th className="px-3 py-2 font-medium text-center">Gaz</th>
                    <th className="px-3 py-2 font-medium text-center">Prąd</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{row.gmina_nazwa}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{row.gmina_teryt}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge v={row.wodociag} /></td>
                      <td className="px-3 py-2 text-center"><StatusBadge v={row.kanalizacja} /></td>
                      <td className="px-3 py-2 text-center"><StatusBadge v={row.gaz} /></td>
                      <td className="px-3 py-2 text-center"><StatusBadge v={row.energia} /></td>
                      <td className="px-3 py-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edytuj gminę' : 'Dodaj gminę'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nazwa gminy</Label>
                <Input placeholder="np. Kraków" value={form.gmina_nazwa}
                  onChange={e => set('gmina_nazwa', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kod TERYT</Label>
                <Input placeholder="np. 1261011" value={form.gmina_teryt}
                  onChange={e => set('gmina_teryt', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['wodociag', 'kanalizacja', 'gaz', 'energia'] as const).map(field => (
                <div key={field} className="space-y-1.5">
                  <Label className="capitalize">{field === 'energia' ? 'Energia el.' : field}</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                    value={form[field]}
                    onChange={e => set(field, e.target.value)}
                  >
                    {STATUS_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Link do SIP gminy (opcjonalnie)</Label>
              <Input placeholder="https://sip.gmina.pl" value={form.sip_url ?? ''}
                onChange={e => set('sip_url', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Uwagi</Label>
              <Input placeholder="Opcjonalne uwagi" value={form.uwagi ?? ''}
                onChange={e => set('uwagi', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? 'Zapisz' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ v }: { v: MediaStatus }) {
  const labels: Record<MediaStatus, string> = {
    tak: 'Tak', nie: 'Nie', czesciowo: 'Częśc.', brak_danych: '?',
  }
  return <Badge className={`text-xs ${STATUS_BADGE[v]}`}>{labels[v]}</Badge>
}
