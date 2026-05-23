# SprawdzDziałkę.com — Handoff dla developera

> Ostatnia aktualizacja: maj 2026  
> Kontakt właściciela: achiszg@gmail.com

---

## 1. Co to jest i po co

**SprawdzDziałkę.com** to SaaS dla osób kupujących działki budowlane w Polsce. Użytkownik podaje numer identyfikacyjny działki (EGB), a system w ciągu 30–60 sekund generuje raport zawierający:

- Dane ewidencyjne działki (powierzchnia, obręb, powiat)
- **MPZP** — czy działka ma plan zagospodarowania i jaka strefa (dla Wrocławia: dane live z WFS UM Wrocławia)
- Media w pobliżu (wodociąg, kanalizacja, gaz, energia) — z OSM Overpass API
- Ochrona przyrody — z GDOŚ WFS
- Rekomendacje AI — Claude Haiku generuje wnioski na podstawie zebranych danych

Model biznesowy: **pierwszy raport za darmo**, kolejne płatne przez Stripe.

---

## 2. Stack techniczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Baza danych | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Płatności | Stripe (Checkout + Webhooks) |
| AI | Anthropic Claude (Haiku do rekomendacji, Sonnet/Opus do parsowania PDF MPZP) |
| Scraping | Playwright (headless Chromium) |
| Style | Tailwind CSS v4, Playfair Display (Google Fonts) |
| Deploy | Vercel (docelowo) |

---

## 3. Lokalna konfiguracja

```bash
cd "Sprawdz Dzialke/sprawdzdzialke"
npm install
npm run dev   # → http://localhost:3000
```

### Wymagane zmienne środowiskowe (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

---

## 4. Architektura — przepływ generowania raportu

```
Użytkownik wpisuje ID działki (np. 0264011.0037.AR_3.2)
        ↓
POST /api/report/generate
        ↓
[1] getParcelData(id)          → ULDK GUGiK (https://uldk.gugik.gov.pl)
                                  Zwraca: WKT geometrii, powierzchnia, obręb, powiat
                                  Parsuje centroid z WKT EPSG:2180 → WGS84

[2] MPZP lookup (równolegle)
    └─ Wrocław?  → getWroclawMpzpForCoords(lat, lng)
                   WFS na żywo: gis1.um.wroc.pl/arcgis/services/ogc/OGC_mpzp
                   Zwraca: symbol_terenu, opis_w_legendzie, nr uchwały RM
    └─ inne gminy → mpzp_cache (Supabase) — ręcznie importowane przez admina

[3] Dane zewnętrzne (równolegle, nie blokują)
    ├─ queryGdosNature(lat, lng)     → GDOŚ WFS — strefy Natura 2000, parki
    └─ queryOsmUtilities(lat, lng)   → OSM Overpass — rury, linie energetyczne

[4] generateRekomendacje(...)        → Claude Haiku API
    Prompt z danymi → JSON {rekomendacje[], ryzyka[]}

[5] buildHTML(data)                  → pełny HTML raportu (iframe-safe)
    Zapisuje do Supabase: reports.html_content

[6] Odpowiedź: {reportId, status: 'completed'}
```

---

## 5. Struktura plików

```
src/
├── app/
│   ├── (public)/page.tsx          # Strona główna (hero + mockup raportu)
│   ├── (auth)/
│   │   ├── login/page.tsx         # Logowanie
│   │   └── register/page.tsx      # Rejestracja
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx     # Lista raportów użytkownika
│   │   └── report/[id]/page.tsx   # Widok wygenerowanego raportu
│   ├── (admin)/admin/page.tsx     # Panel admina
│   └── api/
│       ├── report/generate/       # POST — generuje raport
│       ├── parcel/search/         # GET — wyszukuje działkę w ULDK
│       ├── payments/              # Stripe Checkout + Webhook
│       └── admin/
│           ├── parse-mpzp/        # POST — Claude parsuje PDF uchwały MPZP
│           ├── save-mpzp/         # POST — zapisuje sparsowane symbole do DB
│           ├── mpzp-status/       # GET — status importu MPZP per gmina
│           └── sip/               # GET/POST — media dla gmin (ręczne dane)
├── components/
│   ├── forms/ParcelSearch.tsx     # Formularz wyszukiwania + wynik działki
│   ├── admin/
│   │   ├── AdminPanel.tsx         # Tabsy panelu admina
│   │   ├── MPZPUploader.tsx       # Upload PDF uchwały → Claude → DB
│   │   ├── MPZPList.tsx           # Lista zaimportowanych symboli
│   │   ├── AutoImport.tsx         # Status automatycznego importu MPZP
│   │   ├── SipManager.tsx         # Zarządzanie danymi mediów per gmina
│   │   ├── ReportsList.tsx        # Lista wygenerowanych raportów
│   │   └── UsersList.tsx          # Lista użytkowników
│   └── report/                    # Komponenty widoku raportu
└── lib/
    ├── report-generator.ts        # GŁÓWNA LOGIKA — orkiestruje cały raport
    ├── geoportal.ts               # ULDK API — dane ewidencyjne działki
    ├── wroclaw-mpzp.ts            # WFS UM Wrocławia — MPZP live
    ├── external-data.ts           # GDOŚ WFS + OSM Overpass
    ├── anthropic.ts               # Typy i helpery do Claude API
    ├── stripe.ts                  # Stripe helpers
    └── supabase/                  # Supabase client (server + client)

scripts/
└── scrape-mpzp/
    ├── scraper.ts                 # Playwright — automatyczny import MPZP z BIP
    └── gminy.ts                   # Config 25 gmin okolic Wrocławia (BIP URLs)
```

