/**
 * scraper.ts
 * Automatyczny scraper BIP → PDF uchwały MPZP → Claude parse → Supabase
 *
 * Strategia wyszukiwania PDF na BIPie:
 *  1. Jeśli gmina ma mpzp_url → idź tam bezpośrednio
 *  2. Szukaj na stronie głównej linków z frazami MPZP/plan
 *  3. Wejdź na znalezione podstrony i znajdź PDF
 *  4. Pobierz PDF → prześlij do /api/admin/parse-mpzp → /api/admin/save-mpzp
 */

import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { GMINY_WROCLAW, type GminaConfig } from './gminy'

// ─── Konfiguracja ─────────────────────────────────────────────────────────────

const BASE_URL      = process.env.SCRAPER_API_URL ?? 'http://localhost:3001'
const ADMIN_COOKIE  = process.env.SCRAPER_SESSION  ?? ''   // skopiuj cookie z przeglądarki po zalogowaniu
const DELAY_MS      = 2000   // przerwa między gminami (uprzejmość wobec serwerów)
const PDF_DIR       = path.join(__dirname, '../../.mpzp-pdfs')
const LOG_FILE      = path.join(__dirname, '../../.mpzp-log.json')

// Frazy wskazujące stronę z MPZP
const MPZP_LINK_HINTS = [
  'mpzp', 'miejscowy plan', 'zagospodarowania przestrzennego',
  'planowanie przestrzenne', 'uchwała mpzp', 'plan miejscowy',
]

// ─── Typy ─────────────────────────────────────────────────────────────────────

interface ScrapeResult {
  gmina: string
  teryt: string
  status: 'ok' | 'no_pdf' | 'parse_error' | 'save_error' | 'skip'
  pdfsFound: number
  symbolsSaved: number
  pdfUrls: string[]
  error?: string
  timestamp: string
}

// ─── Narzędzia ────────────────────────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function linkMatchesHint(text: string, href: string): boolean {
  const lower = (text + ' ' + href).toLowerCase()
  return MPZP_LINK_HINTS.some(h => lower.includes(h))
}

async function downloadPdf(url: string, dest: string): Promise<boolean> {
  return new Promise(resolve => {
    const proto = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    proto.get(url, { headers: { 'User-Agent': 'SprawdzDzialke/1.0 MPZP-bot' } }, res => {
      if (res.statusCode !== 200) { resolve(false); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(true) })
    }).on('error', () => resolve(false))
  })
}

/** Wysyła PDF do istniejącego API parse-mpzp */
async function callParseApi(pdfPath: string, gmina: string): Promise<object | null> {
  try {
    const { FormData, Blob } = await import('node-fetch') as any  // node 18+
    const fd = new FormData()
    fd.append('pdf', new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' }), path.basename(pdfPath))
    fd.append('gmina', gmina)

    const res = await fetch(`${BASE_URL}/api/admin/parse-mpzp`, {
      method: 'POST',
      headers: { Cookie: ADMIN_COOKIE },
      body: fd as any,
    })
    if (!res.ok) { log(`  ✗ parse API ${res.status}: ${await res.text()}`); return null }
    return res.json()
  } catch (e) {
    log(`  ✗ parse API error: ${e}`)
    return null
  }
}

/** Wysyła sparsowane dane do API save-mpzp */
async function callSaveApi(result: object, teryt: string): Promise<number> {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/save-mpzp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ADMIN_COOKIE },
      body: JSON.stringify({ result, gmina_teryt: teryt }),
    })
    if (!res.ok) { log(`  ✗ save API ${res.status}: ${await res.text()}`); return 0 }
    const d: any = await res.json()
    return d.saved ?? 0
  } catch (e) {
    log(`  ✗ save API error: ${e}`)
    return 0
  }
}

// ─── Główna logika scrapowania jednej gminy ───────────────────────────────────

