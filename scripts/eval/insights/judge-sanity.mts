/**
 * Kontrola sędziego przed pełnym biegiem (eval-audit: oracle / znane negatywy).
 * Płatne: 4 wywołania sędziego (~$0,15).
 *
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/eval/insights/judge-sanity.mts
 */
import { readFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { buildFacts, ruleBasedInsights } from '../../../src/lib/report/ai'
import type { ReportData } from '../../../src/lib/report/collect'
import { judgeInsights } from './judge.mjs'

const load = (id: string) => (JSON.parse(readFileSync(`tests/eval/insights/cases/${id}.json`, 'utf8')) as { data: ReportData }).data
const client = new Anthropic()

interface Check { name: string; data: ReportData; rekomendacje: string[]; ryzyka: string[]; expect: (v: Verdict) => string | null }
type Item = { id: string; ocena: string; konkretna?: boolean; uzasadnienie: string }
type Verdict = { rekomendacje: Item[]; ryzyka: Item[]; pokrycie: { id: string; pokryte: boolean }[] }

const siechnice = load('siechnice-ouz') // bez MPZP, bez stref ISOK, w OUZ
const milicz = load('milicz-natura2000')
const rules = ruleBasedInsights(milicz)

const checks: Check[] = [
  {
    name: 'oracle: rekomendacje z reguł (poprawne z definicji)',
    data: milicz, rekomendacje: rules.rekomendacje.map(i => i.tekst), ryzyka: rules.ryzyka.map(i => i.tekst),
    expect: v => {
      const bad = [...v.rekomendacje, ...v.ryzyka].filter(i => i.ocena !== 'zgodny')
      return bad.length ? `oczekiwano samych „zgodny”, jest: ${bad.map(b => `${b.id} ${b.ocena}`).join(', ')}` : null
    },
  },
  {
    name: 'podrzucone błędy (każdy musi zostać oznaczony)',
    data: siechnice,
    rekomendacje: [
      'Skontaktuj się z Biurem Obsługi Geodety w celu uzyskania mapy sieci na działce.',
      'Zamów w urzędzie gminy wypis i wyrys z planu ogólnego dla strefy 685SJ.',
    ],
    ryzyka: [
      'Cała działka leży w strefie zagrożenia powodziowego Q1%.',
      'Działka jest objęta MPZP z przeznaczeniem pod zabudowę usługową.',
      'Bliskość linii średniego napięcia oznacza zagrożenie dla zdrowia z powodu pól elektromagnetycznych.',
    ],
    expect: v => {
      const err: string[] = []
      if (v.rekomendacje[0]?.ocena === 'zgodny') err.push('R1 (instytucja spoza listy) uznana za zgodną')
      if (v.rekomendacje[1]?.ocena !== 'zgodny') err.push(`R2 (poprawna) oceniona jako ${v.rekomendacje[1]?.ocena}`)
      for (const [k, i] of v.ryzyka.entries()) if (i.ocena === 'zgodny') err.push(`Z${k + 1} uznane za zgodne`)
      return err.length ? err.join('; ') : null
    },
  },
  {
    name: 'odpowiedź o innej działce',
    data: siechnice,
    rekomendacje: ['Działka w Gdańsku przy plaży wymaga zgody urzędu morskiego — wystąp o nią przed zakupem.'],
    ryzyka: ['Grunt leśny wymaga zmiany przeznaczenia przed zabudową.'],
    expect: v => ([...v.rekomendacje, ...v.ryzyka].some(i => i.ocena === 'zgodny') ? 'punkt o innej działce uznany za zgodny' : null),
  },
  {
    name: '„Nie wiem” jako rekomendacja',
    data: siechnice,
    rekomendacje: ['Nie wiem.'],
    ryzyka: [],
    expect: v => (v.rekomendacje[0]?.konkretna ? '„Nie wiem.” uznane za konkretną rekomendację' : null),
  },
]

let failed = 0
for (const c of checks) {
  const findings = c.data.findings.filter(f => f.level === 'ryzyko')
  const r = await judgeInsights(client, { facts: buildFacts(c.data), assessment: c.data.assessment, findings, rekomendacje: c.rekomendacje, ryzyka: c.ryzyka })
  const problem = c.expect(r.verdict as Verdict)
  if (problem) failed++
  console.log(`${problem ? '✘' : '✔'} ${c.name}${problem ? ` — ${problem}` : ''}  [${r.judge_model}, in ${r.judge_usage.input_tokens} / out ${r.judge_usage.output_tokens} tok]`)
  for (const i of [...(r.verdict as Verdict).rekomendacje, ...(r.verdict as Verdict).ryzyka]) console.log(`    ${i.id} ${i.ocena}${i.konkretna !== undefined ? ` (konkretna: ${i.konkretna})` : ''}: ${i.uzasadnienie}`)
}
console.log(failed ? `\n${failed} z ${checks.length} kontroli nie przeszło — popraw rubrykę przed pełnym biegiem.` : `\nWszystkie ${checks.length} kontrole przeszły.`)
process.exit(failed ? 1 : 0)
