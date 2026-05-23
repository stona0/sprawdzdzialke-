export type UserRole = 'admin' | 'user'

export interface Profile {
  user_id: string
  email: string
  role: UserRole
  free_reports_used: number
  created_at: string
}

export interface Report {
  id: string
  user_id: string
  parcel_id: string
  gmina: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  html_content: string | null
  paid: boolean
  created_at: string
}

export interface MpzpCache {
  id: string
  gmina_teryt: string
  symbol_terenu: string
  przeznaczenie: string | null
  wysokosc_max: number | null
  pbc_min: number | null
  typ_dachu: string | null
  source_pdf_url: string | null
  parsed_at: string
}

export interface SipLayer {
  id: string
  gmina_teryt: string
  gmina_nazwa: string
  wodociag: 'tak' | 'nie' | 'czesciowo' | 'brak_danych'
  kanalizacja: 'tak' | 'nie' | 'czesciowo' | 'brak_danych'
  gaz: 'tak' | 'nie' | 'czesciowo' | 'brak_danych'
  energia: 'tak' | 'nie' | 'czesciowo' | 'brak_danych'
  uwagi: string | null
  sip_url: string | null
  updated_at: string
}

export interface Payment {
  id: string
  user_id: string
  report_id: string
  stripe_session_id: string
  amount: number
  status: 'pending' | 'paid' | 'failed'
  created_at: string
}
