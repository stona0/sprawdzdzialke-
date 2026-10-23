import Anthropic from '@anthropic-ai/sdk'
import { NETWORKS, type Network } from '../sources/gesut'
import { SCENARIO_LABEL } from '../sources/isok'
import { LINE_LABEL } from '../sources/power-lines'
import type { Pog } from '../pog'
import type { ReportData } from './collect'

export const AI_MODEL = 'claude-haiku-4-5'

const FACT_KEYS = ['dzialka', 'ocena_zabudowy', 'mpzp', 'plan_ogolny', 'powodz', 'przyroda', 'uzbrojenie', 'ustalenia'] as const
type FactKey = (typeof FACT_KEYS)[number]

export interface AiInsights {
  rekomendacje: string[]
  ryzyka: string[]
  /** Model, który wygenerował treść; null = reguły (AI niedostępne lub odrzucone). */
  model: string | null
  /** Ile punktów AI odrzucono jako nieoparte na danych. */
  odrzucone: number
  /** Szczegóły wywołania (do ewaluacji i logów) — nie trafiają do raportu. */
  meta?: {
    /** Model, który faktycznie odpowiedział (także gdy treść odrzucono). */
    servedModel: string
    usage: Anthropic.Usage
    stopReason: string | null
    /** Punkty z podstawą, zanim walidator odrzucił część z nich. */
    raw: { rekomendacje: RawItem[]; ryzyka: RawItem[] } | null
    fallbackReason?: string
  }
}

export interface InsightsOptions {
  model?: string
  /** Tylko modele z parametrem effort (Haiku 4.5 go nie ma). */
  effort?: 'low' | 'medium' | 'high'
  maxTokens?: number
}

const BRAK = 'brak danych (źródło niedostępne lub nie obejmuje obszaru)'

// Model zamyka typograficzny cudzysłów „…” znakiem ASCII, co przy structured outputs
// kończy string JSON w pół zdania — usuwamy cudzysłowy z faktów.
function unquote<T>(v: T): T {
  return JSON.parse(JSON.stringify(v).replace(/[„”“]/g, '')) as T
}

/** Treść wiadomości użytkownika wysyłanej do modelu. */
export const factsMessage = (facts: Record<string, unknown>) => `Fakty o działce:\n${JSON.stringify(facts, null, 1)}`

export function buildFacts(d: ReportData): Record<FactKey, unknown> {
  return unquote(rawFacts(d))
}