---

## 6. Baza danych Supabase — kluczowe tabele

### `profiles`
| Kolumna | Typ | Opis |
|---|---|---|
| user_id | uuid | FK → auth.users |
| email | text | |
| role | text | `'user'` lub `'admin'` |
| free_reports_used | int | 0 = nie użył darmowego raportu |

### `reports`
| Kolumna | Typ | Opis |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| parcel_id | text | Identyfikator EGB działki |
| gmina | text | Nazwa gminy |
| status | text | `generating`, `completed`, `failed`, `pending` |
| paid | bool | Czy raport jest opłacony |
| html_content | text | Pełny HTML raportu |

### `mpzp_cache`
| Kolumna | Typ | Opis |
|---|---|---|
| gmina_teryt | text | 7-cyfrowy kod TERYT gminy |
| symbol_terenu | text | np. `MN`, `U`, `ZL` |
| przeznaczenie | text | Opis z uchwały |
| wysokosc_max | numeric | m n.p.m. |
| pbc_min | numeric | % powierzchni biologicznie czynnej |
| typ_dachu | text | |
| source_pdf_url | text | URL źródłowego PDF |
| parsed_at | timestamptz | |

### `sip_layers`
Media per gmina (dane wpisywane ręcznie przez admina):
`gmina_nazwa`, `wodociag`, `kanalizacja`, `gaz`, `energia`, `uwagi`

---

## 7. MPZP — stan integracji

### Wrocław (działa produkcyjnie)
- **WFS na żywo** z serwera UM Wrocławia: `gis1.um.wroc.pl/arcgis/services/ogc/OGC_mpzp`
- Zwraca: symbol terenu, przeznaczenie, nr uchwały Rady Miejskiej
- Działa dla każdej działki we Wrocławiu z dokładnością do jednej strefy MPZP
- **Uwaga**: WFS 1.1.0 + EPSG:4326 wymaga kolejności osi `lat,lon` (Y,X) w BBOX — niestandardowe, ale tak jest skonfigurowany serwer ArcGIS UM Wrocławia

### Gminy podmiejskie (do zrobienia)
- Tabela `mpzp_cache` gotowa na import
- Skrypt `npm run scrape-mpzp` — Playwright scraper próbuje automatycznie pobierać PDF z BIPów
- **Problem**: każda gmina ma dziesiątki do setek osobnych planów miejscowych (np. Długołęka: 160+ planów). Scrapowanie wszystkich PDFów nie jest praktyczne
- **Rekomendowane podejście**: import on-demand — gdy użytkownik pyta o działkę w gminie X, scraper pobiera PDF dla konkretnej strefy i parsuje przez Claude

### KIUT/GESUT (media — do zrobienia)
- GUGiK udostępnia sieć uzbrojenia terenu przez WMS: `integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu`
- Dostępne warstwy: wodociąg, kanalizacja, gaz, elektryczność, ciepłownictwo, telekomunikacja
- **Problem zbadany**: WMS zwraca tylko obrazki (nie WFS), a Wrocław nie jest w KIUT — prawdopodobnie dlatego że UM Wrocławia ma własne systemy (MPWiK, Tauron itd.)
- **Aktualny fallback**: OSM Overpass (ograniczone pokrycie w Polsce)

---

## 8. Panel admina

URL: `/admin` — wymaga roli `admin` w tabeli `profiles`

**Zakładki:**
1. **MPZP** — ręczny upload PDF uchwały → Claude parsuje → zapisuje do `mpzp_cache`
2. **Auto-import** — instrukcje uruchomienia scrapera + status per gmina (wywołuje `/api/admin/mpzp-status`)
3. **Media/SIP** — ręczne wpisywanie danych o mediach dla gmin
4. **Raporty** — lista wszystkich wygenerowanych raportów
5. **Użytkownicy** — lista użytkowników