async function scrapeGmina(page: Page, gmina: GminaConfig): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    gmina: gmina.nazwa,
    teryt: gmina.teryt,
    status: 'no_pdf',
    pdfsFound: 0,
    symbolsSaved: 0,
    pdfUrls: [],
    timestamp: new Date().toISOString(),
  }

  try {
    // 1. Nawiguj do strony MPZP (bezpośredniej lub głównej BIP)
    const startUrl = gmina.mpzp_url ?? gmina.bip_url
    log(`  → Nawiguję: ${startUrl}`)

    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await sleep(800)

    // 2. Zbierz PDF linki ze strony (bezpośrednio lub przez podstrony)
    const pdfUrls = await collectPdfLinks(page, gmina)

    if (pdfUrls.length === 0) {
      log(`  ⚠ Brak PDF dla: ${gmina.nazwa}`)
      result.status = 'no_pdf'
      return result
    }

    log(`  ✓ Znaleziono ${pdfUrls.length} PDF(s)`)
    result.pdfsFound = pdfUrls.length
    result.pdfUrls = pdfUrls

    // 3. Pobierz i sparsuj każdy PDF
    for (const pdfUrl of pdfUrls.slice(0, 3)) { // max 3 PDFy na gminę
      const filename = `${gmina.teryt}_${Date.now()}.pdf`
      const destPath = path.join(PDF_DIR, filename)

      log(`  ↓ Pobieram: ${pdfUrl}`)
      const ok = await downloadPdf(pdfUrl, destPath)
      if (!ok) { log(`  ✗ Błąd pobierania`); continue }

      const fileSize = fs.statSync(destPath).size
      if (fileSize < 10_000) { log(`  ✗ PDF za mały (${fileSize} B) — pomijam`); continue }
      log(`  ✓ Pobrano ${(fileSize / 1024).toFixed(0)} KB`)

      // Parse przez Claude
      log(`  🤖 Claude parsuje...`)
      const parsed = await callParseApi(destPath, gmina.nazwa)
      if (!parsed) { result.status = 'parse_error'; continue }

      // Zapisz do bazy
      const saved = await callSaveApi(parsed, gmina.teryt)
      result.symbolsSaved += saved
      log(`  ✓ Zapisano ${saved} symboli terenów`)
    }

    result.status = result.symbolsSaved > 0 ? 'ok' : 'parse_error'
  } catch (e) {
    result.status = 'parse_error'
    result.error = String(e)
    log(`  ✗ Błąd: ${e}`)
  }

  return result
}

// ─── Zbieranie linków do PDF ──────────────────────────────────────────────────