function rawFacts(d: ReportData): Record<FactKey, unknown> {
  const w = d.mpzp.wroclaw
  const mpzp =
    d.mpzp.covered === false ? 'działka nie jest objęta MPZP'
      : d.mpzp.covered === null ? BRAK
        : w ? {
          tereny: w.zones.map(z => ({ symbol: z.symbol, przeznaczenie: z.przeznaczenie ?? z.klasyfikacja, udzial_proc: z.sharePct })),
          plany: w.plans.map(p => p.tytul),
        }
          : (d.mpzp.kimpzp ?? []).map(p => ({ tytul: p.tytul, symbol: p.symbol, przeznaczenie: p.przeznaczenie, uchwala: p.uchwala }))

  const strefy = (p: Pog) => p.strefy.map(s => ({
    oznaczenie: s.oznaczenie, nazwa: s.nazwa, udzial_proc: s.sharePct, maks_wysokosc_m: s.maks_wysokosc,
    maks_intensywnosc: s.maks_intensywnosc, maks_udzial_zabudowy_proc: s.maks_udzial_zabudowy, min_pbc_proc: s.min_pbc,
  }))
  const projekt = d.pog.draft
    ? {
      projekt_planu_nieobowiazujacy_moze_sie_zmienic: {
        status: d.pog.ru?.draft?.status ?? 'projekt',
        strefy: strefy(d.pog.draft),
        w_projektowanym_obszarze_uzupelnienia_zabudowy: !!d.pog.draft.obszar_uzupelnienia_zabudowy,
      },
    }
    : {}
  const plan = d.pog.plan
  const plan_ogolny = plan
    ? { obowiazuje: true, zrodlo: plan.zrodlo, strefy: strefy(plan), obszar_uzupelnienia_zabudowy: !!plan.obszar_uzupelnienia_zabudowy, ...projekt }
    : d.pog.inForce === null ? BRAK
      : { obowiazuje: d.pog.inForce, status_w_rejestrze: d.pog.ru?.entry?.status ?? 'brak wpisu', ...projekt }

  const powodz = d.flood
    ? d.flood.scenarios.length
      ? {
        scenariusze: d.flood.scenarios.map(s => SCENARIO_LABEL[s]),
        poziom_ryzyka: d.flood.risk.map(r => `${r.level} (${SCENARIO_LABEL[r.scenario].split(' –')[0]})`),
        obszar_szczegolnego_zagrozenia_powodzia: d.flood.oszp,
      }
      : 'brak stref zagrożenia na mapach ISOK'
    : BRAK

  const przyroda = d.nature
    ? {
      co_najmniej_czesc_dzialki_lezy_w: d.nature.onParcel.map(a => `${a.type}: ${a.name}`),
      w_odleglosci_do_300_m_od_dzialki: d.nature.nearby.map(a => `${a.type}: ${a.name}`),
    }
    : BRAK

  const kiut = d.gesut
    ? Object.fromEntries((Object.keys(NETWORKS) as Network[]).map(n => [
      NETWORKS[n].label,
      d.gesut![n].crosses ? 'przebiega przez działkę'
        : d.gesut![n].distanceM === null ? 'nie stwierdzono w promieniu 100 m od działki' : `${d.gesut![n].distanceM} m od granicy działki`,
    ]))
    : d.gesutStatus === 'not_covered' ? 'brak danych w KIUT dla tego obszaru' : BRAK

  return {
    dzialka: { numer: d.parcel.numer, gmina: d.parcel.gmina, obreb: d.parcel.obreb, powierzchnia_m2: d.parcel.powierzchnia },
    ocena_zabudowy: { werdykt: d.assessment.title, opis: d.assessment.text },
    mpzp,
    plan_ogolny,
    powodz,
    przyroda,
    uzbrojenie: {
      kiut,
      ...(d.powerLines
        ? {
          linie_napowietrzne_bdot10k: d.powerLines.lines.length
            ? d.powerLines.lines.slice(0, 4).map(l => `${LINE_LABEL[l.klasa]}: ${l.crosses ? 'przebiega przez działkę' : `${l.distanceM} m od granicy działki`}`)
            : `brak linii SN/WN/NN w promieniu ${d.powerLines.radiusM} m`,
          rurociagi_bdot10k: d.powerLines.pipelines.slice(0, 3).map(p => `rurociąg ${p.rodzaj ?? ''}: ${p.crosses ? 'przebiega przez działkę' : `${p.distanceM} m od granicy działki`}`),
          zakres_bdot10k: 'tylko linie napowietrzne SN i wyższe oraz rurociągi; bez linii niskiego napięcia i kabli',
        }
        : { osm_linie_energetyczne: d.osm ? d.osm.power.slice(0, 3).map(p => `${p.kind}${p.voltage ? ` ${p.voltage} V` : ''}, ${p.distanceM} m`) : BRAK }),
    },
    ustalenia: d.findings.map(f => f.text),
  }
}

const itemSchema = {
  type: 'object',
  properties: {
    tekst: { type: 'string' },
    podstawa: { type: 'array', items: { type: 'string', enum: [...FACT_KEYS] } },
  },
  required: ['tekst', 'podstawa'],
  additionalProperties: false,
}

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    rekomendacje: { type: 'array', items: itemSchema },
    ryzyka: { type: 'array', items: itemSchema },
  },
  required: ['rekomendacje', 'ryzyka'],
  additionalProperties: false,
}

