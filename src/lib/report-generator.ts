import { createServiceClient } from './supabase/server'
import { getParcelData } from './geoportal'
import { queryGdosNature, queryOsmUtilities } from './external-data'
import type { GdosResult, OsmUtilityResult } from './external-data'
import { getWroclawMpzpForCoords } from './wroclaw-mpzp'
import Anthropic from '@anthropic-ai/sdk'

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface ReportData {
  parcelId: string
  gmina: string
  generatedAt: string
  // [1] Dane podstawowe
  numer: string
  obreb: string | null
  powiat: string | null
  wojewodztwo: string | null
  powierzchnia: string
  wspolrzedne: string | null
  // [2] MPZP
  mpzp: MpzpData | null
  // [3] Strefy
  strefy: StrefyData
  // [4] Media
  media: MediaData
  // [5] Rekomendacje
  rekomendacje: string[]
  ryzyka: string[]
}

interface MpzpData {
  symbol: string
  przeznaczenie: string | null
  wysokosc_max: number | null
  pbc_min: number | null
  typ_dachu: string | null
  parsed_at: string
  uchwala?: string
  tytul_planu?: string
  zrodlo?: 'wfs_wroclaw' | 'cache'
}

interface StrefyData {
  zalewowa: string
  ochrona_przyrody: string
  konserwatorska: string
}

interface MediaData {
  wodociag: string
  kanalizacja: string
  gaz: string
  energia: string
  uwagi: string | null
}

// ─── Główna funkcja ───────────────────────────────────────────────────────────

export async function generateReport(
  parcelId: string,
  gmina: string,
  userId: string,
  reportId: string
): Promise<string> {
  const supabase = await createServiceClient()

  // 1. Dane działki z Geoportal
  const parcel = await getParcelData(parcelId, gmina).catch(() => null)

  // 2. MPZP — dla Wrocławia użyj WFS na żywo po współrzędnych
  const coords = parcel?.wspolrzedne ?? null
  const isWroclaw = gmina.toLowerCase().includes('wrocław') || gmina.toLowerCase().includes('wroclaw')

  let mpzp: MpzpData | null = null

  if (isWroclaw && coords) {
    // Zapytaj WFS Urzędu Miejskiego Wrocławia
    const wfsZone = await getWroclawMpzpForCoords(coords.lat, coords.lng).catch(() => null)
    if (wfsZone) {
      mpzp = {
        symbol: wfsZone.symbol_terenu,
        przeznaczenie: wfsZone.przeznaczenie ?? wfsZone.klasyfikacja,
        wysokosc_max: null,   // WFS nie zwraca parametrów — tylko symbol i przeznaczenie
        pbc_min: null,
        typ_dachu: null,
        parsed_at: new Date().toISOString(),
        uchwala: wfsZone.uchwalenie_uchwala ?? undefined,
        tytul_planu: wfsZone.tytul_planu ?? undefined,
        zrodlo: 'wfs_wroclaw',
      }
    }
  }

  // Fallback: cache z bazy (ręcznie importowane PDFy)
  if (!mpzp) {
    const { data: mpzpRows } = await supabase
      .from('mpzp_cache')
      .select('*')
      .eq('gmina_teryt', gmina)
      .order('parsed_at', { ascending: false })
      .limit(10)

    const mpzpRow = mpzpRows?.[0] ?? null
    if (mpzpRow) {
      mpzp = {
        symbol: mpzpRow.symbol_terenu,
        przeznaczenie: mpzpRow.przeznaczenie,
        wysokosc_max: mpzpRow.wysokosc_max,
        pbc_min: mpzpRow.pbc_min,
        typ_dachu: mpzpRow.typ_dachu,
        parsed_at: mpzpRow.parsed_at,
        zrodlo: 'cache',
      }
    }
  }

  // 3. SIP/media (manual data entered by admin)
  const { data: sipRow } = await supabase
    .from('sip_layers')
    .select('*')
    .ilike('gmina_nazwa', `%${gmina}%`)
    .maybeSingle()

  // 3b. External automatic data – run in parallel, don't block on failure
  const [gdosResult, osmResult] = coords
    ? await Promise.all([
        queryGdosNature(coords.lat, coords.lng).catch((): GdosResult => ({ areas: [], queried: false })),
        queryOsmUtilities(coords.lat, coords.lng).catch((): OsmUtilityResult => ({ wodociag: null, kanalizacja: null, gaz: null, energia: null })),
      ])
    : [null, null]

  const media: MediaData = {
    wodociag:    mergeMedia(sipRow?.wodociag,    osmResult?.wodociag    ?? null, 'ZGK/MPWiK'),
    kanalizacja: mergeMedia(sipRow?.kanalizacja, osmResult?.kanalizacja ?? null, 'ZGK/MPWiK'),
    gaz:         mergeMedia(sipRow?.gaz,         osmResult?.gaz         ?? null, 'PSG'),
    energia:     mergeMedia(sipRow?.energia,     osmResult?.energia     ?? null, 'Tauron/PGE/Enea'),
    uwagi: sipRow?.uwagi ?? null,
  }

  // 4. Strefy – GDOŚ WFS for nature protection; ISOK link for flood zones
  const strefy: StrefyData = {
    zalewowa: 'DO WERYFIKACJI – sprawdź na mapy.isok.gov.pl',
    ochrona_przyrody: formatGdos(gdosResult),
    konserwatorska: mpzp ? 'Sprawdź tekst uchwały MPZP' : 'DO WERYFIKACJI',
  }

  // 5. Rekomendacje Claude
  const { rekomendacje, ryzyka } = await generateRekomendacje({
    parcel: parcel ?? { parcelId, numer: parcelId, gmina, found: false, obreb: null, powiat: null, wojewodztwo: null, powierzchnia: null, wspolrzedne: null },
    mpzp,
    media,
    strefy,
  })

  const data: ReportData = {
    parcelId,
    gmina,
    generatedAt: new Date().toLocaleString('pl-PL'),
    numer: parcel?.numer ?? parcelId,
    obreb: parcel?.obreb ?? null,
    powiat: parcel?.powiat ?? null,
    wojewodztwo: parcel?.wojewodztwo ?? null,
    powierzchnia: parcel?.powierzchnia
      ? parcel.powierzchnia >= 10_000
        ? `${(parcel.powierzchnia / 10_000).toFixed(4)} ha (${parcel.powierzchnia.toLocaleString('pl-PL')} m²)`
        : `${parcel.powierzchnia.toLocaleString('pl-PL')} m²`
      : 'DO WERYFIKACJI',
    wspolrzedne: parcel?.wspolrzedne
      ? `${parcel.wspolrzedne.lat}, ${parcel.wspolrzedne.lng}`
      : null,
    mpzp,
    strefy,
    media,
    rekomendacje,
    ryzyka,
  }

  const html = buildHTML(data)

  // Zapisz do DB
  await supabase
    .from('reports')
    .update({ html_content: html, status: 'completed' })
    .eq('id', reportId)

  return html
}