async function collectPdfLinks(page: Page, gmina: GminaConfig): Promise<string[]> {
  const baseOrigin = new URL(gmina.bip_url).origin

  // Bezpośrednie linki PDF na bieżącej stronie
  let pdfs = await findPdfLinksOnPage(page, baseOrigin)
  if (pdfs.length > 0) return pdfs

  // Szukaj linków do podstron MPZP
  const subpageLinks = await page.evaluate((hints) => {
    return Array.from(document.querySelectorAll('a[href]'))
      .filter(a => {
        const text = (a.textContent ?? '').toLowerCase()
        const href = ((a as HTMLAnchorElement).href ?? '').toLowerCase()
        return hints.some((h: string) => text.includes(h) || href.includes(h))
      })
      .map(a => (a as HTMLAnchorElement).href)
      .filter(h => h && !h.endsWith('.pdf'))
      .slice(0, 5)
  }, MPZP_LINK_HINTS)

  // Wejdź na podstrony i szukaj PDF
  for (const subUrl of subpageLinks) {
    try {
      log(`    → Podstrona: ${subUrl}`)
      await page.goto(subUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      await sleep(500)
      pdfs = await findPdfLinksOnPage(page, baseOrigin)
      if (pdfs.length > 0) return pdfs
    } catch { /* ignoruj błędy nawigacji */ }
  }

  return []
}

async function findPdfLinksOnPage(page: Page, baseOrigin: string): Promise<string[]> {
  return page.evaluate((origin) => {
    const links = Array.from(document.querySelectorAll('a[href]'))
    return links
      .map(a => (a as HTMLAnchorElement).href)
      .filter(h => {
        if (!h) return false
        const lower = h.toLowerCase()
        // PDF który dotyczy MPZP/uchwały
        const isPdf = lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('getpdf') || lower.includes('attachment')
        if (!isPdf) return false
        const text = ((a: any) => a.textContent?.toLowerCase() ?? '')(document.querySelector(`a[href="${h}"]`))
        const relevant = lower.includes('mpzp') || lower.includes('plan') || lower.includes('uchwal')
          || text.includes('mpzp') || text.includes('plan') || text.includes('uchwał')
        return relevant || isPdf // pobierz wszystkie PDF jeśli mało linków
      })
      .slice(0, 5)
  }, baseOrigin)
}

// ─── Zapis logu ───────────────────────────────────────────────────────────────

function saveLog(results: ScrapeResult[]) {
  const summary = {
    run_at: new Date().toISOString(),
    total: results.length,
    ok: results.filter(r => r.status === 'ok').length,
    no_pdf: results.filter(r => r.status === 'no_pdf').length,
    errors: results.filter(r => r.status === 'parse_error' || r.status === 'save_error').length,
    symbols_saved: results.reduce((s, r) => s + r.symbolsSaved, 0),
    results,
  }
  fs.writeFileSync(LOG_FILE, JSON.stringify(summary, null, 2))
  return summary
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  // Sprawdź sesję
  if (!ADMIN_COOKIE) {
    console.error(`
❌ Brak SCRAPER_SESSION!

Jak uzyskać cookie sesji:
  1. Zaloguj się na ${BASE_URL}/login jako admin
  2. Otwórz DevTools → Application → Cookies
  3. Skopiuj wartość cookie "sb-*-auth-token" lub cały nagłówek Cookie
  4. Uruchom: SCRAPER_SESSION="twoje-cookie" npm run scrape-mpzp
    `)
    process.exit(1)
  }

  // Przygotuj katalog
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true })

  const targetGminy = process.env.GMINA
    ? GMINY_WROCLAW.filter(g => g.nazwa.toLowerCase().includes(process.env.GMINA!.toLowerCase()))
    : GMINY_WROCLAW

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MPZP Scraper — okolice Wrocławia
  Gminy do przetworzenia: ${targetGminy.length}
  API: ${BASE_URL}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; SprawdzDzialkeBot/1.0; +https://sprawdzdzialke.pl)',
    extraHTTPHeaders: { 'Accept-Language': 'pl-PL,pl;q=0.9' },
  })
  const page = await context.newPage()

  const results: ScrapeResult[] = []

  for (let i = 0; i < targetGminy.length; i++) {
    const gmina = targetGminy[i]
    console.log(`\n[${i + 1}/${targetGminy.length}] ${gmina.nazwa} (${gmina.powiat})`)
    console.log(`${'─'.repeat(50)}`)

    const result = await scrapeGmina(page, gmina)
    results.push(result)

    const icon = result.status === 'ok' ? '✅' : result.status === 'no_pdf' ? '⚠️' : '❌'
    log(`${icon} ${gmina.nazwa}: ${result.status} | PDF: ${result.pdfsFound} | Symbole: ${result.symbolsSaved}`)

    if (i < targetGminy.length - 1) await sleep(DELAY_MS)
  }

  await browser.close()

  const summary = saveLog(results)

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PODSUMOWANIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ OK:           ${summary.ok}/${summary.total} gmin
  ⚠️  Brak PDF:    ${summary.no_pdf} gmin
  ❌ Błędy:       ${summary.errors} gmin
  📦 Symboli DB:  ${summary.symbols_saved} łącznie

  Log zapisany: ${LOG_FILE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `)
}

main().catch(console.error)