export const AI_SYSTEM_PROMPT = `Jesteś doradcą osoby, która rozważa zakup działki w Polsce. Dostajesz fakty o działce w JSON, zebrane z rejestrów publicznych.

Zasady:
- Opieraj się WYŁĄCZNIE na faktach z JSON. Nie podawaj liczb, symboli, nazw, dat ani przepisów, których tam nie ma.
- Nie twórz własnych interpretacji prawnych ani nazw dokumentów urzędowych. Z dokumentów wymieniaj tylko: wypis i wyrys z MPZP lub planu ogólnego, decyzja o warunkach zabudowy, warunki przyłączenia, księga wieczysta, wypis z rejestru gruntów.
- Ocena zabudowy („ocena_zabudowy”) jest już rozstrzygnięta — nie podważaj jej i nie dopisuj nowych warunków prawnych.
- Gdy fakt to „brak danych”, zalecaj konkretną weryfikację (gdzie i co sprawdzić) zamiast zgadywać.
- Kierując do instytucji, wybieraj tylko spośród: urząd gminy, starostwo powiatowe (geodezja), PGW Wody Polskie (powódź), regionalna dyrekcja ochrony środowiska (przyroda), wojewódzki konserwator zabytków, operator sieci (warunki przyłączenia), notariusz, geodeta.
- Nie używaj cudzysłowów. Nie uogólniaj: jeśli fakt mówi o części działki, nie pisz o całej.
- Każdy punkt ma pole „podstawa”: klucze faktów, z których wynika.
- Do 4 rekomendacji (konkretne działania przed zakupem) i do 4 ryzyk. Każdy punkt maks. 2 zdania, po polsku.`

export interface RawItem {
  tekst: string
  podstawa: string[]
}

