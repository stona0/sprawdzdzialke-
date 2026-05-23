import Anthropic from '@anthropic-ai/sdk'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

const MPZP_SYSTEM_PROMPT = `Jesteś ekspertem od polskich miejscowych planów zagospodarowania przestrzennego (MPZP).
Otrzymasz uchwałę MPZP w formie PDF. Wyodrębnij parametry zabudowy dla WSZYSTKICH symboli terenów.

Zwróć TYLKO JSON w tej strukturze (bez żadnego tekstu przed ani po):
{
  "gmina": "nazwa gminy",
  "data_uchwalenia": "YYYY-MM-DD lub null",
  "tereny": [
    {
      "symbol": "MN1",
      "przeznaczenie_podstawowe": "zabudowa mieszkaniowa jednorodzinna",
      "wysokosc_max_m": 9,
      "liczba_kondygnacji_max": 3,
      "powierzchnia_biologicznie_czynna_min_procent": 50,
      "powierzchnia_zabudowy_max_procent": 50,
      "typ_dachu": "symetryczny 30-45°",
      "pokrycie_dachu": "dachówka ceramiczna, czerwony/brązowy/grafitowy",
      "min_powierzchnia_dzialki_m2": 800,
      "min_szerokosc_frontu_m": 20,
      "uwagi": "dodatkowe ograniczenia jeśli są"
    }
  ]
}

Jeśli parametru nie ma w dokumencie, użyj null. Nie zgaduj wartości.`

export interface MPZPTeren {
  symbol: string
  przeznaczenie_podstawowe: string
  wysokosc_max_m: number | null
  liczba_kondygnacji_max: number | null
  powierzchnia_biologicznie_czynna_min_procent: number | null
  powierzchnia_zabudowy_max_procent: number | null
  typ_dachu: string | null
  pokrycie_dachu: string | null
  min_powierzchnia_dzialki_m2: number | null
  min_szerokosc_frontu_m: number | null
  uwagi: string | null
}

export interface MPZPResult {
  gmina: string
  data_uchwalenia: string | null
  tereny: MPZPTeren[]
}

export async function parseMPZP(pdfBase64: string, gmina: string): Promise<MPZPResult> {
  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8096,
    system: MPZP_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: `Przeanalizuj uchwałę MPZP dla gminy: ${gmina}. Wyodrębnij parametry zabudowy.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Claude nie zwrócił prawidłowego JSON')
  }

  return JSON.parse(jsonMatch[0]) as MPZPResult
}
