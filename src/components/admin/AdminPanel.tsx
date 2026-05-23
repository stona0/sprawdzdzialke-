'use client'

import { useState } from 'react'
import MPZPUploader from './MPZPUploader'
import MPZPList from './MPZPList'
import SipManager from './SipManager'
import ReportsList from './ReportsList'
import UsersList from './UsersList'
import { FileText, Layers, Map, Users, Bot } from 'lucide-react'
import AutoImport from './AutoImport'

const pf: React.CSSProperties = { fontFamily: 'var(--font-playfair)' }

const TABS = [
  { id: 'mpzp',       icon: Map,      label: 'MPZP' },
  { id: 'autoimport', icon: Bot,      label: 'Auto-import' },
  { id: 'media',      icon: Layers,   label: 'Media / SIP' },
  { id: 'reports',    icon: FileText, label: 'Raporty' },
  { id: 'users',      icon: Users,    label: 'Użytkownicy' },
] as const

type TabId = typeof TABS[number]['id']

export default function AdminPanel() {
  const [tab, setTab] = useState<TabId>('mpzp')
  const [mpzpRefresh, setMpzpRefresh] = useState(0)

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border border-gray-100 rounded-2xl p-1 bg-gray-50 w-fit">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm transition-all ${
              tab === id
                ? 'bg-white text-gray-900 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
            style={pf}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'mpzp' && (
        <div className="space-y-6">
          <MPZPUploader onSaved={() => setMpzpRefresh(n => n + 1)} />
          <MPZPList key={mpzpRefresh} />
        </div>
      )}
      {tab === 'autoimport' && <AutoImport />}
      {tab === 'media'   && <SipManager />}
      {tab === 'reports' && <ReportsList />}
      {tab === 'users'   && <UsersList />}
    </div>
  )
}