const NUM = /\d+(?:[.,]\d+)*/g
const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
const DATE_WORDS = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})`, 'giu')
const DATE_NUM = /^0?(\d{1,2})\.(\d{2})\.(\d{4})$/
const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g
const isoToPl = (s: string) => s.replace(DATE_ISO, (_, y: string, m: string, d: string) => `${+d}.${m}.${y}`)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Tekst punktu w postaci porównywalnej z faktami: „1 września 2026” i „2026-09-01” → „1.09.2026”,
 * a odwołanie „działki 440/1” / „na działce 440/1” traci numer — to identyfikator, nie wartość. Numer z jednostką („działka 24 ha”) zostaje i musi wynikać z faktów.
 */
function comparable(tekst: string, numer: unknown): string {
  const t = isoToPl(tekst).replace(DATE_WORDS, (_, d: string, m: string, y: string) =>
    `${+d}.${String(MONTHS.indexOf(m.toLowerCase()) + 1).padStart(2, '0')}.${y}`)
  if (!numer) return t
  const ref = new RegExp(`(dział[kc]\\p{L}*\\s+(?:nr\\.?\\s*|numer\\s+)?)${escapeRe(String(numer))}(?![\\d/]|[.,]\\d)(?!\\s*(?:%|(?:m²|m2|m|ha|km|kV)(?!\\p{L})))`, 'giu')
  return t.replace(ref, '$1')
}

/** Odrzuca punkty bez podstawy w faktach lub z liczbami, których w faktach nie ma. */
export function validateItems(items: RawItem[], facts: Record<string, unknown>): { ok: string[]; rejected: number } {
  // Numer działki to identyfikator, nie wartość — „9” z „19/9” nie może uwiarygodnić „9 m”.
  const { dzialka, ...rest } = facts as Record<string, unknown> & { dzialka?: Record<string, unknown> }
  const values = { ...rest, dzialka: { ...(dzialka ?? {}), numer: undefined } }
  const norm = (n: string) => n.replace(/,/g, '.').replace(DATE_NUM, (_, d: string, m: string, y: string) => `${+d}.${m}.${y}`)
  const known = new Set((isoToPl(JSON.stringify(values)).match(NUM) ?? []).map(norm))
  // Rok z daty w faktach („od września 2026”) też jest znany.
  for (const n of [...known]) { const y = DATE_NUM.exec(n)?.[3]; if (y) known.add(y) }
  const ok: string[] = []
  let rejected = 0
  for (const it of items) {
    const basisOk = it.podstawa.length > 0 && it.podstawa.every(k => (FACT_KEYS as readonly string[]).includes(k))
    const nums = (comparable(it.tekst, dzialka?.numer).match(NUM) ?? []).map(norm)
    const numsOk = nums.every(n => known.has(n))
    if (basisOk && numsOk && it.tekst.trim()) ok.push(it.tekst.trim())
    else rejected++
  }
  return { ok, rejected }
}

export function ruleBasedInsights(d: ReportData): Omit<AiInsights, 'model' | 'odrzucone'> {
  const rek: string[] = []
  switch (d.assessment.verdict) {
    case 'mpzp':
      rek.push('Zamów w urzędzie wypis i wyrys z MPZP i sprawdź parametry zabudowy (wysokość, powierzchnia biologicznie czynna, linie zabudowy) dla konkretnego terenu.')
      break
    case 'wz_mozliwe':
      rek.push('Przed zakupem złóż wniosek o decyzję o warunkach zabudowy albo zastrzeż w umowie przedwstępnej warunek jej uzyskania.')
      break
    case 'wz_niemozliwe_poza_ouz':
    case 'wz_niemozliwe_brak_pog':
      rek.push('Nie kupuj działki pod budowę bez potwierdzenia w urzędzie gminy, że istnieje ścieżka do pozwolenia na budowę (MPZP lub decyzja WZ).')
      break
    default:
      rek.push('Ustal w urzędzie gminy, czy działkę obejmuje MPZP i czy gmina ma obowiązujący plan ogólny.')
  }
  if (d.gesutStatus !== 'ok') rek.push('Wystąp do lokalnych operatorów sieci o warunki przyłączenia — w rejestrze uzbrojenia brak danych dla tej okolicy.')
  else rek.push('Wystąp do operatorów o warunki przyłączenia — odległość sieci z rejestru nie przesądza o możliwości podłączenia.')
  rek.push('Sprawdź księgę wieczystą (obciążenia, służebności, hipoteki) i zleć geodecie wznowienie granic.')
  return {
    rekomendacje: rek.slice(0, 4),
    ryzyka: d.findings.filter(f => f.level !== 'ok').map(f => f.text).slice(0, 4),
  }
}

export async function generateInsights(d: ReportData, client?: Anthropic, opts: InsightsOptions = {}): Promise<AiInsights> {
  const facts = buildFacts(d)
  const fallback = (odrzucone: number, meta?: AiInsights['meta']): AiInsights => ({ ...ruleBasedInsights(d), model: null, odrzucone, ...(meta ? { meta } : {}) })
  if (!client && !process.env.ANTHROPIC_API_KEY) return fallback(0)
  try {
    const anthropic = client ?? new Anthropic()
    const response = await anthropic.messages.create({
      model: opts.model ?? AI_MODEL,
      max_tokens: opts.maxTokens ?? 2000,
      system: AI_SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA }, ...(opts.effort ? { effort: opts.effort } : {}) },
      messages: [{ role: 'user', content: factsMessage(facts) }],
    }, { timeout: 30_000, maxRetries: 1 })
    const base = { servedModel: response.model, usage: response.usage, stopReason: response.stop_reason, raw: null }
    if (response.stop_reason !== 'end_turn') return fallback(0, { ...base, fallbackReason: `stop_reason: ${response.stop_reason}` })
    const text = response.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
    const parsed = JSON.parse(text) as { rekomendacje: RawItem[]; ryzyka: RawItem[] }
    const meta = { ...base, raw: parsed }
    const rek = validateItems(parsed.rekomendacje.slice(0, 4), facts)
    const ryz = validateItems(parsed.ryzyka.slice(0, 4), facts)
    if (!rek.ok.length) return fallback(rek.rejected + ryz.rejected, { ...meta, fallbackReason: 'walidator odrzucił wszystkie rekomendacje' })
    return { rekomendacje: rek.ok, ryzyka: ryz.ok, model: response.model, odrzucone: rek.rejected + ryz.rejected, meta }
  } catch (e) {
    console.error('[ai] generateInsights failed:', e instanceof Error ? e.message : e)
    return fallback(0)
  }
}
