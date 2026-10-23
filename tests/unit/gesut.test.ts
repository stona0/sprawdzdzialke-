/**
 * Odległość do sieci z KIUT (src/lib/sources/gesut.ts) przy niekompletnych odpowiedziach serwera.
 * Fixture'y w tests/fixtures/kiut/gesut to prawdziwe odpowiedzi GetMap (23.10.2026) dla działki
 * 022307_4.0003.541 (Sobótka), po jednej warstwie, w siatce, o którą pyta gesut.ts. Serwer na to samo
 * zapytanie oddawał różne wersje: prąd 26 755 albo 1 462 px („czesciowa”), gaz 3 417 px albo pusto.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseULDKResponse } from '@/lib/geoportal'
import { clearCache, fetchWithRetry } from '@/lib/http'
import { queryGesut } from '@/lib/sources/gesut'

const FIX = path.join(__dirname, '../fixtures')
const SOBOTKA = '022307_4.0003.541'
const geom = parseULDKResponse(readFileSync(path.join(FIX, 'uldk/022307_4_0003_541.2180.txt'), 'utf8'), SOBOTKA, '').geom!
const png = (name: string) => readFileSync(path.join(FIX, 'kiut/gesut', `sobotka-${name}.png`))

type Reply = string | number // nazwa fixture'a albo kod HTTP
const LAYER = { energia: 'przewod_elektroenergetyczny', woda: 'przewod_wodociagowy', kanalizacja: 'przewod_kanalizacyjny', gaz: 'przewod_gazowy' }
const COMPLETE: Record<keyof typeof LAYER, Reply[]> = { energia: ['energia'], woda: ['woda'], kanalizacja: ['kanalizacja'], gaz: ['gaz'] }

/** Kolejne odpowiedzi KIUT dla każdej warstwy (ostatnia się powtarza); `wide` = sprawdzenie pokrycia (wszystkie warstwy). */
function kiut(replies: Partial<Record<keyof typeof LAYER | 'wide', Reply[]>>) {
  const plan = { ...COMPLETE, ...replies }
  const served: Record<string, number> = {}
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const layers = new URL(String(input)).searchParams.get('LAYERS')!
    const key = layers.includes(',') ? 'wide' : (Object.keys(LAYER) as Array<keyof typeof LAYER>).find(k => LAYER[k] === layers)!
    const queue = plan[key] ?? ['gaz-pusta']
    const reply = queue[Math.min(served[key] = (served[key] ?? -1) + 1, queue.length - 1)]
    if (typeof reply === 'number') return new Response('API calls quota exceeded! maximum admitted 10 per 2s.', { status: reply, headers: { 'Retry-After': '0' } })
    return new Response(png(reply), { status: 200, headers: { 'Content-Type': 'image/png' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => clearCache())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('KIUT: każda warstwa dwa razy, połączenie odpowiedzi', () => {
  it('zgodne, kompletne odpowiedzi → odległości do każdej sieci, wynik zapisany w cache', async () => {
    const f = kiut({})
    const r = await queryGesut(SOBOTKA, geom)
    expect(r.status).toBe('ok')
    expect(r.unconfirmed).toBeUndefined()
    expect(r.data).toEqual({
      energia: { distanceM: 0, crosses: true },
      woda: { distanceM: 7, crosses: false },
      kanalizacja: { distanceM: 0, crosses: true },
      gaz: { distanceM: 4, crosses: false },
    })
    expect(f).toHaveBeenCalledTimes(8)
    await queryGesut(SOBOTKA, geom)
    expect(f).toHaveBeenCalledTimes(8) // z cache
  })

  it('jedna odpowiedź bez gazu → gaz z drugiej (4 m zamiast „brak w promieniu 100 m”), wynik bez cache', async () => {
    const f = kiut({ gaz: ['gaz-pusta', 'gaz'] })
    const r = await queryGesut(SOBOTKA, geom)
    expect(r.data!.gaz).toEqual({ distanceM: 4, crosses: false })
    expect(r.unconfirmed).toBe(true)
    await queryGesut(SOBOTKA, geom)
    expect(f).toHaveBeenCalledTimes(16) // kolejny raport pyta KIUT od nowa
  })

  it('częściowa wersja sieci elektroenergetycznej łączy się z pełną', async () => {
    kiut({ energia: ['energia-czesciowa'] })
    const partial = await queryGesut(SOBOTKA, geom)
    clearCache()
    kiut({ energia: ['energia-czesciowa', 'energia'] })
    const merged = await queryGesut(SOBOTKA, geom)
    expect(partial.data!.energia).toEqual({ distanceM: 11, crosses: false }) // sama część gubi linię nad działką: „11 m” zamiast „przebiega przez działkę”
    expect(merged.data!.energia).toEqual({ distanceM: 0, crosses: true })
    expect(merged.unconfirmed).toBe(true)
  })

  it('obie odpowiedzi bez gazu → „brak gazu” i zapis w cache (ryzyko szczątkowe: zgodny brak nie jest wykrywalny)', async () => {
    kiut({ gaz: ['gaz-pusta'] })
    const r = await queryGesut(SOBOTKA, geom)
    expect(r.data!.gaz.distanceM).toBeNull()
    expect(r.unconfirmed).toBeUndefined()
  })

  it('429 przy jednej z odpowiedzi → wynik z drugiej, bez potwierdzenia; 429 przy obu → błąd źródła', async () => {
    kiut({ energia: [429, 'energia', 429] }) // pierwsza próba, druga próba, ponowienie pierwszej
    const r = await queryGesut(SOBOTKA, geom)
    expect(r.status).toBe('ok')
    expect(r.data!.energia.crosses).toBe(true)
    expect(r.unconfirmed).toBe(true)

    clearCache()
    kiut({ energia: [429] })
    expect((await queryGesut(SOBOTKA, geom)).status).toBe('error')
  })
})

describe('KIUT: sprawdzenie pokrycia, gdy w promieniu 100 m nie ma żadnej sieci', () => {
  const EMPTY = { energia: ['gaz-pusta'], woda: ['gaz-pusta'], kanalizacja: ['gaz-pusta'], gaz: ['gaz-pusta'] }

  it('obie odpowiedzi na sprawdzenie pokrycia puste → not_covered', async () => {
    kiut({ ...EMPTY, wide: ['gaz-pusta'] })
    const r = await queryGesut(SOBOTKA, geom)
    expect(r.status).toBe('not_covered')
    expect(r.unconfirmed).toBeUndefined()
  })

  it('jedna z nich pusta → no_data („brak sieci”, nie „brak danych KIUT”), bez cache', async () => {
    kiut({ ...EMPTY, wide: ['gaz-pusta', 'gaz'] })
    const r = await queryGesut(SOBOTKA, geom)
    expect(r.status).toBe('no_data')
    expect(r.unconfirmed).toBe(true)
  })
})

describe('fetchWithRetry: limit zapytań (429 z Retry-After)', () => {
  const quota = (retryAfter: string) => vi.fn()
    .mockResolvedValueOnce(new Response('quota', { status: 429, headers: { 'Retry-After': retryAfter } }))
    .mockResolvedValue(new Response('ok'))

  it('ponawia dopiero po czasie z Retry-After (KIUT: 2 s), nie po domyślnych 400 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const f = quota('2')
    vi.stubGlobal('fetch', f)
    const p = fetchWithRetry('https://integracja.gugik.gov.pl/x', { retries: 1 })
    await vi.advanceTimersByTimeAsync(1999)
    expect(f).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect((await p).status).toBe(200)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('nie czeka dłużej niż 5 s, nawet gdy serwer każe', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const f = quota('120')
    vi.stubGlobal('fetch', f)
    const p = fetchWithRetry('https://integracja.gugik.gov.pl/x', { retries: 1 })
    await vi.advanceTimersByTimeAsync(5000)
    expect((await p).status).toBe(200)
  })
})
