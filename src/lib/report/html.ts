import { GESUT_WINDOW_M, NETWORKS, type Network } from '../sources/gesut'
import { NEARBY_M } from '../sources/gdos'
import { ISOK_MAP_URL, SCENARIO_LABEL } from '../sources/isok'
import { OSM_RADIUS_M } from '../sources/osm'
import { RU_PUBLIC_URL } from '../sources/rejestr-urbanistyczny'
import { NETWORK_STYLES } from '../utility-map'
import type { AiInsights } from './ai'
import type { ReportData } from './collect'

export function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined || s === '') return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Wartość trafia do HTML bez escapowania — wołający odpowiada za esc(). */
function row(label: string, valueHtml: string | null | undefined): string {
  if (!valueHtml) return ''
  return `<div class="row"><span class="row-label">${esc(label)}</span><span class="row-value">${valueHtml}</span></div>`
}

function link(url: string | null | undefined, label: string): string {
  if (!url || !/^https?:\/\//i.test(url)) return esc(label)
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`
}

const pl = (n: number | null | undefined, unit = '') => (n === null || n === undefined ? null : `${n.toLocaleString('pl-PL')}${unit}`)
const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pl-PL') : null)
// Serwer działa w UTC — bez strefy czasowej godziny w raporcie byłyby przesunięte.
const warsawTime = (iso: string) => new Date(iso).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })

function zone(cls: 'ok' | 'warn' | 'risk' | 'unk', icon: string, html: string): string {
  return `<div class="zone-row zone-${cls}"><span class="zone-icon">${icon}</span><span>${html}</span></div>`
}

function section(title: string, icon: string, body: string, full = false): string {
  return `<div class="section${full ? ' full' : ''}"><div class="section-title"><span class="icon">${icon}</span>${esc(title)}</div>${body}</div>`
}

const STATUS_LABEL: Record<string, string> = {
  ok: '✅ dane pobrane',
  no_data: '✅ odpowiedź: brak obiektów',
  not_covered: '➖ źródło nie obejmuje obszaru',
  error: '⚠️ źródło niedostępne',
}

function summarySection(d: ReportData): string {
  const a = d.assessment
  const cls = a.verdict === 'mpzp' || a.verdict === 'wz_mozliwe' ? 'ok' : a.verdict === 'nieustalone' ? 'unk' : 'risk'
  const icon = cls === 'ok' ? '✅' : cls === 'risk' ? '⛔' : '❓'
  const findings = d.findings.length
    ? d.findings.map(f => zone(f.level === 'ryzyko' ? 'risk' : f.level === 'uwaga' ? 'warn' : 'ok', f.level === 'ryzyko' ? '⚠️' : 'ℹ️', esc(f.text))).join('')
    : zone('ok', '✅', 'Nie wykryto stref zagrożenia powodziowego, obszarów chronionych na działce ani sieci przebiegających przez działkę (w zakresie dostępnych danych).')
  return section('Podsumowanie', '🧭', `
    ${zone(cls, icon, `<strong>${esc(a.title)}.</strong> ${esc(a.text)}`)}
    <p class="hint">Pewność oceny: ${esc(a.confidence)}. Ocena opiera się na danych z rejestrów publicznych i stanie prawnym po reformie planistycznej (od 1.09.2026).</p>
    <div class="sub-title">Kluczowe ustalenia</div>
    ${findings}`, true)
}

function parcelSection(d: ReportData): string {
  const p = d.parcel
  return section('Dane ewidencyjne', '📍', [
    row('Identyfikator', esc(d.parcelId)),
    row('Numer działki', esc(p.numer)),
    row('Obręb', esc(p.obreb)),
    row('Gmina', esc(p.gmina)),
    row('Powiat', esc(p.powiat)),
    row('Województwo', esc(p.wojewodztwo)),
    row('Powierzchnia (z geometrii)', p.powierzchnia ? esc(pl(p.powierzchnia, ' m²')) : null),
    row('Punkt wewnątrz działki', p.wspolrzedne ? `${link(`https://www.google.com/maps?q=${p.wspolrzedne.lat},${p.wspolrzedne.lng}`, `${p.wspolrzedne.lat}, ${p.wspolrzedne.lng}`)}` : null),
  ].join('') + '<p class="hint">Źródło: ULDK GUGiK. Powierzchnia policzona z obrysu może się nieznacznie różnić od powierzchni ewidencyjnej z wypisu z rejestru gruntów.</p>')
}

function mpzpSection(d: ReportData): string {
  const w = d.mpzp.wroclaw
  let body: string
  if (d.mpzp.covered === true && w) {
    body = w.zones.map(z => row(`Teren ${z.symbol}`, `${esc(z.przeznaczenie ?? z.klasyfikacja)} <span class="muted">(${esc(pl(z.sharePct, '%'))} działki)</span>`)).join('')
      + w.plans.map(p => row('Plan', link(p.uchwalaUrl, p.tytul ?? p.nr ?? 'plan miejscowy'))).join('')
      + row('Źródło', 'GIS Urzędu Miejskiego Wrocławia (na żywo)')
  } else if (d.mpzp.covered === true) {
    body = (d.mpzp.kimpzp ?? []).map(p => [
      row('Plan', link(p.link, p.tytul ?? 'plan miejscowy')),
      row('Oznaczenie terenu', esc(p.symbol)),
      row('Przeznaczenie', esc(p.przeznaczenie)),
      row('Uchwała', esc(p.uchwala)),
      row('Obowiązuje od (wg danych)', esc(p.obowiazujeOd)),
    ].join('')).join('<hr/>')
      + row('Źródło', 'Krajowa Integracja MPZP (GUGiK), punkt wewnątrz działki')
      + '<p class="hint">Gminy przekazują do krajowej integracji różny zakres danych — czasem tylko dane aktu (bez symbolu terenu). Parametry zabudowy sprawdź w tekście uchwały lub wypisie z planu.</p>'
  } else if (d.mpzp.covered === false) {
    body = `<p class="no-data">Według ${w ? 'GIS Urzędu Miejskiego Wrocławia' : 'Krajowej Integracji MPZP'} działka nie jest objęta obowiązującym MPZP.</p>`
  } else {
    body = `<p class="no-data">Nie udało się ustalić, czy działkę obejmuje MPZP — ${d.mpzp.status === 'not_covered' ? 'gmina nie udostępnia planów w krajowej integracji' : 'źródło było niedostępne'}. Sprawdź w urzędzie gminy.</p>`
  }
  if (w?.plansPending.length) {
    body += zone('warn', '🚧', `Plany w toku: ${w.plansPending.map(p => esc(`${p.tytul ?? p.nr} — ${p.stan}`)).join('; ')}`)
  }
  if (w?.heritage.length) body += zone('warn', '🏛', `Ochrona konserwatorska: ${esc(w.heritage.join('; '))}`)
  return section('Miejscowy plan (MPZP)', '📋', body)
}

function pogSection(d: ReportData): string {
  const g = d.pog.wroclaw
  let body: string
  if (g) {
    body = g.strefy.map(s => [
      row(`Strefa ${s.oznaczenie}`, `${esc(s.nazwa)} <span class="muted">(${esc(pl(s.sharePct, '%'))} działki)</span>`),
      row('Maks. wysokość zabudowy', esc(pl(s.maks_wysokosc, ' m'))),
      row('Maks. nadziemna intensywność', esc(pl(s.maks_intensywnosc))),
      row('Maks. udział pow. zabudowy', esc(pl(s.maks_udzial_zabudowy, '%'))),
      row('Min. udział pow. biol. czynnej', esc(pl(s.min_pbc, '%'))),
      row('Profil podstawowy', esc(s.profil_podstawowy.join(', '))),
      row('Profil dodatkowy', esc(s.profil_dodatkowy.join(', '))),
    ].join('')).join('<hr/>')
      + row('Obszar uzupełnienia zabudowy', g.obszar_uzupelnienia_zabudowy ? `Tak (${esc(g.obszar_uzupelnienia_zabudowy)}, ${esc(pl(g.ouzSharePct, '%'))} działki)` : 'Nie')
      + row('Obszar zabudowy śródmiejskiej', g.obszar_zabudowy_srodmiejskiej ? `Tak (${esc(g.obszar_zabudowy_srodmiejskiej)})` : 'Nie')
      + row('Obowiązuje od', esc(date(g.obowiazuje_od)))
      + row('Uchwała', esc(g.uchwala))
      + row('Źródło', esc(g.zrodlo))
  } else if (d.pog.ru?.entry) {
    const e = d.pog.ru.entry
    body = row('Plan', esc(e.tytul)) + row('Status w rejestrze', esc(e.status)) + row('Data w rejestrze', esc(date(e.obowiazujeOd)))
      + row('Źródło', link(RU_PUBLIC_URL, 'Rejestr Urbanistyczny'))
  } else if (d.pog.inForce === false) {
    body = `<p class="no-data">W ${link(RU_PUBLIC_URL, 'Rejestrze Urbanistycznym')} nie ma opublikowanego planu ogólnego tej gminy.</p>`
  } else {
    body = '<p class="no-data">Nie udało się pobrać informacji o planie ogólnym gminy.</p>'
  }
  return section('Plan ogólny gminy (POG)', '🗺', body)
}

function floodSection(d: ReportData): string {
  const f = d.flood
  let body: string
  if (!f) body = zone('unk', '❓', `Źródło niedostępne — sprawdź na ${link(ISOK_MAP_URL, 'mapie ISOK')}.`)
  else if (!f.scenarios.length) {
    body = zone('ok', '✅', 'Działka poza obszarami zagrożenia powodziowego na mapach ISOK.')
      + '<p class="hint">Mapy obejmują rzeki z wyznaczonym ryzykiem powodziowym; nie pokazują podtopień ani zalewania przez małe cieki i opady nawalne.</p>'
  } else {
    body = f.scenarios.map(s => zone(s === 'Q10' || s === 'Q1' ? 'risk' : 'warn', '🌊', esc(SCENARIO_LABEL[s]))).join('')
      + (f.risk.length ? row('Strefa ryzyka', esc(f.risk.map(r => `${r.level} (${SCENARIO_LABEL[r.scenario].split(' –')[0]})`).join('; '))) : '')
      + (f.oszp ? '<p class="hint">Q10% i Q1% to obszary szczególnego zagrożenia powodzią — obowiązują ograniczenia z ustawy Prawo wodne.</p>' : '')
  }
  if (f?.validTo) body += `<p class="hint">Mapy w usłudze ISOK z okresem ważności do ${esc(date(f.validTo))} — sprawdź, czy nie opublikowano aktualizacji.</p>`
  return section('Zagrożenie powodziowe', '🌊', body + `<p class="hint">Źródło: ${link(ISOK_MAP_URL, 'Wody Polskie / ISOK')}.</p>`)
}

function natureSection(d: ReportData): string {
  const n = d.nature
  let body: string
  if (!n) body = zone('unk', '❓', 'Źródło GDOŚ niedostępne — sprawdź na geoserwis.gdos.gov.pl.')
  else {
    body = n.onParcel.length
      ? n.onParcel.map(a => zone('risk', '🌿', `<strong>Na działce:</strong> ${esc(a.type)} „${esc(a.name)}”`)).join('')
      : zone('ok', '✅', 'Działka nie leży w obszarze chronionym (Natura 2000, park, rezerwat, OChK).')
    body += n.nearby.map(a => zone('warn', '🌲', `W odległości do ${NEARBY_M} m: ${esc(a.type)} „${esc(a.name)}”`)).join('')
  }
  return section('Ochrona przyrody', '🌿', body + '<p class="hint">Źródło: Generalna Dyrekcja Ochrony Środowiska (GDOŚ).</p>')
}

function utilitiesSection(d: ReportData): string {
  let kiut: string
  if (d.gesut) {
    kiut = (Object.keys(NETWORKS) as Network[]).map(n => {
      const v = d.gesut![n]
      const txt = v.crosses ? 'przebiega przez działkę'
        : v.distanceM === null ? `brak w promieniu ok. ${GESUT_WINDOW_M} m` : `${v.distanceM} m od granicy działki`
      const cls = v.crosses || (v.distanceM !== null && v.distanceM <= 50) ? 'ok' : v.distanceM === null ? 'unk' : 'warn'
      return `<div class="row"><span class="row-label">${esc(NETWORKS[n].label)}</span><span class="row-value ${cls}">${esc(txt)}</span></div>`
    }).join('')
    kiut += '<p class="hint">Źródło: Krajowa Integracja Uzbrojenia Terenu (GUGiK). Odległość mierzona z mapy (±2 m). Rejestr nie pokazuje, czy sieć ma wolną moc/przepustowość — o przyłączeniu decyduje operator (warunki przyłączenia).</p>'
  } else if (d.gesutStatus === 'not_covered') {
    kiut = '<p class="no-data">Powiat nie przekazuje danych o sieciach do Krajowej Integracji Uzbrojenia Terenu — brak danych to nie to samo co brak sieci. Sprawdź w powiatowym ośrodku dokumentacji (mapa zasadnicza) lub u operatorów.</p>'
  } else {
    kiut = '<p class="no-data">Rejestr uzbrojenia terenu był niedostępny.</p>'
  }

  const osm = d.osm
    ? osmLines(d)
    : '<p class="hint">OpenStreetMap: źródło niedostępne.</p>'

  const sip = d.sip
    ? (['wodociag', 'kanalizacja', 'gaz', 'energia'] as const).map(k => row(`${k[0].toUpperCase()}${k.slice(1)} (dane gminy)`, esc(d.sip![k] ?? null))).join('') + row('Uwagi', esc(d.sip.uwagi))
    : ''

  const legend = [{ color: '#FACC15', label: 'Granica działki', dash: true }, ...NETWORK_STYLES.map(s => ({ ...s, dash: false }))]
    .map(l => `<span class="legend-item"><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="${l.color}" stroke-width="3"${l.dash ? ' stroke-dasharray="6 3"' : ''}/></svg>${esc(l.label)}</span>`).join('')
  const map = d.utilityMapUrl
    ? `<img src="${esc(d.utilityMapUrl)}" alt="Mapa uzbrojenia terenu" style="width:100%;border-radius:8px;display:block;margin-top:12px"/>
       <div class="legend">${legend}</div>
       <p class="hint">Mapa: ortofotomapa i działki ewidencyjne (GUGiK), sieci z Krajowej Integracji Uzbrojenia Terenu. Brak linii na mapie nie oznacza braku sieci, jeśli powiat nie przekazuje danych.</p>`
    : ''
  return section('Uzbrojenie terenu', '⚡', kiut + osm + sip + map, true)
}

function osmLines(d: ReportData): string {
  const o = d.osm!
  const lines = [...o.power, ...o.pipelines]
  if (!lines.length) return `<p class="hint">OpenStreetMap: brak linii energetycznych i rurociągów w promieniu ${OSM_RADIUS_M} m (OSM nie jest rejestrem sieci).</p>`
  return '<div class="sub-title">Linie i rurociągi w OpenStreetMap (do ' + OSM_RADIUS_M + ' m)</div>' + lines.slice(0, 6).map(l =>
    row(l.kind === 'rurociąg' ? `Rurociąg${l.substance ? ` (${l.substance})` : ''}` : `${l.kind[0].toUpperCase()}${l.kind.slice(1)}${l.voltage ? ` ${l.voltage.split(';').map(v => `${Math.round(Number(v) / 1000)} kV`).join('/')}` : ''}`,
      esc(`${l.distanceM} m${l.operator ? ` · ${l.operator}` : ''}`))).join('')
}

function aiSection(ai: AiInsights): string {
  const li = (items: string[], risk = false) =>
    items.length ? items.map(t => `<li class="ai-item${risk ? ' risk' : ''}">${esc(t)}</li>`).join('') : '<li class="ai-item">Brak.</li>'
  const note = ai.model
    ? `Wygenerowane przez model ${esc(ai.model)} wyłącznie na podstawie danych z tego raportu${ai.odrzucone ? `; odrzucono ${ai.odrzucone} pkt bez pokrycia w danych` : ''}.`
    : 'Rekomendacje wygenerowane regułami na podstawie danych z raportu (moduł AI niedostępny).'
  return `
    ${section('Rekomendacje', '✨', `<ul class="ai-list">${li(ai.rekomendacje)}</ul><p class="hint">${note}</p>`)}
    ${section('Ryzyka inwestycyjne', '⚠', `<ul class="ai-list">${li(ai.ryzyka, true)}</ul>`)}`
}

function sourcesSection(d: ReportData): string {
  const rows = d.sources.map(s =>
    `<tr><td>${esc(s.source)}</td><td>${esc(STATUS_LABEL[s.status] ?? s.status)}${s.stale ? '<br><small>⚠️ źródło nie odpowiedziało — użyto wcześniej pobranych danych</small>' : ''}</td><td>${esc(warsawTime(s.fetchedAt))}</td></tr>`).join('')
  return section('Źródła danych i ich status', '🔎', `<table class="src"><thead><tr><th>Źródło</th><th>Status</th><th>Pobrano</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">„Źródło niedostępne” oznacza, że nie wiemy — nie że problemu nie ma. Dane pochodzą z rejestrów publicznych; kolumna „Pobrano” pokazuje, kiedy je pobraliśmy. Wyniki uznajemy za aktualne najwyżej przez dobę; starszych używamy tylko, gdy źródło nie odpowiada, i oznaczamy je w tabeli.</p>`, true)
}

export function buildReportHtml(d: ReportData, ai: AiInsights): string {
  const generated = warsawTime(d.generatedAt)
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Raport działki ${esc(d.parcel.numer)} – ${esc(d.parcel.gmina)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  :root { --green:#15803d; --green-l:#dcfce7; --amber:#d97706; --amber-l:#fef3c7; --red:#b91c1c; --red-l:#fee2e2; --gray:#6b7280; --border:#f0f0f0; --text:#111827; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',system-ui,sans-serif; font-size:13.5px; color:var(--text); line-height:1.65; background:#fff; }
  a { color:var(--green); }
  .page { max-width:860px; margin:0 auto; padding:48px 36px 64px; }
  .header { display:flex; align-items:flex-start; justify-content:space-between; border-bottom:1.5px solid var(--border); padding-bottom:24px; margin-bottom:32px; gap:16px; }
  .brand { font-family:'Playfair Display',serif; font-size:13px; font-weight:600; color:var(--green); margin-bottom:10px; }
  .header h1 { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; line-height:1.25; }
  .header h1 strong { font-weight:700; }
  .meta { font-size:12px; color:var(--gray); margin-top:8px; }
  .badge { display:inline-block; font-size:11px; font-weight:600; color:var(--green); background:var(--green-l); border:1px solid #bbf7d0; border-radius:999px; padding:3px 10px; white-space:nowrap; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  @media (max-width:640px) { .grid { grid-template-columns:1fr; } .page { padding:24px 16px 40px; } }
  .section { border:1px solid var(--border); border-radius:14px; padding:20px 22px; break-inside:avoid; min-width:0; }
  .section.full { grid-column:1 / -1; }
  .section-title { font-family:'Playfair Display',serif; font-size:15px; font-weight:600; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
  .section-title .icon { width:22px; height:22px; background:var(--green-l); border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:12px; }
  .sub-title { font-weight:600; font-size:12.5px; margin:14px 0 6px; }
  .row { display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:6px 0; border-bottom:1px solid var(--border); font-size:13px; }
  .row:last-child { border-bottom:none; }
  .row-label { color:var(--gray); flex-shrink:0; max-width:48%; }
  .row-value { font-weight:500; text-align:right; overflow-wrap:anywhere; }
  .row-value.ok { color:var(--green); } .row-value.warn { color:var(--amber); } .row-value.unk { color:var(--gray); }
  .muted { color:var(--gray); font-weight:400; }
  hr { border:none; border-top:1px dashed #e5e7eb; margin:8px 0; }
  .no-data { color:var(--gray); font-style:italic; font-size:13px; }
  .hint { font-size:11px; color:#9ca3af; margin-top:8px; line-height:1.5; }
  .zone-row { padding:8px 12px; border-radius:8px; margin-bottom:6px; font-size:13px; display:flex; gap:8px; line-height:1.5; }
  .zone-ok { background:var(--green-l); } .zone-warn { background:var(--amber-l); } .zone-risk { background:var(--red-l); } .zone-unk { background:#f9fafb; }
  .zone-icon { flex-shrink:0; }
  .ai-list { list-style:none; }
  .ai-item { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px; line-height:1.55; }
  .ai-item:last-child { border-bottom:none; }
  .ai-item::before { content:'→'; color:var(--green); font-weight:700; flex-shrink:0; }
  .ai-item.risk::before { content:'⚠'; color:var(--amber); }
  .legend { display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:8px; font-size:11px; color:#374151; }
  .legend-item { display:inline-flex; align-items:center; gap:6px; }
  table.src { width:100%; border-collapse:collapse; font-size:12px; }
  table.src th, table.src td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--border); vertical-align:top; }
  table.src th { color:var(--gray); font-weight:500; }
  .disclaimer { margin-top:32px; padding:14px 18px; background:#fffbeb; border:1px solid #fde68a; border-radius:12px; font-size:12px; color:#92400e; line-height:1.6; }
  .footer { margin-top:28px; padding-top:20px; border-top:1px solid var(--border); display:flex; justify-content:space-between; font-size:11px; color:#9ca3af; }
  .footer-brand { font-family:'Playfair Display',serif; font-size:12px; font-weight:600; color:var(--green); }
  @media print { body { font-size:12px; } .page { padding:0; } .grid { gap:14px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">SprawdzDziałkę.pl</div>
      <h1>Raport działki <strong>${esc(d.parcel.numer)}</strong><br/>${esc(d.parcel.gmina)}${d.parcel.obreb ? `, obręb ${esc(d.parcel.obreb)}` : ''}</h1>
      <div class="meta">Wygenerowano: ${esc(generated)} · identyfikator ${esc(d.parcelId)}</div>
    </div>
    <div><span class="badge">Raport planistyczny</span></div>
  </div>
  <div class="grid">
    ${summarySection(d)}
    ${parcelSection(d)}
    ${mpzpSection(d)}
    ${pogSection(d)}
    ${floodSection(d)}
    ${natureSection(d)}
    ${utilitiesSection(d)}
    ${aiSection(ai)}
    ${sourcesSection(d)}
  </div>
  <div class="disclaimer">
    <strong>Ważna informacja:</strong> Raport ma charakter informacyjny i nie stanowi wypisu i wyrysu z planu, zaświadczenia
    ani interpretacji prawa miejscowego. Dane pochodzą z rejestrów publicznych w chwili generowania i mogą być niekompletne lub nieaktualne.
    Przed decyzją o zakupie potwierdź stan planistyczny w urzędzie gminy, a warunki przyłączenia mediów u operatorów sieci.
  </div>
  <div class="footer"><span class="footer-brand">SprawdzDziałkę.pl</span><span>Raport wygenerowany: ${esc(generated)}</span></div>
</div>
</body>
</html>`
}