// ─── Rekomendacje Claude ──────────────────────────────────────────────────────

async function generateRekomendacje(ctx: {
  parcel: { numer: string; gmina: string; found: boolean }
  mpzp: MpzpData | null
  media: MediaData
  strefy: StrefyData
}): Promise<{ rekomendacje: string[]; ryzyka: string[] }> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const prompt = `Jesteś ekspertem planowania przestrzennego. Na podstawie poniższych danych działki wygeneruj zwięzłe rekomendacje i ryzyka inwestycyjne.

Działka: ${ctx.parcel.numer}, gmina: ${ctx.parcel.gmina}
MPZP: ${ctx.mpzp ? `symbol ${ctx.mpzp.symbol}, przeznaczenie: ${ctx.mpzp.przeznaczenie}, wys. max: ${ctx.mpzp.wysokosc_max}m, PBC min: ${ctx.mpzp.pbc_min}%` : 'brak danych MPZP'}
Media: wodociąg: ${ctx.media.wodociag}, kanalizacja: ${ctx.media.kanalizacja}, gaz: ${ctx.media.gaz}, energia: ${ctx.media.energia}
Ochrona przyrody: ${ctx.strefy.ochrona_przyrody}
Strefa zalewowa: ${ctx.strefy.zalewowa}

Odpowiedz TYLKO w formacie JSON:
{
  "rekomendacje": ["punkt 1", "punkt 2", "punkt 3"],
  "ryzyka": ["ryzyko 1", "ryzyko 2"]
}

Maksymalnie 4 rekomendacje i 3 ryzyka. Każdy punkt max 2 zdania. Bądź konkretny.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Brak JSON')

    const parsed = JSON.parse(match[0])
    return {
      rekomendacje: Array.isArray(parsed.rekomendacje) ? parsed.rekomendacje : [],
      ryzyka: Array.isArray(parsed.ryzyka) ? parsed.ryzyka : [],
    }
  } catch {
    return {
      rekomendacje: [
        'Przed zakupem zleć geodecie aktualne pomiary granic działki.',
        'Sprawdź w urzędzie gminy czy dla działki wydano warunki zabudowy lub czy obowiązuje MPZP.',
      ],
      ryzyka: [
        'Brak pełnych danych MPZP – konieczna weryfikacja w urzędzie.',
        'Dostępność mediów wymaga potwierdzenia u lokalnych operatorów.',
      ],
    }
  }
}

// ─── Formatowanie ─────────────────────────────────────────────────────────────

function formatMedia(val: string | undefined | null, operator: string): string {
  if (!val || val === 'brak_danych') return `❓ DO WERYFIKACJI u operatora (${operator})`
  const map: Record<string, string> = {
    tak: '✅ Tak',
    nie: '❌ Nie',
    czesciowo: '⚠️ Częściowo',
  }
  return map[val] ?? `❓ DO WERYFIKACJI u operatora (${operator})`
}

/**
 * Merge manual SIP data with automatic OSM data.
 * SIP always takes priority; OSM is used only as a positive signal when SIP is unknown.
 */
function mergeMedia(
  sipVal: string | undefined | null,
  osmVal: boolean | null,
  operator: string
): string {
  // SIP has authoritative data – use it directly
  if (sipVal && sipVal !== 'brak_danych') return formatMedia(sipVal, operator)

  // OSM confirms presence (underground infra is often mapped)
  if (osmVal === true) {
    return `✅ Tak (źródło: OpenStreetMap — zalecana weryfikacja u operatora ${operator})`
  }

  // No data from either source
  return `❓ DO WERYFIKACJI u operatora (${operator})`
}

/**
 * Format GDOŚ nature protection result into a human-readable string.
 */
function formatGdos(result: GdosResult | null | undefined): string {
  if (!result) return 'DO WERYFIKACJI – brak współrzędnych działki'
  if (!result.queried && result.areas.length === 0) {
    return 'DO WERYFIKACJI – błąd połączenia z GDOŚ'
  }
  if (result.areas.length === 0) {
    return '✅ Brak obszarów chronionych w promieniu 300 m (dane GDOŚ)'
  }
  const list = result.areas.map(a => `${a.type}: ${a.name}`).join('; ')
  return `⚠️ Obszary chronione w pobliżu: ${list}`
}

// ─── Budowanie HTML ───────────────────────────────────────────────────────────

function row(label: string, value: string | null | undefined): string {
  if (!value) return ''
  return `<div class="row"><span class="row-label">${esc(label)}</span><span class="row-value">${value}</span></div>`
}

function buildHTML(d: ReportData): string {

  const mpzpRows = d.mpzp ? [
    row('Symbol terenu', `<strong>${esc(d.mpzp.symbol)}</strong>`),
    d.mpzp.przeznaczenie ? row('Przeznaczenie', esc(d.mpzp.przeznaczenie)) : '',
    d.mpzp.wysokosc_max != null ? row('Wysokość max', `${d.mpzp.wysokosc_max} m`) : '',
    d.mpzp.pbc_min != null ? row('Min. pow. biol. czynna', `${d.mpzp.pbc_min}%`) : '',
    d.mpzp.typ_dachu ? row('Typ dachu', esc(d.mpzp.typ_dachu)) : '',
    d.mpzp.uchwala ? row('Nr uchwały', esc(d.mpzp.uchwala)) : '',
    d.mpzp.tytul_planu ? row('Nazwa planu', esc(d.mpzp.tytul_planu)) : '',
    row('Źródło danych',
      d.mpzp.zrodlo === 'wfs_wroclaw'
        ? '🔴 Na żywo — GIS Urząd Miejski Wrocławia'
        : `Baza SprawdzDziałkę (import ${new Date(d.mpzp.parsed_at).toLocaleDateString('pl-PL')})`
    ),
  ].join('') : `<p class="no-data">Brak danych MPZP w bazie — sprawdź studium uwarunkowań lub złóż wniosek o warunki zabudowy w urzędzie gminy.</p>`

  const rekomendacjeHTML = d.rekomendacje.length
    ? d.rekomendacje.map(r => `<li class="ai-item">${esc(r)}</li>`).join('')
    : '<li class="ai-item">Brak danych do wygenerowania rekomendacji.</li>'

  const ryzykaHTML = d.ryzyka.length
    ? d.ryzyka.map(r => `<li class="ai-item risk">${esc(r)}</li>`).join('')
    : '<li class="ai-item">Brak zidentyfikowanych ryzyk.</li>'

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Raport działki ${esc(d.numer)} – ${esc(d.gmina)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  :root {
    --green:  #15803d;
    --green-l:#dcfce7;
    --amber:  #d97706;
    --amber-l:#fef3c7;
    --red-l:  #fee2e2;
    --gray:   #6b7280;
    --border: #f0f0f0;
    --text:   #111827;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13.5px;
    color: var(--text);
    line-height: 1.65;
    background: #fff;
  }

  .page { max-width: 820px; margin: 0 auto; padding: 48px 36px 64px; }

  /* ── Nagłówek ── */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 1.5px solid var(--border);
    padding-bottom: 24px;
    margin-bottom: 40px;
    gap: 16px;
  }
  .header-left {}
  .brand {
    font-family: 'Playfair Display', serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--green);
    letter-spacing: .01em;
    margin-bottom: 10px;
  }
  .header h1 {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 400;
    color: var(--text);
    line-height: 1.25;
  }
  .header h1 strong { font-weight: 700; }
  .meta {
    font-size: 12px;
    color: var(--gray);
    margin-top: 8px;
  }
  .badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: var(--green);
    background: var(--green-l);
    border: 1px solid #bbf7d0;
    border-radius: 999px;
    padding: 3px 10px;
    white-space: nowrap;
    margin-top: 4px;
  }

  /* ── Siatka 2-kolumnowa ── */
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }

  /* ── Sekcja ── */
  .section {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px 22px;
    break-inside: avoid;
  }
  .section.full { grid-column: 1 / -1; }

  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-title .icon {
    width: 22px; height: 22px;
    background: var(--green-l);
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex-shrink: 0;
  }

  /* ── Wiersze danych ── */
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }
  .row:last-child { border-bottom: none; }
  .row-label { color: var(--gray); flex-shrink: 0; max-width: 48%; }
  .row-value  { font-weight: 500; text-align: right; color: var(--text); }

  .no-data { color: var(--gray); font-style: italic; font-size: 13px; }

  /* ── Tagi statusu mediów ── */
  .ok   { color: var(--green); }
  .warn { color: var(--amber); }
  .unk  { color: var(--gray); }

  /* ── Strefy ── */
  .zone-row {
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 6px;
    font-size: 13px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.5;
  }
  .zone-row:last-child { margin-bottom: 0; }
  .zone-ok   { background: var(--green-l); }
  .zone-warn { background: var(--amber-l); }
  .zone-unk  { background: #f9fafb; }
  .zone-icon { flex-shrink: 0; font-size: 14px; }

  /* ── Listy AI ── */
  .ai-list { list-style: none; padding: 0; margin: 0; }
  .ai-item {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    line-height: 1.55;
    align-items: flex-start;
  }
  .ai-item:last-child { border-bottom: none; }
  .ai-item::before {
    content: '→';
    color: var(--green);
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .ai-item.risk::before { content: '⚠'; color: var(--amber); }

  /* ── Disclaimer ── */
  .disclaimer {
    margin-top: 40px;
    padding: 14px 18px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 12px;
    font-size: 12px;
    color: #92400e;
    line-height: 1.6;
  }

  /* ── Stopka ── */
  .footer {
    margin-top: 36px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #9ca3af;
  }
  .footer-brand {
    font-family: 'Playfair Display', serif;
    font-size: 12px;
    font-weight: 600;
    color: var(--green);
  }

  /* ── Print ── */
  @media print {
    body { font-size: 12px; }
    .page { padding: 0; }
    .section { border: 1px solid #e5e7eb; }
    .grid { gap: 16px; }
    .header h1 { font-size: 22px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Nagłówek -->
  <div class="header">
    <div class="header-left">
      <div class="brand">SprawdzDziałkę.pl</div>
      <h1>Raport działki <strong>${esc(d.numer)}</strong><br/>${esc(d.gmina)}</h1>
      <div class="meta">Wygenerowano: ${esc(d.generatedAt)}</div>
    </div>
    <div>
      <span class="badge">Raport planistyczny</span>
    </div>
  </div>

  <!-- Siatka sekcji -->
  <div class="grid">

    <!-- [1] Dane podstawowe -->
    <div class="section">
      <div class="section-title"><span class="icon">📍</span>Dane podstawowe</div>
      ${row('Numer działki', esc(d.numer))}
      ${row('Gmina', esc(d.gmina))}
      ${d.obreb ? row('Obręb', esc(d.obreb)) : ''}
      ${d.powiat ? row('Powiat', esc(d.powiat)) : ''}
      ${d.wojewodztwo ? row('Województwo', esc(d.wojewodztwo)) : ''}
      ${row('Powierzchnia', esc(d.powierzchnia))}
      ${d.wspolrzedne ? row('Współrzędne', esc(d.wspolrzedne)) : ''}
    </div>

    <!-- [4] Media -->
    <div class="section">
      <div class="section-title"><span class="icon">⚡</span>Media i uzbrojenie</div>
      ${[
        ['Wodociąg',          d.media.wodociag],
        ['Kanalizacja',       d.media.kanalizacja],
        ['Gaz',               d.media.gaz],
        ['Energia elektryczna', d.media.energia],
        ...(d.media.uwagi ? [['Uwagi', d.media.uwagi]] : []),
      ].map(([lbl, val]) => `<div class="row">
        <span class="row-label">${esc(lbl ?? '')}</span>
        <span class="row-value ${(val ?? '').startsWith('✅') ? 'ok' : (val ?? '').startsWith('❓') ? 'unk' : 'warn'}">${esc(val ?? '')}</span>
      </div>`).join('')}
    </div>

    <!-- [2] MPZP -->
    <div class="section">
      <div class="section-title"><span class="icon">📋</span>Plan zagospodarowania (MPZP)</div>
      ${mpzpRows}
      ${d.mpzp ? '<p style="font-size:11px;color:#9ca3af;margin-top:10px;">Zalecana weryfikacja w urzędzie gminy.</p>' : ''}
    </div>

    <!-- [3] Strefy -->
    <div class="section">
      <div class="section-title"><span class="icon">🛡</span>Strefy i ograniczenia</div>
      <div class="zone-row ${d.strefy.zalewowa.startsWith('DO') ? 'zone-unk' : 'zone-ok'}">
        <span class="zone-icon">${d.strefy.zalewowa.startsWith('✅') ? '✅' : '❓'}</span>
        <span><strong>Strefa zalewowa (ISOK):</strong> ${esc(d.strefy.zalewowa)}
          &nbsp;<a href="https://mapy.isok.gov.pl/imap/" target="_blank" rel="noopener" style="font-size:11px;color:var(--green);">→ mapa ISOK</a>
        </span>
      </div>
      <div class="zone-row ${d.strefy.ochrona_przyrody.startsWith('✅') ? 'zone-ok' : d.strefy.ochrona_przyrody.startsWith('⚠') ? 'zone-warn' : 'zone-unk'}">
        <span class="zone-icon">${d.strefy.ochrona_przyrody.startsWith('✅') ? '✅' : d.strefy.ochrona_przyrody.startsWith('⚠') ? '⚠️' : '❓'}</span>
        <span><strong>Ochrona przyrody (GDOŚ):</strong> ${esc(d.strefy.ochrona_przyrody)}</span>
      </div>
      <div class="zone-row zone-unk">
        <span class="zone-icon">🏛</span>
        <span><strong>Strefa konserwatorska:</strong> ${esc(d.strefy.konserwatorska)}</span>
      </div>
    </div>

    <!-- [5] Rekomendacje AI -->
    <div class="section">
      <div class="section-title"><span class="icon">✨</span>Rekomendacje AI</div>
      <ul class="ai-list">${rekomendacjeHTML}</ul>
    </div>

    <!-- Ryzyka -->
    <div class="section">
      <div class="section-title"><span class="icon">⚠</span>Ryzyka inwestycyjne</div>
      <ul class="ai-list">${ryzykaHTML}</ul>
    </div>

  </div><!-- /grid -->

  <div class="disclaimer">
    <strong>Ważna informacja:</strong> Raport ma charakter informacyjny i nie stanowi oficjalnej
    interpretacji prawa miejscowego. Dane MPZP, stref i mediów mogły ulec zmianie.
    Przed podjęciem decyzji zalecamy weryfikację w urzędzie gminy oraz konsultację z geodetą i prawnikiem.
  </div>

  <div class="footer">
    <span class="footer-brand">SprawdzDziałkę.pl</span>
    <span>Raport wygenerowany: ${esc(d.generatedAt)}</span>
  </div>

</div>
</body>
</html>`
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
