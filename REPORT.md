# SprawdzDziałkę.com — raport z naprawy (branch `fix/autonomous-recovery`)

Stan na 19.10.2026, uzupełniony 23.10.2026 o trwały cache i kolejkę (sekcja 10) oraz plany ogólne z Rejestru Urbanistycznego (sekcja 11) i linie energetyczne z BDOT10k (sekcja 12). Nic nie zostało wdrożone na produkcję, nic nie zostało zapisane do produkcyjnej bazy ani do konta Stripe.

## 1. Podsumowanie

1. Po naprawach ścieżka użytkownika działa end-to-end: logowanie → wyszukanie działki → raport darmowy → raport płatny po webhooku Stripe. Dowód to test Playwright na lokalnym mocku Supabase (3/3) oraz 8 przykładowych raportów z prawdziwych działek w `reports-sample/`. Wyjątki: usługa OpenStreetMap jest niestabilna, a płatności w Stripe Checkout nie dało się przetestować bez kluczy testowych.
2. Główna przyczyna złych raportów: **każda działka była lokalizowana 19–25 km od faktycznego położenia**. Przybliżony wzór EPSG:2180 → WGS84 mylił się dla każdej z 9 sprawdzonych działek, więc MPZP i plan ogólny Wrocławia, GDOŚ, OSM i mapa uzbrojenia dotyczyły zupełnie innego miejsca.
3. Główna przyczyna niedziałania w produkcji (prawdopodobna, bez dostępu do logów hostingu): generowanie raportu startowało jako niezawiedzione `Promise` po wysłaniu odpowiedzi. Na serverless taka praca jest ucinana, więc raport zostawał na zawsze w statusie „generating”.
4. Do tego model biznesowy nie działał. Licznik darmowych raportów nigdy nie rósł, więc każdy raport był darmowy, a ścieżka płatności nigdy się nie uruchamiała. Kilka źródeł było martwych albo źle użytych: host GESUT, szwajcarska instancja Overpass, wycofany model Claude, podkład mapy z napisem „API KEY REQUIRED”, a fallbacki MPZP podawały symbole niezwiązane z działką.
5. Raport opiera się teraz na zweryfikowanych źródłach ogólnokrajowych. Pokazuje stan prawny po reformie (WZ tylko w obszarze uzupełnienia zabudowy planu ogólnego) oraz status każdego źródła, a AI pisze wyłącznie na podstawie faktów z danych. Ostrzeżenie: rejestry państwowe są niekompletne i bywają opóźnione, więc raport uczciwie mówi „nie ustalono” tam, gdzie wcześniej zgadywał.

## 2. Stan zastany (Faza 0)

**Architektura**
- Next.js 16.2.4 (App Router, `proxy.ts` jako auth guard), Supabase (Auth + Postgres + Storage), Stripe Checkout + webhook, Claude.
- Deploy: `netlify.toml` w repo, choć HANDOFF wskazuje Vercel.
- Raport to string HTML zapisywany w `reports.html_content` i renderowany w `<iframe>`.

**Trasy**

| Trasa | Rola |
|---|---|
| `/`, `/pricing`, `/blog/*` | publiczne |
| `/login`, `/register`, `/forgot-password`, `/auth/callback` | Supabase Auth (hasło + Google OAuth) |
| `/dashboard` | wyszukiwarka działki + lista raportów |
| `/report/[id]` | podgląd raportu, druk = PDF |
| `/payment-success` | powrót ze Stripe |
| `/admin` | import MPZP z PDF (Claude), dane mediów per gmina, listy |
| `GET /api/parcel` | ULDK GetParcelById |
| `POST /api/report/generate`, `GET /api/report/[id]/status` | generowanie + polling |
| `/api/payments/{create-checkout,webhook,verify}` | Stripe |
| `/api/admin/*` | parse-mpzp, save-mpzp, mpzp-status, sip |

**Zmienne środowiskowe** (`.env.local`, wartości nieujawniane):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Projekt Supabase z `.env.local` jest jedyny i ten sam co produkcyjny (jego URL-e Storage są wpisane na sztywno w kodzie). Według notatek projektu klucze Stripe w `.env.local` są kluczami live.

**Build, lint, testy przed zmianami**
- `npm install` OK. `npm run build` OK, TypeScript bez błędów.
- Brak skryptu `lint` i konfiguracji ESLint.
- Brak jakichkolwiek testów.
- `npm audit`: 10 podatności, w tym 1 krytyczna w Next.

**Zewnętrzne źródła danych w kodzie — przed zmianami**

| Źródło | Endpoint | Typ | Co miało zwracać | Stan zastany |
|---|---|---|---|---|
| ULDK GUGiK | `uldk.gugik.gov.pl/service.php` | REST/tekst | geometria WKT (EPSG:2180), gmina, obręb | działa; **błąd przeliczenia współrzędnych ~24 km** w `geoportal.ts` |
| WFS MPZP UM Wrocławia | `http://gis1.um.wroc.pl/.../OGC_mpzp/.../WFSServer` | WFS 1.1.0 | symbol terenu | HTTP→302; zapytanie prostokątem ~2 m wokół (złego) punktu → zawsze pusto |
| ArcGIS UM Wrocławia (POG) | `gis.um.wroc.pl/portal_srv/rest/services/POG_PROJEKT_OBOW_*` | ArcGIS REST | strefa POG, OUZ | działa (dodane w poprzedniej sesji, tylko punkt) |
| wrosip.pl + Supabase Storage | Zoomify `wrosip.pl/zoom//dlugoleka` | raster | symbol MPZP z koloru piksela | zawodne z założenia: bbox planu szacowany „±200 m”, legenda jednego planu dla wszystkich |
| Supabase `mpzp_cache` | — | DB | parametry MPZP | filtr TERYT po **nazwie** gminy; zwracał dowolny symbol z gminy |
| GDOŚ | `sdi.gdos.gov.pl/wfs` | WFS 2.0 (GeoServer) | Natura 2000, parki, rezerwaty | działa; złe współrzędne → cudze obszary |
| OSM Overpass | kumi.systems, overpass-api.de, overpass.osm.ch | Overpass API | linie, rurociągi | kumi: timeout; osm.ch: **tylko Szwajcaria** (200 + 0 obiektów); overpass-api.de: 502/406 |
| KIUT/GESUT | `integracja02.gugik.gov.pl/...UzbrojeniaTerenu` | WMS (tylko obraz) | nakładka sieci | **pusta odpowiedź 200** — sieci nigdy się nie rysowały |
| KIEG | `integracja.gugik.gov.pl/...EwidencjiGruntow` | WMS | granice działek | działa |
| CARTO | `basemaps.cartocdn.com/light_all` | kafelki XYZ | podkład mapy | **obraz ze znakiem „API KEY REQUIRED”** |
| ISOK | — | — | strefy powodziowe | nie zaimplementowane (`isok.ts` = zaślepka, tylko link) |
| Claude | `claude-haiku-4-5-20251001` (rekomendacje), `claude-sonnet-4-20250514` (PDF MPZP) | API | JSON | Haiku OK; **Sonnet 4 wycofany** (model not found) |
| Stripe | Checkout + webhook | API | płatność 29 PLN | kod poprawny, ale nigdy nieosiągany |

## 3. Definicja „działa” i wynik każdego kroku

| # | Krok | Kryterium sukcesu (mierzalne) | Przed | Po |
|---|---|---|---|---|
| 1 | Wejście bez sesji | `/dashboard` → przekierowanie na `/login?redirectTo=…` | DZIAŁA | DZIAŁA (e2e) |
| 2 | Logowanie | e-mail + hasło → `/dashboard` | DZIAŁA* | DZIAŁA (e2e na mocku) |
| 3 | Walidacja ID | ID bez kropek → komunikat; nieistniejące → „Nie znaleziono działki” | DZIAŁA | DZIAŁA (e2e) |
| 4 | Geometria działki | punkt wewnątrz działki z błędem < 1 m względem referencji ULDK EPSG:4326 | **NIE DZIAŁA** (błąd 19–25 km; link „Pokaż na mapie Google” prowadził obok) | DZIAŁA (test jednostkowy na 4 działkach, < 1 m) |
| 5 | MPZP | dla działki objętej planem: plan + teren; dla nieobjętej: „brak MPZP”; gdy brak danych: „nie ustalono” | **NIE DZIAŁA** (Wrocław zawsze „brak”, fallbacki zgadywały) | DZIAŁA: Wrocław (GIS miasta, wszystkie tereny z udziałem %), gminy w KIMPZP. CZĘŚCIOWO: gminy spoza KIMPZP → „nie ustalono” |
| 6 | Plan ogólny i ścieżka do zabudowy | werdykt MPZP / WZ możliwe / WZ niemożliwe / nieustalone, zgodny ze stanem prawnym od 1.09.2026 | NIE DZIAŁA | DZIAŁA dla Wrocławia (GIS miasta) i od `c311e4f` dla gmin z POG w mocy w Rejestrze Urbanistycznym (strefa, parametry, OUZ — sekcja 11) |
| 7 | Ochrona przyrody | rozróżnienie „na działce” i „do 300 m” | NIE DZIAŁA (złe miejsce) | DZIAŁA (live: Milicz, Pilczyce) |
| 8 | Powódź | scenariusze Q10/Q1/Q0,2/wał/budowla + OSZP | NIE DZIAŁA (tylko link) | DZIAŁA (live: Kłodzko, Pilczyce, Lipa Piotrowska) |
| 9 | Uzbrojenie | odległość od granicy działki do sieci lub jawne „brak danych” | NIE DZIAŁA | CZĘŚCIOWO: KIUT działa tam, gdzie powiat przekazuje dane (nie Wrocław, nie Kraków); OSM zależny od przeciążonego publicznego Overpass |
| 10 | Analiza AI | rekomendacje oparte wyłącznie na danych; brak liczb spoza danych; fallback bez AI | CZĘŚCIOWO (działało na złych danych, bez kontroli) | DZIAŁA z ograniczeniami (rozdz. 5) |
| 11 | Generowanie w tle | raport kończy się statusem `completed`/`failed`, nigdy nie wisi | **NIE DZIAŁA** na serverless (fire-and-forget) | DZIAŁA (`after()`, e2e); wiszące > 5 min → `failed`. Zachowanie na Netlify niezweryfikowane |
| 12 | Raport (podgląd/PDF) | iframe z treścią; druk przeglądarki | DZIAŁA (zła treść) | DZIAŁA (e2e) |
| 13 | Płatność | po darmowym raporcie kolejny wymaga płatności; webhook z poprawną sygnaturą generuje raport, zła → 400, ponowienie nie dubluje | **NIE DZIAŁA** (paywall nieosiągalny) | DZIAŁA (e2e z podpisanym webhookiem). Stripe Checkout — nietestowany |