---

## 9. Płatności Stripe

- `/api/payments/create-checkout` — tworzy Stripe Checkout Session
- `/api/payments/webhook` — obsługuje `checkout.session.completed` → ustawia `reports.paid = true` i uruchamia generowanie
- `/app/(dashboard)/payment-success/page.tsx` — strona po udanej płatności
- `src/app/PaymentGate.tsx` — komponent blokujący dostęp do raportu bez płatności

**Status**: zaimplementowane, wymaga konfiguracji webhook endpoint w Stripe Dashboard dla docelowej domeny.

---

## 10. Co jeszcze nie działa / do zrobienia

| Priorytet | Zadanie | Plik / lokalizacja |
|---|---|---|
| 🔴 Wysoki | Deploy na Vercel | — |
| 🔴 Wysoki | Skonfigurować Stripe webhook dla produkcji | Stripe Dashboard |
| 🟡 Średni | MPZP dla gmin poza Wrocławiem (on-demand) | `report-generator.ts` + nowy scraper |
| 🟡 Średni | Media z KIUT/GESUT (WMS pixel detection lub WFS powiatowe) | `external-data.ts` |
| 🟡 Średni | Strefa zalewowa z ISOK | `src/lib/isok.ts` (plik istnieje, integracja do zrobienia) |
| 🟢 Niski | Stylizacja strony widoku raportu (`ReportView.tsx`) | `src/components/report/` |
| 🟢 Niski | Stripe: obsługa subskrypcji (aktualnie tylko one-time) | `src/lib/stripe.ts` |

---

## 11. Zewnętrzne API — podsumowanie

| API | URL | Auth | Co zwraca |
|---|---|---|---|
| ULDK GUGiK | `uldk.gugik.gov.pl/service.php` | Brak | Geometria WKT, dane ewidencyjne działki |
| WFS UM Wrocław | `gis1.um.wroc.pl/arcgis/services/ogc/OGC_mpzp` | Brak | Symbol MPZP, przeznaczenie, nr uchwały |
| GDOŚ WFS | `sdi.gdos.gov.pl/wfs` | Brak | Obszary Natura 2000, parki, rezerwaty |
| OSM Overpass | `overpass-api.de/api/interpreter` | Brak | Sieci wod-kan, gaz, energia w pobliżu |
| KIUT GUGiK | `integracja.gugik.gov.pl/cgi-bin/...` | Brak | Sieci uzbrojenia (WMS — tylko obrazki) |
| Claude API | `api.anthropic.com` | API Key | Parsowanie PDF MPZP, rekomendacje |
| Stripe | `api.stripe.com` | Secret Key | Płatności |

---

## 12. Uruchamianie scrapera MPZP

```bash
# Wszystkie gminy (~25 min)
SCRAPER_SESSION="sb-xxx-auth-token=..." npm run scrape-mpzp

# Jedna gmina
SCRAPER_SESSION="..." GMINA="Kobierzyce" npm run scrape-mpzp:gmina
```

Gdzie wziąć `SCRAPER_SESSION`: zaloguj się jako admin → DevTools → Application → Cookies → skopiuj wartość cookie `sb-*-auth-token`.

---

## 13. Ważne niuanse techniczne

1. **Czcionka Playfair Display** — ładowana przez `next/font/google`, zmienna CSS `--font-playfair`. W komponentach używana jako `style={{ fontFamily: 'var(--font-playfair)' }}`. W HTML raportów (iframe) ładowana przez `<link>` tag bezpośrednio w HTML stringa.

2. **WFS kolejność osi** — WFS 1.1.0 z EPSG:4326 używa kolejności `lat,lon` (Y,X) w BBOX, nie standardowego `lon,lat`. Dotyczy WFS UM Wrocławia i GDOŚ.

3. **EPSG:2180 → WGS84** — `geoportal.ts` używa własnej aproksymacji (dokładność ~100m, wystarczająca do zapytania WFS). Nie używa proj4.

4. **Raport jako HTML string** — `report-generator.ts` generuje kompletny HTML i zapisuje go w Supabase (`reports.html_content`). Renderowany przez `<iframe>` w widoku raportu — izolacja CSS od reszty aplikacji.

5. **Service Role Key** — operacje admina (zapis do mpzp_cache, update raportów) używają `createServiceClient()` z `SUPABASE_SERVICE_ROLE_KEY` — omija RLS. Nigdy nie używać po stronie klienta.
