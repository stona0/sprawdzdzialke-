import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { OG_IMAGE } from '@/lib/og-image'

// Podgląd linku (Facebook, LinkedIn, komunikatory). Bez przykładowych liczb —
// pokazuje tylko, z jakich części składa się prawdziwy raport (src/lib/report/html.ts).
// Font: domyślny Geist z next/og (ma polskie znaki).

export const alt = OG_IMAGE.alt
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height }
export const contentType = 'image/png'

const GREEN = '#15803d'
const INK = '#111827'
const MUTED = '#6b7280'

const SECTIONS = [
  'Ocena możliwości zabudowy',
  'Miejscowy plan (MPZP)',
  'Plan ogólny gminy',
  'Zagrożenie powodziowe',
  'Ochrona przyrody',
  'Uzbrojenie terenu',
  'Rekomendacje AI z podstawą',
  'Źródła danych',
]

export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public/logo.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#ffffff',
          padding: '64px 72px',
          color: INK,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={56} height={56} alt="" />
            {/* satori dolicza szerokość znaku diakrytycznego na końcu fragmentu (ź, ę) — stąd ujemny margines */}
            <div style={{ display: 'flex', fontSize: 34 }}>
              <span>Sprawdź</span>
              <span style={{ color: GREEN, marginLeft: -8 }}>Działkę</span>
              <span style={{ marginLeft: -4 }}>.com</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 64, lineHeight: 1.08, letterSpacing: -1.5 }}>
              Sprawdź działkę zanim zainwestujesz.
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.35, color: MUTED }}>
              Raport planistyczny z rejestrów publicznych: MPZP, plan ogólny, strefy zalewowe, Natura 2000, uzbrojenie.
            </div>
          </div>

          <div style={{ display: 'flex' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                color: GREEN,
                background: '#f0fdf4',
                border: '2px solid #bbf7d0',
                borderRadius: 999,
                padding: '10px 24px',
              }}
            >
              Pierwszy raport za darmo
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: 'auto',
            width: 440,
            alignSelf: 'center',
            border: '2px solid #e5e7eb',
            borderRadius: 24,
            padding: '28px 32px',
            gap: 13,
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: 20, color: MUTED, letterSpacing: 2, textTransform: 'uppercase' }}>Raport zawiera</div>
          {SECTIONS.map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 23 }}>
              <div style={{ width: 12, height: 12, borderRadius: 999, background: GREEN }} />
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}