\* Logowanie nie było testowane na produkcyjnym Supabase (zakaz zapisu do produkcji). Na kodzie nic nie wskazuje na błąd.

**Działki testowe** (`tests/parcels.ts`):

| Działka | Typ | Wynik |
|---|---|---|
| 026401_1.0001.2395 | Wrocław, Rynek | MPZP 12UA\*UC, strefa konserwatorska |
| 026401_1.0054.888 | Wrocław, Lipa Piotrowska | bez MPZP, w OUZ |
| 026401_1.0041.442 | Wrocław, Pilczyce | Q1%, Natura 2000 |
| 020802_1.0010.AR_3.27/16 | Kłodzko | Q1% |
| 022302_2.0020.440/1 | Długołęka, Kiełczów | MPZP z KIMPZP, brak POG |
| 060501_2.0004.273/4 | Batorz | wieś bez MPZP |
| 021303_4.0001.AR_18.19/9 | Milicz | Natura 2000 |
| 126105_9.0001.580/4 | Kraków | MPZP KP.1 |

**Dowody**
- `npm test`: 48 testów jednostkowych na fixture'ach.
- `npm run test:live`: 8/8 działek zgodnych z ręczną weryfikacją źródeł.
- `npm run test:e2e`: 3/3.
- `reports-sample/*.html|json`: przykładowe raporty.
- Generowanie raportu trwa 22–25 s, z czego ~15 s to czekanie na OSM. Po zmianach z sekcji 10: powtórny raport tej samej działki pobiera źródła z bazy w ~10 ms, a przy awarii Overpass czekamy na timeout raz na 5 min, nie w każdym raporcie.

## 4. Lista zmian

| Commit | Problem | Rozwiązanie |
|---|---|---|
| `fc16864` | Raport nie pokazywał planu ogólnego Wrocławia | Sekcja POG (strefa, parametry, OUZ) |
| `c1d13ee` | Centroid przeliczany przybliżonym wzorem, błąd 19–25 km; średnia wierzchołków wypada poza działki w kształcie L/U | `proj4` z definicją PUWG 1992; punkt na pewno wewnątrz działki; parser WKT (dziury, MULTIPOLYGON); vitest |
| `2b1bb01` | Fire-and-forget po wysłaniu odpowiedzi (generowanie i webhook) — na serverless raport wisi | `after()` z `next/server`; raport w „generating” > 5 min (liczone od płatności, jeśli była) → „failed” |
| `5fc1447` | `free_reports_used` nigdy nie rósł, każdy raport darmowy | Atomowe zajęcie slotu (`UPDATE … WHERE free_reports_used = 0`), zwrot przy błędzie generowania |
| `a80d2ed` | Brak ogólnokrajowych źródeł MPZP i powodzi | Nowe moduły: KIMPZP (EPSG:2180, osie N,E), Rejestr Urbanistyczny, ISOK, GDOŚ „na działce/w pobliżu”, klient ArcGIS z udziałem % |
| `18964df` | Sieci tylko jako obraz; Overpass z instancją szwajcarską | Odległość do sieci z pikseli KIUT (±2 m, „przez działkę”, „brak danych w KIUT”); Overpass równolegle, z odległościami |
| `32ac3d2` | Podkład CARTO z „API KEY REQUIRED”, martwy host GESUT, obrazki cache rysowane 24 km obok | Ortofotomapa GUGiK, właściwy host KIUT, pogrubianie linii (serwer ignoruje SLD), cache v4 |
| `57e0037` | MPZP Wrocławia zawsze puste; fallbacki zgadywały symbol; `isWroclaw` po nazwie łapał „Kąty Wrocławskie” | Zapytania obrysem działki; usunięte fallbacki rastra i `mpzp_cache` z raportu; ocena ścieżki do zabudowy po reformie; tabela statusów źródeł; AI tylko z faktów |
| `637b90b` | Import uchwał MPZP w panelu admina padał (wycofany model) | `claude-opus-5-5`, streaming, odczyt tekstu spoza bloku thinking, obsługa refusal/max_tokens |
| `46e1884` | Brak testów | 48 testów jednostkowych, testy live na 8 działkach, skrypt przykładowych raportów |
| `e69fd17` | Brak e2e; jedyna baza to produkcja | Mock Supabase (Auth, PostgREST, Storage) + Playwright |
| `42f1947` | Ortofotomapa GUGiK potrafi zwrócić 404 lub biały obraz | Dwa warianty usługi, odrzucanie pustych obrazów, neutralne tło zamiast braku mapy |
| `92e8a66` | Krytyczne podatności Next (m.in. obejście proxy/middleware — a autoryzacja stoi na `proxy.ts`), sharp, ws, undici | Next 16.4.2, sharp 0.35.5, `npm audit fix`; regresja: tsc, testy, build, e2e |
| `99efbfd` | Artykuł blogowy o WZ sprzeczny z prawem od 1.09.2026 | Ramka aktualizacji, poprawiona sekcja o nowelizacji i FAQ |
| `a84a721` | AI nadinterpretowało dane (zła instytucja, „gaz dostępny” przy braku, „cała działka”, ucięte zdania) | Jednoznaczne fakty, lista dopuszczalnych instytucji, poziom ryzyka powodziowego; przykładowe raporty |
| `f087147` | Mock e2e w pamięci przyjmował dowolne kolumny i nie wykonywał SQL | Mock na PGlite (Postgres w procesie) ze `schema.sql` i migracjami |
| `ded6dd8` | Brak trwałego cache i kolejki | Migracja `20261020`: `source_cache`, `report_jobs`, funkcje kolejki (SKIP LOCKED, dzierżawa, atomowy zapis) |
| `7e27e7b` | Godziny w raporcie w UTC (serverless) | `timeZone: 'Europe/Warsaw'` |
| `f075f61` | Cache tylko w pamięci instancji; awaria źródła = „brak danych” | L2 w Postgres, kopia ≤ 30 dni przy awarii (oznaczona w raporcie), cache rekomendacji AI |
| `932844c` | Każdy raport czekał 15 s na niedziałający Overpass | Bezpiecznik 5 min współdzielony przez instancje |
| `73e73f2` | `after()` ginie z funkcją, nic nie ponawia | Kolejka `report_jobs`: ponowienia, wznawianie przez polling i cron |

**Usunięta funkcjonalność i powód**
- `wrosip-mpzp.ts` (MPZP Długołęki z koloru piksela): plan wybierany po przybliżonym prostokącie (±200 m), a legenda kolorów pochodziła z jednego planu (#40) i była stosowana do wszystkich. Przykład błędu: działkę w Kiełczowie przypisywało do planu „Obręb wsi Długołęka”, podczas gdy krajowa integracja pokazuje rzeczywisty plan „Kiełczów część B”. Zastąpione przez KIMPZP.
- Fallback `mpzp_cache` w raporcie: zwracał najnowszy symbol z gminy bez związku z położeniem działki, a filtr porównywał TERYT z nazwą gminy. Tabela i import w panelu admina zostały.
- `external-data.ts` i zaślepka `isok.ts`: zastąpione przez `src/lib/sources/*`.
- Okrąg „analizy 200 m” na mapie: nic nie analizował.

## 5. Blockery i ryzyka

| # | Problem | Przyczyna | Próby | Rekomendacja |
|---|---|---|---|---|
| B1 | **OSM/Overpass niedostępny** podczas całej sesji (bez linii WN z napięciem) | Publiczne instancje przeciążone: overpass-api.de 502/406/timeout, kumi i private.coffee timeout, mail.ru ~18 s | Zmiana instancji, równoległe zapytania, nagłówki UA/Accept, limit 15 s; od `932844c` bezpiecznik 5 min | Rozwiązane w kodzie przez `6b30b22`: własne kafle linii z BDOT10k (sekcja 12); Overpass zostaje tylko jako zapas, gdy kafli nie ma. Wymaga uruchomienia ETL i wgrania kafli |
| B2 | Stripe Checkout nieprzetestowany | W `.env.local` są tylko klucze live; tworzenie sesji live w ramach testu = efekt uboczny na produkcji | Przetestowany webhook (podpis, idempotencja, generowanie); dialog płatności w e2e | Dodać klucze testowe Stripe (`sk_test_…`) do środowiska dev/staging i dopisać krok checkout do e2e |
| B3 | Zachowanie na hostingu niezweryfikowane | Brak dostępu do Netlify/Vercel i logów. Netlify: limit czasu funkcji synchronicznych jest krótki (zależnie od planu); wsparcie `after()`/`waitUntil` trzeba potwierdzić. Generowanie trwa ~25 s | `after()` + `maxDuration = 60`; od `73e73f2` kolejka z ponowieniami i wznawianiem przerwanych zadań (sekcja 10) | Wdrożyć branch na staging i sprawdzić `after()`, funkcję zaplanowaną Netlify i limity czasu |
| B4 | ~~Geometria OUZ poza Wrocławiem~~ — rozwiązane w `c311e4f` (geometria z API Rejestru Urbanistycznego, sekcja 11) | Krajowa usługa GUGiK `PlanyOgolneGmin` nie zwraca nic nawet dla gmin z POG w mocy (Siechnice, Przemęt, Radlin, Strzeleczki), a na skali kraju nic nie rysuje | GetFeatureInfo HTML/JSON/text, GetMap całej Polski | Pobierać GML planów ogólnych z Rejestru Urbanistycznego (API ma download) do własnej bazy, analogicznie do Wrocławia |
| B5 | Brak stagingu i trwałego cache | Jedyny projekt Supabase = produkcja; zakaz modyfikacji bazy | Cache w pamięci procesu; od `f075f61` tabela `source_cache`. 23.10.2026 założony projekt Supabase `sprawdzdzialke-staging` ze wszystkimi migracjami (sekcja 14) | Dokończyć staging: Stripe test, witryna Netlify, scenariusz ręczny (`docs/STAGING.md`) |

**Ryzyka danych**
- **Rejestr Urbanistyczny bywa opóźniony.** 19.10.2026 POG Wrocławia był w nim „w opracowaniu”, choć obowiązuje od 19.09.2026. Raport mówi to wprost i każe potwierdzić w urzędzie.
- **KIMPZP:** „brak wyniku” interpretujemy jako brak MPZP (gmina podłączona, w punkcie brak planu). Gmina może jednak nie przekazywać wszystkich planów. Gminy poza integracją (np. Gdańsk) → „nie ustalono”. Część gmin podaje tylko dane aktu, bez symbolu terenu.
- **ISOK:** metadane map mają ważność do 21.12.2025, a usługa nie wskazuje nowszych. Mapy nie obejmują podtopień ani małych cieków.
- **KIUT:** duże miasta nie przekazują danych. Odległość ±2 m z obrazu. Brak informacji o napięciu, średnicy i wolnej mocy.
- **KIUT zwraca niekompletne obrazy (zmierzone 23.10.2026).** Identyczne zapytania GetMap dają różne wersje danych: część sieci albo pusty obraz. Serwer nie sygnalizuje niepełnej odpowiedzi (HTTP 200, poprawny PNG).
  - Sobótka (`022307_4.0003.541`), 8 zapytań na warstwę: prąd 26 755 / 7 227 / 1 462 px, gaz 3 417 px albo pusto (3 z 8), wodociąg 6 859 albo 210 px. Ta sama wersja ma zawsze tę samą długość w bajtach, więc za jednym adresem stoi raczej kilka źródeł, a nie losowy szum.
  - Długołęka: prąd pusty w ok. 40% zapytań. Milicz: raz wynik „brak danych KIUT dla obszaru” (`not_covered`), choć sieci tam są. To wyjaśnia wcześniejszą obserwację, że „KIUT przestał pokazywać okolice Milicza”.
  - **Skutek przed poprawką.** `gesut.ts` liczył odległość z jednego obrazu na sieć i zapisywał wynik w `source_cache` na dobę. Płatny raport mógł napisać „brak w promieniu ok. 100 m” przy gazie 4 m od działki albo „11 m od granicy działki” przy linii, która nad nią przebiega. Ten sam błędny wynik dostawały wtedy kolejne raporty przez 24 h.
  - **Poprawka.** Każda warstwa jest pobierana dwa razy równolegle, a narysowane piksele są łączone (tak jak na mapie, sekcja 15). Jeśli odpowiedzi różnią się liczbą pikseli o więcej niż 10% albo jedna nie przyszła, wynik dostaje flagę `unconfirmed`: trafia do raportu, ale nie do cache (`cacheableResult`), więc kolejny raport pyta KIUT od nowa. Przeterminowana kopia z cache nie zastępuje takiego wyniku, tylko błąd źródła. Tak samo działa sprawdzenie pokrycia, które decyduje o `not_covered`.
  - **Limit KIUT: 10 zapytań na 2 s** na usługę (KIEG ma osobny limit). Nadmiar dostaje HTTP 429 z `Retry-After: 2`. Raport wysyła teraz naraz 8 zapytań z `gesut.ts` i 4 z mapy, więc część dostaje 429. Dlatego `fetchWithRetry` czeka teraz tyle, ile każe `Retry-After` (najwyżej 5 s). Wcześniej czekał 400 ms, więc ponowienie też dostawało 429. Zapytania mapy do KIUT są ponawiane raz.
  - **Pomiar** (`scripts/gesut-stability.mts`, każde zapytanie bez cache, odległość porównywana z najlepszą ze wszystkich prób ±2 m):

    | | przed | po |
    |---|---|---|
    | wyniki sieci gorsze od najlepszego (bez prób zakończonych błędem lub `not_covered`) | 14 / 156 (9%) | 13 / 320 (4%) |
    | fałszywe `not_covered` | 1 / 50 | 0 / 80 |
    | próby zakończone błędem 429 | 10 / 50 | 0 / 80 |
    | błędny wynik zapisany w cache (drugi pomiar po poprawce) | — | 0 / 4 |

    Pomiar „przed” robił zapytania bez przerw, więc część błędów 429 wywołał sam pomiar; pomiar „po” ma 2,5 s przerwy między próbami. 5 działek (Długołęka, Batorz, Milicz, Siechnice, Sobótka) × 10 prób, drugi pomiar po poprawce na 3 niestabilnych działkach.
  - **Ryzyko szczątkowe.** Gdy obie odpowiedzi zgodnie nie mają sieci, wynik uchodzi za potwierdzony i trafia do cache. Przy częstości braków jak dla gazu w Sobótce (3 z 8) zdarzy się to w ok. 14% raportów. Trzy próby na warstwę (`SAMPLES = 3`) zmniejszyłyby to do ok. 5%, ale dają 16 zapytań naraz przy limicie 10 na 2 s. W niestabilnych okolicach większość wyników nie trafia do cache (8–9 z 10 prób). Każdy raport pyta wtedy KIUT od nowa (ok. 0,4–0,9 s), a przy awarii KIUT nie ma kopii zapasowej.
  - **Awaria serwera powiatu wygląda jak „brak danych”.** 23.10.2026 ok. 18:25 KIUT zwracał dla powiatu wrocławskiego (Sobótka, Siechnice) HTTP 200 z pustym PNG (218 B zamiast ~175 KB rano), a Batorz i Sieradz działały; ok. 18:30 Sobótka znów odpowiadała w całości. Dwie zgodnie puste odpowiedzi dawały `not_covered` („powiat nie przekazuje danych”) zapisane w cache na dobę. Teraz `not_covered` zawsze jest niepotwierdzone, więc nie trafia do cache. Jeśli w cache jest wcześniejszy wynik z danymi (do 30 dni), raport pokazuje go jako kopię z datą pobrania, tak jak przy błędzie źródła. Koszt: raporty z Wrocławia i Krakowa (faktycznie poza KIUT) za każdym razem pytają KIUT (10 zapytań, < 1 s). Mapa ma analogiczną poprawkę (`608b6b3`).
- **Niestabilność usług państwowych:** w trakcie sesji ortofotomapa `StandardResolution` przez pewien czas zwracała 404. Wszystkie źródła mają timeout, retry i status w raporcie; awaria pojedynczego źródła daje raport częściowy, nie błąd.
- **AI (od 23.10.2026 Haiku 5.5, effort low; wcześniej Haiku 4.5):** walidator odrzuca punkty z liczbami spoza danych i bez wskazania podstawy, ale nie łapie błędów semantycznych. Eval (sekcja 13): 34% punktów Haiku 4.5 jest błędnych wg sędziego (głównie spekulacje o kosztach i terminach), Haiku 5.5 low — 11%. Po poprawkach promptu zostały pojedyncze spekulacje (np. Milicz: „położenie nad Baryczą wskazuje na potencjalne zagrożenie hydrologiczne”, choć ISOK nie pokazuje strefy). Kluczowe ustalenia i werdykt w raporcie powstają regułami, nie przez AI.

**Ryzyka bezpieczeństwa (poza zakresem zmian w kodzie)**
- **Token GitHub (PAT) zapisany jawnym tekstem w URL remote'a `origin`** w `.git/config`. Należy go natychmiast unieważnić i ustawić remote bez tokenu (credential helper).
- Klucze **live** Stripe w lokalnym `.env.local`. Development powinien używać kluczy testowych.
- **Klucz API Anthropic jawnym tekstem w `.claude/launch.json`** (konfiguracja podglądu dev serwera). Plik jest w `.gitignore` i nie ma go w historii gita, ale klucz powinien być tylko w `.env.local`.
- **Bucket `utility-maps` pozwalał na zapis każdemu z kluczem anon** (polityki insert/update bez klauzuli TO w migracji 20260529). Każdy mógł podmienić obraz mapy w płatnych raportach. Poprawka: migracja `20261024_utility_maps_write_policies.sql` (`6568008`) — **do uruchomienia na produkcji**.
- **Funkcja `increment_free_reports(uid)` była wywoływalna z publicznym kluczem anon** (`/rest/v1/rpc/…`, SECURITY DEFINER, ze `schema.sql`). Kto znał UUID użytkownika, mógł mu odebrać darmowy raport. Aplikacja jej nie używa. Tak samo wystawiona była funkcja triggera `handle_new_user()`. Wykrył to doradca bezpieczeństwa Supabase na stagingu. Poprawka: migracja `20261025_security_definer_functions.sql` (sekcja 14) — **do uruchomienia na produkcji** (rejestracja na stagingu po tej migracji działa).
- Rate limiter jest w pamięci i nie jest współdzielony między instancjami serverless (cache źródeł już jest — sekcja 10).
- Pozostały 2 umiarkowane podatności (`postcss-selector-parser` przez `@tailwindcss/typography`; tylko czas budowania).

## 6. Luki konkurencyjne: linie energetyczne i wod-kan

| Źródło | Dane wektorowe? | Odległość od działki | Pokrycie | Stan |
|---|---|---|---|---|
| **KIUT/GESUT (GUGiK)** | Nie — tylko WMS; GetFeatureInfo „nie udostępnia danych opisowych” | **Tak**, z pikseli obrazu (±2 m): prąd, woda, kanalizacja, gaz; wykrywa sieć przez działkę | Powiaty przekazujące dane; brak m.in. Wrocławia i Krakowa | **Zbudowane i w raporcie** (`src/lib/sources/gesut.ts`). Live: Milicz — prąd 7 m, woda 1 m, kanalizacja 9 m, gaz 11 m; Kiełczów — prąd 126 m, kanalizacja 119 m |
| **OSM** | Tak (z napięciem, operatorem) | Tak (dokładnie, z geometrii) | Dobre dla napowietrznych linii WN/SN, słabe dla sieci podziemnych | Zbudowane (`osm.ts`, reguła „linia WN ≤ 50 m” → ryzyko). Bezużyteczne bez stabilnego Overpass (B1) |
| **BDOT10k (SULN, SUPR)** | Tak, ale WFS GUGiK udostępnia tylko listę paczek per powiat (GML) | Możliwa po ETL | Cały kraj; linie napowietrzne z klasą napięcia, główne rurociągi | **Zbudowane** (`6b30b22`, sekcja 12): ETL → kafle w Storage; w raporcie klasa napięcia, odległość, przecięcie działki |
| Operatorzy sieci / mapa zasadnicza z powiatu | Różnie; zwykle płatne, na wniosek | — | — | Nie do zautomatyzowania rzetelnie; raport kieruje po warunki przyłączenia |

**Rekomendacja.** Wod-kan i prąd „z odległością” dla powiatów z KIUT jest gotowe, a konkurencja zwykle i tak opiera się na tym samym źródle. Dla linii wysokiego napięcia (pasy technologiczne, ryzyko dla zabudowy) warto zbudować własny ETL z OSM i BDOT10k do PostGIS. Szacunek: 3–5 dni pracy plus miesięczne odświeżanie; daje to napięcie i dokładną geometrię bez zależności od Overpass.

**Czego nie da się zrobić rzetelnie:**
- potwierdzić **możliwości przyłączenia** (moc, przepustowość, czy sieć jest czynna) — tylko operator, na wniosek;
- podać danych o sieciach w miastach spoza KIUT.

Raport mówi to wprost zamiast udawać.

## 7. Wpływ reformy planistycznej na produkt

**Stan prawny przyjęty w kodzie** (ustawa z 7.07.2023 z późn. zm.; termin przesunięty ustawą z 30.04.2026):
- od **1.09.2026** studia uwarunkowań straciły moc;
- nową decyzję WZ można co do zasady wydać tylko w gminie z **obowiązującym planem ogólnym** i tylko w **obszarze uzupełnienia zabudowy** (OUZ);
- gminy bez POG nie wydają nowych WZ ani nie uchwalają nowych MPZP;
- decyzje WZ prawomocne od 1.01.2026 wygasają po 5 latach;
- od 1.07.2026 działa Rejestr Urbanistyczny.

Wyjątki i przepisy przejściowe (np. postępowania wszczęte wcześniej, art. 61 ust. 1a) są tylko sygnalizowane — raport ich nie rozstrzyga.

**Zrobione**
- Werdykt „ścieżka do zabudowy” (`src/lib/report/assessment.ts`): MPZP → WZ możliwe (OUZ) → WZ niemożliwe (poza OUZ / brak POG) → nieustalone, z poziomem pewności.
- POG Wrocławia: strefa, parametry, OUZ, obszar śródmiejski, udział %.
- Status POG gminy dla całego kraju (Rejestr Urbanistyczny) z ostrzeżeniem o opóźnieniach.
- Usunięte odesłanie do „studium uwarunkowań” z treści raportu.
- Artykuł blogowy o WZ zaktualizowany.

**Do zrobienia**
1. ~~Geometria OUZ i stref POG dla wszystkich gmin z Rejestru Urbanistycznego (B4).~~ Zrobione 23.10.2026 (sekcja 11).
2. Pozostałe artykuły bloga (01, 02, 03, 05) wspominają studium i stare zasady WZ — do przeredagowania.
3. Import MPZP w panelu admina: zamiast parsowania PDF przez Claude pobierać GML aktów (APP) z Rejestru Urbanistycznego — dane oficjalne, z geometrią.
4. Link do wypisu/wyrysu (e-usługi gminy, Rejestr Urbanistyczny) w raporcie.

## 8. Założenia przyjęte bez Twojej zgody

1. Projekt Supabase z `.env.local` traktuję jako **produkcję**: zero zapisów (także do Storage). E2E i przykładowe raporty działają bez niego (mock, mapy jako data URI).
2. Nie używałem kluczy Stripe (live). Webhook testowany na fałszywym sekrecie z podpisem wygenerowanym przez bibliotekę Stripe.
3. Rekomendacje były na **Claude Haiku 4.5** (wybór właściciela z HANDOFF); 23.10.2026 właściciel zdecydował o przejściu na **Claude Haiku 5.5 z effort low** na podstawie evala (sekcja 13). Do parsowania PDF wybrałem **`claude-opus-5-5`** w miejsce wycofanego Sonnet 4. Parsowania PDF nie uruchomiłem na prawdziwym dokumencie (koszt, panel admina).
4. Warstwy ArcGIS UM Wrocławia z „PROJEKT” w nazwie traktuję jako dane obowiązujące. Mają status „prawnie wiążący” i datę 19.09.2026; to te same warstwy, z których korzysta geoportal miasta.
5. „Obszar szczególnego zagrożenia powodzią” = strefa Q10% lub Q1%. Pas między wałem a rzeką nie jest wykrywany.
6. Status POG „prawnie wiążący lub realizowany” w Rejestrze Urbanistycznym = POG obowiązuje.
7. `sip_layers` (dane ręczne admina) wyszukiwane po dokładnej nazwie gminy (bez „(miasto)”) zamiast `%nazwa%`.
8. Podniesiony `@types/node` do 22 (wymóg vitest 5; runtime to Node 22). Nowe zależności: `proj4`, `polygon-clipping`, `vitest`, `@playwright/test`, `tsx`.
9. Przykładowe raporty (2,8 MB, mapy osadzone) są w repozytorium, bo zadanie wymagało katalogu `reports-sample/`.
10. Nie konfigurowałem ESLint (brak konfiguracji w projekcie, Next 16 nie ma już `next lint`). Rolę statycznej kontroli pełni `tsc --noEmit`.

## 9. Top 5 kolejnych kroków

1. **Staging i sekrety (1–2 dni).** Unieważnić PAT z `.git/config`, osobny projekt Supabase i klucze testowe Stripe dla dev/staging, wdrożyć ten branch na staging i sprawdzić `after()` i limity czasu na docelowym hostingu (B2, B3). Bez tego nie da się bezpiecznie wypuścić żadnej poprawki. **23.10.2026:** narzędzia stagingu i projekt Supabase gotowe (sekcja 14); zostały Stripe test, Netlify, scenariusz ręczny i sekrety.
2. ~~**Trwały cache i kolejka (2–3 dni).**~~ Zrobione w kodzie 20–23.10.2026 (sekcja 10). Do zrobienia: migracja na stagingu i produkcji, `CRON_SECRET` na hostingu, weryfikacja funkcji zaplanowanej.
3. ~~**Geometria planów ogólnych z Rejestru Urbanistycznego (3–5 dni).**~~ Zrobione 23.10.2026 (sekcja 11).
4. ~~**Własny ETL linii energetycznych (3–5 dni).**~~ Zrobione 23.10.2026 z BDOT10k (sekcja 12). Do zrobienia: pierwszy pełny przebieg ETL i upload na stagingu.
5. ~~**Jakość AI: eval i lepszy model (1–2 dni).**~~ Eval, poprawka walidatora i podstawa w raporcie zrobione 23.10.2026 (sekcja 13). Model przełączony na Haiku 5.5 low (decyzja właściciela), bieg potwierdzający wykonany. Dalej: poprawa promptu (spekulacje o kosztach i terminach) względem evala.

## Jak uruchomić weryfikację

```bash
npm install
npm run typecheck
npm test                 # 125 testów: fixture'y + SQL kolejki, cache, Storage, stagingu i mapy uzbrojenia (bez sieci)
npm run test:live        # 14 działek na żywych usługach (~3 min); z POWER_LINES_URL=./data/power-lines także linie BDOT10k
npm run etl:power-lines -- --powiaty 0223,0264,0208,0213,1261,1463,1014,0605   # kafle BDOT10k dla działek testowych (~30 s); bez --powiaty cały kraj
npm run test:e2e         # Playwright + mock Supabase na PGlite, 5 testów (~1,5 min; wymaga ANTHROPIC_API_KEY w .env.local, inaczej rekomendacje regułowe)
npx tsx --tsconfig tsconfig.json scripts/cache-benchmark.mts   # pomiar cache: zimny start / nowa instancja / awaria usług (~1 min)
npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/generate-sample-reports.mts   # reports-sample/
```

## 10. Trwały cache i kolejka (20–23.10.2026)

**Co zostało zrobione**

1. **Cache dwupoziomowy** (`src/lib/http.ts`, `src/lib/source-cache.ts`): pamięć instancji (L1) + tabela `source_cache` (L2) wspólna dla wszystkich instancji. Klucz to wersja formatu + źródło + działka (`v1:kimpzp:<id>`). Świeżość jak dotąd: 1 doba, Rejestr Urbanistyczny 6 h. Błędów nie zapisujemy. Awaria lub timeout bazy (2,5 s) nie psuje raportu.
2. **Kopia przy awarii źródła.** Gdy usługa nie odpowiada, a w L2 jest wynik sprzed ≤ 30 dni, raport go używa. W tabeli źródeł pokazuje wtedy „źródło nie odpowiedziało — użyto wcześniej pobranych danych” i oryginalną datę pobrania. Dotyczy też ULDK, które było pojedynczym punktem awarii. ULDK jest teraz w tabeli źródeł.
3. **Cache rekomendacji AI** po skrócie faktów (30 dni), żeby ponowiona próba nie płaciła drugi raz za model.
4. **Bezpiecznik Overpass.** Po awarii OSM jest pomijane przez 5 min we wszystkich instancjach.
5. **Kolejka** (`report_jobs`, `src/lib/report-queue.ts`).
   - Każdy raport (darmowy i po webhooku) to zadanie z dzierżawą 90 s.
   - Pierwsza próba rusza od razu w `after()`.
   - Ponowienia po 15 s / 60 s / 180 s, maks. 4 próby. Nieistniejąca działka to błąd trwały.
   - Gdy przy pierwszej próbie nie odpowie MPZP lub plan ogólny, jest jeszcze jedna próba po 20 s.
   - Zadanie, na które czeka użytkownik, wznawia polling statusu albo odświeżanie strony raportu. Pozostałe wznawia cron co 5 min (`/api/cron/report-jobs` + `netlify/functions/report-jobs-cron.mts`).
   - Zapis raportu i porażka (raport `failed`, zwrot darmowego raportu) dzieją się atomowo w SQL.
   - Dzięki L2 każda kolejna próba zaczyna od tego, co poprzednia zdążyła pobrać, więc limit czasu funkcji przestaje blokować raport.
6. **Mock e2e na PGlite.** Migracje i zapytania aplikacji są testowane na prawdziwym Postgresie (schemat z repo), bez dotykania produkcji.

**Dowody**
- `npm test`: 74/74, w tym 13 testów funkcji SQL kolejki, 6 testów workera i 7 testów cache/bezpiecznika na PGlite.
- `npm run test:e2e`: 5/5. Obejmuje pełną ścieżkę (raport przez kolejkę, wpisy w `source_cache`), wznowienie zadania z wygasłą dzierżawą przez stronę raportu (gotowe po 6,2 s) oraz cron (401 bez sekretu, wykonanie zaległego zadania).
- `tsc`, `next build`: OK.
- `scripts/cache-benchmark.mts`, 23.10.2026, prawdziwe usługi, baza lokalna (sam zbiór danych, bez mapy i AI):

| Działka | Zimny start | Nowa instancja (pusta pamięć, baza z danymi) | Awaria wszystkich usług, cache po terminie |
|---|---|---|---|
| Wrocław Stare Miasto | 16,1 s | 11 ms | 2,4 s — wszystko z kopii, werdykt ten sam |
| Wrocław Lipa Piotrowska | 17,5 s | 8 ms | 2,4 s — werdykt ten sam |
| Wrocław Pilczyce | 3,6 s | 6 ms | 2,4 s — werdykt ten sam |
| Kłodzko | 1,9 s | 6 ms | 2,4 s — werdykt ten sam |

Pierwsze dwa zimne starty to ~15 s czekania na Overpass; potem działa bezpiecznik. Przed bezpiecznikiem „nowa instancja” trwała 10–15 s. Przy awarii OSM i tak jest „niedostępne”, chyba że wcześniej odpowiedziało.

**Wdrożenie — kolejność ma znaczenie**
1. Na stagingu (a potem na produkcji) uruchomić `supabase/migrations/20261020_source_cache_report_jobs.sql`. **Najpierw migracja, potem kod.** Bez tabeli `report_jobs` trasa generowania zwraca 500, a webhook 500 (Stripe będzie ponawiał).
2. Ustawić `CRON_SECRET` (losowy ciąg) w zmiennych hostingu.
3. Po wdrożeniu sprawdzić w logach Netlify, że funkcja `report-jobs-cron` uruchamia się co 5 min i dostaje HTTP 200.
4. Awaryjnie: `SOURCE_CACHE=off` wyłącza L2 (kolejka działa dalej).

**Czego nie zweryfikowałem**
- Migracji nie uruchomiłem na żadnym projekcie Supabase. Testowana na PGlite (Postgres 18) ze `schema.sql` z repo. Jeśli produkcyjny schemat odbiega od `schema.sql`, różnica wyjdzie dopiero na stagingu.
- Uprawnień: w Supabase domyślne uprawnienia dają `EXECUTE` także `anon`/`authenticated`, a migracja je odbiera. 23.10.2026 sprawdzone na stagingu: `anon` i `authenticated` nie mają `EXECUTE` na funkcjach kolejki, `service_role` ma (sekcja 14).
- Hostingu: działanie `after()`, `maxDuration` i funkcji zaplanowanej Netlify (B3). Gdyby hostingiem był Vercel, cron trzeba dodać w `vercel.json`. Trasa przyjmuje nagłówek Vercel Cron, ale plan Hobby pozwala na cron raz na dobę.
- Mock PostgREST obsługuje tylko podzbiór API używany przez aplikację (filtry eq/neq/lt/gt/ilike/is/in, upsert, rpc). Zapytania z osadzaniem relacji (`profiles(email)` w panelu admina) nie są w e2e.

**Ryzyka i założenia**
- Kopia awaryjna ma do 30 dni. W tym czasie plan mógł się zmienić. Raport oznacza takie dane, ale werdykt liczony jest z kopii.
- `source_cache` rośnie o kilka KB na działkę (26 wpisów ≈ 16 KB). Cron usuwa wpisy po `keep_until`.
- Raport, którego wszystkie próby przepadły, kończy się `failed` po ok. 4–6 min (ponowienia po 15 + 60 + 180 s, a próba przerwana przez platformę czeka dodatkowo na koniec dzierżawy 90 s). Wcześniej było to 5 min bez żadnej ponownej próby.

## 11. Plany ogólne z Rejestru Urbanistycznego (23.10.2026)

**Co zostało zrobione**
- Rejestr Urbanistyczny ma publiczne API z geometrią planów. To te same endpointy, których używa jego strona; ustaliłem je z kodu frontendu:
  - `GET /api/public/published-details/{id}/geometries`: strefy planistyczne i obszary OUZ/OZS jako poligony WGS84;
  - `GET …/planning-zones?symbol=SJ&pageSize=1000`: parametry stref (wysokość, intensywność, udział zabudowy, PBC, profile);
  - `GET …/{id}`: dane uchwały.
- Dla działki spoza Wrocławia raport pobiera plan gminy (0,7–2,3 MB gzip, ok. 1 s), przecina strefy i OUZ z obrysem działki i pokazuje to samo, co dotąd tylko dla Wrocławia: strefy z udziałem %, parametry, OUZ z udziałem %, OZS, datę wejścia w życie i uchwałę z linkiem do karty planu w RU. Wynik dla działki trafia do trwałego cache.
- Werdykt „WZ możliwe / poza OUZ” działa we wszystkich gminach z POG w mocy w RU. Na 23.10.2026 to 388 gmin. Wcześniej poza Wrocławiem werdykt brzmiał zawsze „nieustalone”.
- Projekt planu (status „w opracowaniu” lub „w trakcie przyjmowania”) raport pokazuje osobno: w sekcji POG z ostrzeżeniem, że nie obowiązuje, oraz jako ustalenie „uwaga”. **Nie wpływa na werdykt.** Kupujący widzi, czy w projekcie działka trafia do OUZ.
- **Naprawiony błąd** (`5f6c312`): raport brał najnowszy wpis gminy w RU. W Radomiu i Barczewie plan ogólny obowiązuje, ale nowszy wpis to wersja „w opracowaniu”, więc raport podawał „brak planu ogólnego → WZ niemożliwe”. Teraz plan w mocy ma pierwszeństwo, a RU jest odpytywany po kodzie TERC, a nie po nazwie gminy.

**Dowody**
- `npm test`: 84/84, w tym `tests/unit/ru-pog.test.ts` na fixture planu Siechnic (strefa, OUZ ~76%, dwie strefy poza OUZ, działka poza zasięgiem planu, wybór wpisu na przykładzie Radomia).
- `npm run test:live`: 11/12. Nowe działki, każda z oczekiwaniami sprawdzonymi ręcznie:

| Działka | Plan ogólny | Strefa | OUZ | Werdykt |
|---|---|---|---|---|
| Siechnice `022308_5.0021.24` | w mocy (RU) | 685SJ, 100%; 12 m, PBC 50% | 75,7% działki | WZ możliwe |
| Siechnice `022308_5.0010.11` | w mocy (RU) | 1SR 62% + 68SO 38% | nie | MPZP |
| Radom `146301_1.0180.AR_176.7/2` | w mocy (wcześniej błędnie „brak”) | 1SJ | 100% | WZ możliwe |
| gmina Sieradz `101408_2.0021.44/2` | brak; projekt w opracowaniu | w projekcie 5SO 82% + 1SJ 18% | w projekcie 18% | brak POG + informacja o projekcie |

  Jedyny nieudany test live to Milicz, i nie z powodu tej zmiany: KIUT przez pewien czas 23.10 zwracał dla okolic Milicza pusty obraz na wszystkich trzech hostach (`integracja`, `integracja01`, `integracja02`). Kilka godzin później test przeszedł (14/14, sekcja 12), więc była to chwilowa awaria. Problem: przy takiej awarii raport mówi „brak danych w KIUT dla tego obszaru”, bo pustego obrazu nie da się odróżnić od braku danych.
- `npm run test:e2e`: 5/5.
- Przykładowe raporty: `reports-sample/siechnice-ouz`, `siechnice-poza-ouz`, `radom-pog`, `sieradz-projekt-pog`.

**Ograniczenia i ryzyka**
- **RU bywa opóźniony.** Wrocław nadal figuruje w nim jako „w opracowaniu”, dlatego dla Wrocławia źródłem pozostaje GIS miasta. W innych gminach raport opiera się na RU i każe potwierdzić stan w urzędzie.
- **API jest nieudokumentowane.** To wewnętrzne API strony rejestru, które może się zmienić bez zapowiedzi. Przy zbyt częstych zapytaniach odpowiada 429. `fetchWithRetry` ponawia, a wynik działki trzymamy w cache przez dobę.
- **Duże miasta.** Największy sprawdzony plan (Radom, 304 obszary) ma 6,5 MB JSON. Planów największych miast nie mierzyłem; przy bardzo dużych plikach warto będzie trzymać geometrię gminy w bazie (PostGIS) zamiast pobierać ją przy każdej nowej działce.
- **Zmiany planu.** Gdy gmina ma więcej niż jeden plan w mocy (np. zmianę jako osobny akt), raport bierze najnowszy w mocy. Na 23.10.2026 taki przypadek nie występuje.
- **Wartości liczbowe.** Wysokość w RU to tekst („12 m”), z którego raport bierze pierwszą liczbę. Strefy bez parametrów (np. SO — strefa otwarta) mają w raporcie „—”.
- **AI.** W nowych przykładach zostały pojedyncze błędy semantyczne z kategorii opisanej w kroku 5: instytucja spoza listy („Biuro Obsługi Geodety”) i błędna nazwa źródła OSM. Werdykt i ustalenia powstają regułami, nie przez AI.

## 12. Linie energetyczne i rurociągi z BDOT10k (23.10.2026)

**Wybór źródła.** BDOT10k (GUGiK) zamiast ekstraktu OSM:
- dane oficjalne, dla całego kraju, otwarte;
- klasy linii: OT_SULN_L (napowietrzne linie średniego, wysokiego i najwyższego napięcia) i OT_SUPR_L (rurociągi);
- geometria od razu w EPSG:2180;
- indeks paczek z datą aktualizacji każdego powiatu w WFS `BDOT10k_powiaty`.

OSM (Geofabrik) wymagałby parsera PBF i pobrania 1,8 GB, a dawałby głównie napięcie w kV, które BDOT10k zastępuje klasą. Overpass zostaje jako zapas, gdy kafli nie ma.

**Co zostało zrobione** (`7408c9b`, `6568008`, `6b30b22`)
- **ETL** `npm run etl:power-lines`:
  - pobiera 380 paczek powiatowych (~11 GB; serwer nie obsługuje pobierania fragmentów, więc każda paczka jest ściągana w całości i od razu usuwana);
  - wyciąga dwie klasy obiektów i zapisuje kafle 10 × 10 km oraz manifest;
  - jeśli któryś powiat się nie uda, zbiór nie jest publikowany, bo niepełny dałby fałszywe „brak linii”.
- **Upload** `npm run etl:power-lines:upload` do publicznego bucketu `power-lines`:
  - używa osobnych zmiennych `ETL_SUPABASE_*` i wymaga `--yes`, żeby nie dało się przypadkiem pisać do produkcji z `.env.local`;
  - kafle trafiają pod ścieżkę z wersją, a `current.json` jest wgrywany na końcu.
- **Workflow** GitHub Actions uruchamia ETL i upload raz w miesiącu. Jest nieaktywny, dopóki w repozytorium nie ustawi się zmiennej `POWER_LINES_ETL=on` i sekretów.
- **Raport:**
  - pobiera 1–4 kafle wokół działki;
  - podaje najbliższą linię każdej klasy i najbliższy rurociąg każdego rodzaju: odległość od granicy działki do osi linii albo „przez działkę”;
  - pokazuje datę danych powiatu i zakres BDOT10k (bez linii nN i kabli podziemnych).
- **Ustalenia:**
  - linia 220–400 kV ≤ 40 m albo 110 kV ≤ 20 m od granicy działki → **ryzyko** (typowy pas technologiczny);
  - linia 220–400 kV lub 110 kV do 100 m → uwaga;
  - linia SN przez działkę lub ≤ 7 m → uwaga;
  - rurociąg przez działkę albo gazowy/paliwowy ≤ 20 m → uwaga.
- Przy okazji znalazłem i poprawiłem **lukę bezpieczeństwa w bucketcie `utility-maps`** (sekcja 5, ryzyka bezpieczeństwa).

**Dowody**
- `npm test`: 101/101. Testy obejmują parser na fragmentach prawdziwych paczek, kafle i odległości, przypadki „brak danych”, „powiat spoza zbioru” i „brakujący kafel” (błąd, a nie „brak linii”) oraz upload z odczytem przez HTTP na mocku Supabase. Test migracji sprawdza, że polityki zapisu `utility-maps` zniknęły.
- `POWER_LINES_URL=./data/power-lines npm run test:live`: 14/14. Dwie nowe działki: Sobótka `022307_4.0003.541` (linia 110 kV przez działkę, SN 3 m) i Kraków-Podgórze `126104_9.0078.270` (linia 220–400 kV przez działkę).
- ETL na próbie 32 powiatów (po 2 z każdego województwa): 29 711 obiektów (27 064 SN, 692 WN, 141 NN, 1814 rurociągów), 0 błędów, 83 s, 6 MB. Szacunek dla kraju: ok. 15–20 min i ok. 70 MB kafli.
- Zbieranie danych z kaflami trwa ok. 2 s na działkę (wcześniej ok. 16 s przy niedziałającym Overpass).
- `npm run test:e2e`: 5/5 (bez kafli w mocku, czyli ścieżka zapasowa przez OSM). `next build`: OK.
- Przykłady: `reports-sample/sobotka-linia-110kv`, `krakow-podgorze-linia-nn`.

**Wdrożenie**
1. Migracje `20261024_power_lines_bucket.sql` i `20261024_utility_maps_write_policies.sql`, najpierw na stagingu.
2. Pierwszy pełny przebieg ETL i upload (lokalnie albo przez workflow) na staging. **Pełnego przebiegu dla całego kraju nie wykonałem**: przetestowałem 40 powiatów (8 z działkami testowymi i 32 losowe).
3. Bez tych kroków raport działa jak dotąd, z liniami z OSM.

**Ograniczenia**
- **Aktualność:** dane powiatów pochodzą z lat 2021–2024 (np. kłodzki: 23.12.2021). Raport pokazuje datę; nowych linii może brakować.
- **Zakres:** BDOT10k nie zawiera linii niskiego napięcia ani kabli podziemnych. Raport mówi to wprost, a przyłącza dalej opisuje KIUT.
- **Pasy technologiczne:** wartości ±40 m (220–400 kV), ±20 m (110 kV) i ±7 m (SN) są typowe, nie wiążące. Raport każe potwierdzić u operatora. Przy linii 400 kV pas bywa szerszy niż 2 × 40 m.
- **Odcinki:** BDOT10k zapisuje linię jako odcinki między słupami. Raport pokazuje najbliższy odcinek każdej klasy, a nie liczbę linii.
- **AI** w nowych przykładach dopisuje spekulacje („dodatkowe opłaty za służebność”, „pola elektromagnetyczne”). Ustalenia o liniach powstają regułami; to temat kroku 5.


## 13. Eval rekomendacji AI i podstawa w raporcie (23.10.2026)

**Zestaw** (`tests/eval/insights/`, `2116f4a`). 41 prawdziwych działek:
- 14 testowych, 6 z planami ogólnymi z Rejestru Urbanistycznego, 18 z punktów adresowych w różnych województwach, 3 z symulowaną awarią źródeł;
- werdykty: brak POG 18, WZ możliwe 9, MPZP 8, poza OUZ 5, nieustalone 1;
- tematy: powódź 11, Natura 2000 12, POG z RU 14, linia WN/NN 3, projekt POG 3.

`cases.md` pokazuje dokładnie te fakty, które dostaje model.

**Ocena.** Sędzia Sonnet 5.5 ocenia każdy punkt jako zgodny, nieoparty, sprzeczny albo spekulacja, względem tych samych faktów, które dostał model.
- Rubryka jest ostra: koszty, terminy i trudności, których nie ma w faktach, to spekulacja. Zdecydował o tym właściciel po pilocie.
- Metryki:
  - raport bez błędnego punktu (główna);
  - odsetek błędnych punktów;
  - pokrycie ustaleń „ryzyko”;
  - konkretność rekomendacji;
  - spadek na reguły.
- Kontrola sędziego (`judge-sanity.mts`) przeszła 4/4:
  - rekomendacje z reguł → zgodne;
  - 4 podrzucone błędy → wszystkie wychwycone;
  - punkt o innej działce → nieoparty;
  - „Nie wiem.” → niekonkretne.

**Wynik** (41 działek × 2 powtórzenia; porównanie na 69 parach działka × powtórzenie wspólnych dla wszystkich wariantów)

| | Haiku 4.5 (produkcja) | Haiku 5.5, effort low | Haiku 5.5, effort high |
|---|---|---|---|
| Raport bez błędnego punktu | 2,9% | 46,4% | 53,6% |
| Błędne punkty | 34,0% | 11,2% | 9,1% |
| Spekulacja / sprzeczny / nieoparty (wszystkie udane przebiegi) | 121 / 40 / 33 | 37 / 16 / 12 | 27 / 5 / 6 |
| Pokrycie ustaleń „ryzyko” | 100% | 100% | 100% |
| Konkretne rekomendacje | 98% | 100% | 100% |
| Spadek na reguły | 0% | 0% | 5,8%¹ |
| Czas odpowiedzi | 8,6 s | 4,5 s | 13,8 s |
| Koszt modelu na raport | ~$0,006 | ~$0,0007 | ~$0,002 |

¹ Wszystkie przez błąd walidatora opisany niżej.

- **Haiku 5.5 low wobec Haiku 4.5:** mniej błędnych punktów na 35 z 37 działek, na żadnej więcej.
- **High wobec low:** −2,3 pp błędnych punktów (95% CI od −5,8 do 1,0), czyli w granicach szumu. Dwa przebiegi tej samej działki różnią się średnio o 12–18 pp.
- **Przy effort low i medium Haiku 5.5 w ogóle nie myśli** (0 tokenów myślenia), dlatego porównałem low z high, a nie z medium.
- **Pokrycie i konkretność są na maksimum** we wszystkich wariantach, więc nie rozróżniają modeli.
- **Typowy błąd po zmianie modelu** to wciąż ogólny skutek bez podstawy w faktach, np. „procedury mogą wydłużyć inwestycję”.

**Błąd walidatora znaleziony przez eval** (`7c0bf16`)
- Walidator odrzucał punkty, które wymieniały numer działki („wypis i wyrys dla działki 440/1”), oraz daty zapisane słownie („1 września 2026”). Tak było:
  - u Haiku 5.5 low: 108 ze 109 odrzuceń;
  - u Haiku 5.5 high: wszystkie 4 spadki na reguły;
  - u Haiku 4.5: 37 z 45 odrzuceń (numer działki 20, daty 17).
- Po poprawce, na tych samych zapisanych odpowiedziach, odrzuceń jest:
  - Haiku 5.5 low: 109 → 2;
  - Haiku 5.5 high: 141 → 2;
  - Haiku 4.5: 45 → 8.
- Nadal odpadają liczby zaokrąglone albo wyliczone („ponad 23 ha”, „24%” jako 100 − 76).
- **Tabela wyżej powstała przed poprawką**, więc sędzia nie widział odzyskanych punktów. Bieg potwierdzający jest niżej.

**Podstawa w raporcie** (`73a1b3f`)
- Pod każdą rekomendacją i każdym ryzykiem, z AI i z reguł, jest „Podstawa: …” z nazwą sekcji raportu, w której jest fakt.
- Rekomendacja o księdze wieczystej i geodecie nie wynika z danych, więc ma opis „ogólna dobra praktyka przy zakupie działki”.
- Klucz cache odpowiedzi AI zmieniony na `ai2:`, żeby po wdrożeniu stare wpisy (same teksty) nie trafiły do nowego HTML.

**Sędzia** (`09d9520`). Oceny są dobierane po identyfikatorach punktów. 3 przypadki Haiku 4.5 odpadły w biegu, bo sędzia połączył powtórzone punkty, a w pilocie dopisał pokrycie uwag spoza listy. Przeliczenie 233 zapisanych werdyktów nową funkcją daje identyczne oceny.

**Koszt evala:** pilot i kontrola sędziego $0,16, pełny bieg $4,64, czyli ok. $0,02 na przypadek, z czego ok. $0,018 to sędzia.

**Niedokończone → zrobione 23.10.2026**

**Bieg potwierdzający po poprawce walidatora** (23.10.2026; 41 działek × 2; $4,04)

| | Haiku 4.5 | Haiku 5.5, effort low | Różnica (95% CI, na działkach) |
|---|---|---|---|
| Raport bez błędnego punktu | 5,1% | 32,1% | +26,8 pp (17,1 … 36,6) |
| Błędne punkty | 30,4% | 12,8% | −18,6 pp (−24,1 … −13,4) |
| Spekulacja / sprzeczny / nieoparty | 131 / 18 / 34 | 44 / 17 / 22 | |
| Punktów na raport (pierwszy bieg) | 7,7 (7,2) | 8,0 (6,7) | |
| Odrzucone przez walidator na raport (pierwszy bieg) | 0,17 (0,57) | 0,02 (1,33) | |

- **Haiku 5.5 low ma mniej błędnych punktów na 36 z 41 działek**, a więcej na 2.
- **Udział raportów bez błędu spadł u Haiku 5.5 z 46% do 32%.** Raporty mają teraz więcej punktów, czyli więcej okazji do błędu, a odsetek błędnych punktów jest podobny jak w pierwszym biegu (11,2% → 12,8%).
- **Sędzia nie ocenił 4 z 80 przypadków Haiku 4.5:** w 2 zabrakło ocen części punktów, a 2 ucięło na limicie tokenów. Te przypadki są wyłączone z wyników.
- **Nadal najczęstszym błędem jest spekulacja** o kosztach i terminach, np. „może wydłużyć procedury inwestycyjne”. To materiał na poprawę promptu względem tego evala.

**Stan**
- **Konto Anthropic doładowane.** W pierwszym biegu skończyły się środki i 10 przypadków wariantu high się nie wykonało: jest 72 z 82.
- **Przejście na Haiku 5.5 low** (`3f7b789`):
  - kod używa dokładnie konfiguracji wariantu v1 z evala: `claude-haiku-5-5`, `effort: low`, `max_tokens` 8000, bez `temperature` i budżetu myślenia;
  - klucz cache AI zawiera model i effort;
  - działa po wdrożeniu;
  - ścieżka produkcyjna zadziałała na żywo w e2e: raport z `claude-haiku-5-5` z 10 liniami „Podstawa”.
- **Przykłady w `reports-sample/` wygenerowane na Haiku 5.5** (`717a9e5`): 14/14 z AI, 0 odrzuconych punktów.
- **Ograniczenia oceny:**
  - sędzia to też model, a jego kontrola obejmuje tylko 4 przypadki;
  - nikt nie oznaczył ręcznie całego zestawu;
  - eval nie mierzy poprawności językowej ani ogólnej przydatności.

**Jak uruchomić** (wymaga `ANTHROPIC_API_KEY`; stan i wyniki w `.claude/hillclimb/ai-insights/`, poza gitem)
```bash
npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/eval/insights/judge-sanity.mts      # kontrola sędziego (~$0,05)
npx tsx --env-file=.env.local scripts/eval/insights/run-eval.mjs --flow .claude/hillclimb/ai-insights --variant v1 --model claude-haiku-5-5 --reps 2   # ~$1,50 za wariant
```
Po zmianie harnessu (`judge.mjs`, `run-eval.mjs`, `parcels.json`) runner odmawia startu, dopóki człowiek nie uruchomi go raz z `--approve-harness`.

## 14. Staging (23.10.2026)

**Narzędzia** (`9516be3`; opis w `docs/STAGING.md`):
- `supabase/staging/bootstrap.sql`: cały schemat w jednej transakcji, odmawia na bazie z tabelami;
- `supabase/check-schema.sql`: kontrola tylko do odczytu;
- `npm run staging:check-env` i `npm run staging:smoke`.

**Projekt Supabase stagingu** (założony przez konektor Supabase za zgodą właściciela; plan Free, $0/mies.)
- `sprawdzdzialke-staging`, ref `gnpwqwjaehppholjysss`, region eu-central-2 jak produkcja, Postgres 17.
- SQL wykonywany tylko na tym projekcie; przed pierwszym zapytaniem sprawdzone, że ref różni się od produkcyjnego `dpabcijnuzrkzstpnxlz`. Z produkcji odczytane tylko metadane projektu (nazwa, region, status); żadnego SQL.
- Wgrany `bootstrap.sql`, potem migracja `20261025`. Rejestr `ops.applied_migrations` ma 7 plików.

**Dowody**
- **Kontrola schematu:** 33/33 `ok` (31/31 przed migracją `20261025`).
- **Zgodność z repo:** skróty md5 funkcji, ograniczeń, polityk, kolumn, indeksów, bucketów i danych startowych są identyczne na stagingu i na PGlite zbudowanym z tego samego pliku.
  - Różnią się tylko uprawnienia: Supabase daje `service_role` również `EXECUTE` na pomocniczej `report_job_failed_effects` (uprawnienia domyślne Supabase). Bez znaczenia, bo service role i tak omija RLS.
- **Doradca bezpieczeństwa Supabase:**
  - przed `20261025`: 6 ostrzeżeń (zmienny `search_path` ×2, funkcja SECURITY DEFINER dostępna dla `anon` ×2 i `authenticated` ×2);
  - po: 0 ostrzeżeń i 2 informacje, że `report_jobs` i `source_cache` mają RLS bez polityk (celowo: dostęp tylko przez service role).
- **Doradca wydajności:** 7 polityk RLS wywołuje `auth.uid()` dla każdego wiersza, a `payments.user_id` nie ma indeksu. Przy obecnej skali bez znaczenia; nie zmieniałem.

**Migracja `20261025_security_definer_functions.sql`**
- **Co robi:** odbiera `EXECUTE` rolom `anon`/`authenticated` na `increment_free_reports` i `handle_new_user` oraz ustawia im stały `search_path`.
- **Uzasadnienie:** sekcja 5, ryzyka bezpieczeństwa.
- **Testy:**
  - `tests/unit/queue-sql.test.ts`: uprawnienia i `search_path`; trigger zakłada profil, gdy do `auth.users` wstawia rola bez `EXECUTE` na funkcji, tak jak `supabase_auth_admin`;
  - `tests/unit/staging.test.ts`: na bazie „jak produkcja” kontrola schematu wskazuje 4 brakujące pliki.

**Niesprawdzone**
- **Trigger rejestracji po odebraniu uprawnień na prawdziwym Supabase** (sprawdzone, patrz niżej).
  - Supabase nie pozwala z SQL wstawić użytkownika jako `supabase_auth_admin` ani dać tymczasowej roli dostępu do schematu `auth`. Obie próby zostały odrzucone i nic nie zmieniły.
  - Postgres sprawdza `EXECUTE` przy `CREATE TRIGGER`, a nie przy wyzwoleniu. Test lokalny potwierdza to na roli bez uprawnień.
  - **Potwierdzone 23.10.2026:** pierwsza rejestracja e-mailem na stagingu (`testdzialki.netlify.app`) założyła profil (rola `user`, `free_reports_used = 0`, e-mail zgodny z `auth.users`). Migracja `20261025` jest bezpieczna dla produkcji.
- **Witryna Netlify `testdzialki.netlify.app`:** smoke 7/7 (strony, przekierowania, 404, cron 401/200). Stripe i scenariusz raportów w toku.
- **Dane startowe `mpzp_plans`:** plan #40 ma URL mapy i PDF w Storage **produkcji**. Staging pokaże te publiczne pliki z produkcji (tylko odczyt), o ile produkcja działa.

**Stan produkcji (obserwacja, nic nie zmieniałem)**
- **Projekt Supabase `SprawdzDzialke` jest wstrzymany (status INACTIVE).** Plan Free wstrzymuje projekty po tygodniu bez aktywności. Wstrzymanych było wszystkie 6 projektów organizacji.
- **Domena `sprawdzdzialke.com` nie rozwiązuje się w DNS** (brak rekordów A i NS). Z tego komputera serwis nie jest dostępny pod tą domeną.
- **Na planie Free mogą działać naraz 2 projekty.** Staging zajmuje jedno miejsce, więc wznowienie produkcji wykorzysta drugie.

## 15. Mapa uzbrojenia terenu (23.10.2026)

**Problem:** sieci na mapie wyglądały gorzej niż granica działki — plamy zamiast linii, a kolory nie zgadzały się z legendą.
- **Przyczyna 1:** serwer KIUT ignoruje style i rysuje linie 1 px oraz opisy średnic („kd160”, „wo32”). Kod pogrubiał je rozmyciem całego obrazu, więc napisy zmieniały się w plamy.
- **Przyczyna 2:** po rozmyciu kolor był dzielony przez alfę, choć już był pełny. Brązowa kanalizacja i oliwkowy gaz wychodziły jaskrawożółte, a styk czerwonej i niebieskiej linii dawał **fiolet, czyli kolor sieci ciepłowniczej z legendy**. Mapa w płatnym raporcie pokazywała sieć, której nie było.

**Zmiana** (`src/lib/kiut-raster.ts`, `src/lib/utility-map.ts`):
- każdy piksel jest przypisywany do jednej sieci po kolorze serwera (kolory zmierzone na 6 powiatach), a każda sieć jest rysowana osobno jednolitym kolorem legendy, linią ~5 px z ostrą krawędzią i białą obwódką; zdjęcie jest lekko rozjaśnione;
- opisy: w skali ~1:5000 większość serwerów powiatowych rysuje sieci bez opisów, więc mapa bierze geometrię z obrazu 600×375, jeśli dana sieć jest tam kompletna; w przeciwnym razie (np. powiat milicki i kłodzki w tej skali nie rysują nic) bierze pełną rozdzielczość i usuwa opisy po kształcie;
- podpis mapy informuje, że opisy średnic i symbole urządzeń są pominięte.

**Niestabilność serwera KIUT (nowe ryzyko danych)**
- Identyczne zapytania zwracają różne wersje danych. Sobótka, prąd w 10 odpowiedziach 1200 px: 29 123 / 8 686 / 0 pikseli; kompletny tylko w 4.
- Mapa pobiera teraz każdą rozdzielczość dwukrotnie (4 równoległe zapytania, ~1,8 s) i łączy odpowiedzi. W 6 kolejnych renderach Sobótki prąd był zawsze obecny (28,5–35,7 tys. px), wcześniej znikał w części renderów.
- Mapa trafia do cache w Storage tylko wtedy, gdy odpowiedzi się zgadzają. Inaczej jest zapisywana pod jednorazową nazwą i nie zostaje utrwalona dla okolicy. Klucz cache podniesiony do `v5`, więc stare mapy nie są używane.
- ~~Do zrobienia: ten sam problem dotyczy odległości do sieci w tekście raportu~~ — poprawione 23.10.2026 w `src/lib/sources/gesut.ts` (dwie odpowiedzi na warstwę, wynik niezgodny bez cache, obsługa limitu 429). Pomiar i ryzyko szczątkowe: sekcja 5, ryzyka danych.

**Testy** (`tests/unit/utility-map.test.ts`, 10 testów na syntetycznych obrazach i prawdziwych odpowiedziach serwera w `tests/fixtures/kiut`):
- klasyfikacja pikseli;
- usuwanie napisów bez usuwania linii (w tym przyłączy w kształcie L i linii urwanych na krawędzi mapy);
- wybór źródła geometrii dla Sobótki, Milicza i Siechnic;
- niepełne odpowiedzi i łączenie;
- brak plam w kolorze spoza legendy i brak fioletu.

**Pomiar na żywych usługach** dla 7 działek z 6 powiatów: linie bez opisów pokrywają 89–100% linii z serwera (±2 px), a brakujące piksele to kreski i resztki opisów przyklejone do linii.

**Ograniczenia**
- Część opisów stykających się z linią zostaje jako krótkie odgałęzienia.
- Przy dużym zagęszczeniu sieci linie się stykają; na wierzchu jest linia energetyczna.

## 16. Logowanie Google i mapa uzbrojenia (23.10.2026)

### Logowanie (Google, rejestracja, reset hasła)

**Diagnoza.** Logowanie przez Google na stagingu kończyło się stroną z surowym błędem na supabase.co: `Unsupported provider: provider is not enabled` (HTTP 400). Publiczne `/auth/v1/settings` stagingu potwierdza `external.google = false`, czyli w nowym projekcie Supabase dostawcy Google nie skonfigurowano. Kod OAuth nie zmienił się od 28.05.2026; zmieniło się środowisko (nowy projekt stagingu, wstrzymana produkcja). Włączenie Google to konfiguracja po stronie właściciela: Google Cloud i panel Supabase, instrukcja krok po kroku w `docs/STAGING.md`, kroki 4–5. **Nie zrobiono jeszcze.**

**Błędy w kodzie znalezione przy okazji (poprawione):**
- **Open redirect:** `/auth/callback?next=…` przekierowywał po udanym logowaniu pod dowolny adres (`${origin}${next}`, np. `next=@evil.com`). Teraz przyjmowana jest tylko ścieżka w aplikacji (`safeNext` w `src/lib/auth-redirect.ts`).
- **Ciche awarie:**
  - callback ignorował `error` odsyłany przez Supabase (anulowana zgoda, wygasły link);
  - każda porażka kończyła się kodem `auth_callback_failed`, którego `/login` nie wyświetlał;
  - błędy Supabase trafiały na ekran po angielsku.
  Teraz `/login?error=<kod>` pokazuje komunikat po polsku.
- **Rejestracja przy włączonym potwierdzaniu e-maili** (staging: `mailer_autoconfirm = false`):
  - po rejestracji aplikacja przechodziła do panelu, a proxy odsyłało z powrotem na logowanie bez wyjaśnienia; teraz pokazuje „wysłaliśmy link aktywacyjny”;
  - link aktywacyjny nie miał adresu powrotu, więc trafiał na Site URL projektu (domyślnie `localhost:3000`); teraz wraca przez `/auth/callback`.
- **Reset hasła nie działał wcale.** Link z maila prowadził na `/login`, który nie wymienia `code` na sesję, a formularza nowego hasła nie było. Teraz link prowadzi przez `/auth/callback` na nową stronę `/reset-password`.
- **`?redirectTo=`** dodawany przez proxy był ignorowany: po zalogowaniu zawsze `/dashboard`. Teraz logowanie wraca na tę stronę, także przez Google.

**Usunięte:** drugie `window.location.href = data.url` po `signInWithOAuth`. auth-js przekierowuje sam (`skipBrowserRedirect` domyślnie `false`), a komentarz, że `@supabase/ssr` 0.10 tego nie robi, był nieprawdziwy.

**Dodane:** przed przekierowaniem do Google aplikacja sprawdza `/auth/v1/settings`. Przy wyłączonym dostawcy pokazuje komunikat zamiast obcej strony z JSON-em. Gdy sprawdzenie się nie uda, logowanie nie jest blokowane.

**Dowody:**
- `tests/unit/auth-redirect.test.ts`: 19 testów, m.in. `//evil.com`, `/\evil.com`, `/\t/evil.com`, adresy absolutne.
- `tests/e2e/auth.spec.ts`: 7 testów na mocku Supabase, którego `/auth/v1/settings` odpowiada jak staging. Sprawdzają: błędne hasło, powrót na `redirectTo`, `redirectTo` na obcą domenę, wyłączony Google, błąd dostawcy w callbacku, `?next=` na obcą domenę, reset hasła bez sesji. Wszystkie przechodzą.
- `npm test` 156/156; `npm run build` OK.

**Nie sprawdzono:** pełnej ścieżki Google (wymaga konfiguracji właściciela i jego konta Google) ani resetu hasła z prawdziwym mailem.

## Blokery startu (gałąź `chore/launch-blockers`, 23.10.2026)

Braki, które blokują uruchomienie płatnej usługi dla konsumentów. Tu też zapisuję usunięte funkcje i pliki z powodem. Nic nie wdrożone, nic nie wypchnięte.

### Usunięte
- `public/{file,globe,next,vercel,window}.svg`: pliki z create-next-app, nigdzie nieużywane.
- `src/app/favicon.ico` w wersji domyślnej Next.js (25 931 B, ta sama data co reszta szablonu): przeglądarki i wyszukiwarki pokazywały ikonę Next zamiast znaku serwisu. Zastąpiona plikiem z `public/favicon.svg`.
- `public/og-image.png`: ciemna grafika niepasująca do jasnej strony, w dodatku ze zmyślonymi danymi (Długołęka 556/6, MN, 9 m, 30%), których prawdziwy raport nie podaje. Zastąpiona przez `src/app/opengraph-image.tsx`, który pokazuje tylko, z jakich części składa się raport.

- `/pricing`: plany „Starter” i „Pro”, odznaka „Popularne” oraz krzyżyki przy ISOK, AI i „analizie ryzyk” w darmowym raporcie. Darmowy raport przechodzi ten sam potok co płatny (`api/report/generate` różni je tylko flagą `paid`), więc podział był nieprawdziwy. Zostały „Pierwszy raport, 0 zł” i „Każdy kolejny, 29 zł” z jedną listą zawartości. Odznaka „Popularne” nie ma sensu przy płatności za pojedynczy raport.
- Obietnica „Eksport do PDF” (`/pricing`, `PaymentGate`): PDF nie istnieje, przycisk wywołuje `print()`. Teraz jest „wydruk lub zapis do PDF z przeglądarki”. Napis przycisku w `ReportView` zmienia sesja UI.
- „Parametry zabudowy z MPZP (symbol, wysokość, PBC, dach)” w `PaymentGate`: Krajowa Integracja MPZP zwykle podaje tylko symbol i uchwałę, a parametry daje plan ogólny z Rejestru Urbanistycznego, jeśli gmina go opublikowała.

### Strony prawne
Dodane `/regulamin`, `/polityka-prywatnosci` i `/kontakt` (grupa `src/app/(legal)`) oraz ich adresy w `sitemap.ts`. Dane firmy pochodzą z `src/lib/company.ts`. **Teksty to wzór napisany bez prawnika.** Dopóki `LEGAL_DRAFT = true` (`src/lib/legal.ts`), strony pokazują baner i uwagi „Do weryfikacji”.

Ustalenia, które zmieniły treść względem założeń:
- **Supabase nie jest w UE.** Produkcja i staging stoją w regionie `eu-central-2`, czyli w Zurychu (Szwajcaria, decyzja KE o adekwatności). Polityka podaje Szwajcarię.
- **Baner cookies nie jest potrzebny.** Serwis nie ma analityki ani Stripe.js, a strony publiczne nie ustawiają cookies. Po zalogowaniu działają tylko `sb-<ref>-auth-token` (sesja, do 400 dni) i `…-code-verifier` (PKCE). To cookies niezbędne, zwolnione ze zgody (art. 399 PKE). Jeśli dojdzie analityka, baner zgody stanie się konieczny.

### Czas generowania: pomiar i obietnica
Strona obiecywała trzy różne czasy: „w 60 sekund” (tytuł, hero, OG, rejestracja, 7 artykułów), „30–60 s” (FAQ, llms.txt) i „kilka minut” (payment-success). Pomiar z 24.10.2026: `scripts/generate-sample-reports.mts`, 8 działek z różnych gmin, bez trwałego cache, Haiku 5.5 z klucza stagingu. Mierzy zbieranie danych, AI i HTML, bez kolejki i odpytywania statusu co 3 s.

| Działka | Czas |
|---|---|
| Wrocław Stare Miasto | 20,6 s (w tym 15 s timeoutu Overpass, potem bezpiecznik) |
| Kłodzko, Długołęka, Batorz, Milicz, Siechnice, Radom, Sobótka | 7,1–8,2 s |

Wszędzie AI odpowiedziało. Obietnica brzmi teraz „zwykle w mniej niż minutę”, a FAQ dodaje, że przy awarii rejestru ponowienia mogą trwać kilka minut (kolejka: 15/60/180 s). Tak samo pisze sesja UI. Do zmiany po scaleniu `ui/redesign` zostały: hero w `HomePageContent.tsx` i CTA w `blog/page.tsx` oraz `blog/[slug]`.

### Otwarte blokery (po stronie właściciela)
1. **Weryfikacja regulaminu i polityki przez prawnika**, potem `LEGAL_DRAFT = false` i usunięcie uwag `DraftNote`.
2. **Potwierdzenie umowy na trwałym nośniku.** Wyłączenie prawa odstąpienia (art. 38 ust. 1 pkt 13 upk) wymaga przesłania konsumentowi potwierdzenia ze zgodą, np. e-mailem. Serwis nie ma dostawcy poczty transakcyjnej, a e-mail od Stripe nie zawiera treści zgody. Bez tego zgoda zbierana przed płatnością może nie wyłączyć prawa odstąpienia.
3. **Zwrot za nieudany płatny raport** robi się dziś ręcznie w panelu Stripe. Kolejka zwraca tylko darmowy limit.
4. **Umowy powierzenia (DPA) i podstawy transferu**: Supabase, Netlify, Stripe, Anthropic. Do ustalenia, który podmiot Anthropic obsługuje klientów z UE.
5. **Skrzynka kontakt@lintel.pl** musi odbierać pocztę, bo jest jedynym kanałem reklamacji, odstąpień, faktur i RODO.
6. **Zgoda przy logowaniu przez Google nie jest zapisywana.** Przy rejestracji e-mailem wersja i czas akceptacji regulaminu trafiają do `auth.users.raw_user_meta_data` (`terms_version`, `terms_accepted_at`). Przy Google `/register` wymaga zaznaczenia zgody, ale OAuth nie przenosi metadanych. Na `/login` pierwsze logowanie przez Google zakłada konto po informacji o regulaminie, bez checkboxa. Zapis wymagałby migracji (np. kolumna w `profiles`) i zapisu po callbacku.
7. **Linie energetyczne z BDOT10k są obiecane w cenniku i FAQ.** Działają jednak tylko tam, gdzie wgrano kafle (`npm run etl:power-lines`, potem `etl:power-lines:upload`, sekcja 12). Pełnego przebiegu dla kraju jeszcze nie wykonano. Przed startem trzeba uruchomić ETL albo usunąć tę obietnicę.
8. **Google Search Console:** domenę najprościej zweryfikować rekordem DNS TXT (właściwość „Domena”), co nie wymaga zmian w kodzie. Pusty blok `verification` z TODO usunięty z `layout.tsx`. Weryfikacja możliwa po odnowieniu domeny.
9. **Klucz Anthropic z `.env.local` był jawnie w `.claude/launch.json`.** Trzeba go zrotować w konsoli Anthropic, a nową wartość wpisać do `.env.local` i na hostingu. Wpis w `launch.json` miał zostać usunięty w tej sesji, ale klasyfikator uprawnień zablokował zapis do pliku z sekretem, więc trzeba go usunąć ręcznie albo udzielić zgody.
