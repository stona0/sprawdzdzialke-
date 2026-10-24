# Staging — instrukcja krok po kroku

Staging to osobna kopia serwisu do sprawdzenia brancha `fix/autonomous-recovery` (PR #6) przed produkcją. Składa się z trzech rzeczy:
- osobnego projektu Supabase;
- osobnej witryny Netlify;
- trybu testowego Stripe.

Produkcja nie jest tu w ogóle dotykana. Czas pracy: ok. 1–1,5 godziny.

Przygotowane w repo:

| Plik | Do czego |
|---|---|
| `supabase/staging/bootstrap.sql` | Cały schemat dla nowego projektu Supabase w jednej transakcji. Odmawia działania na bazie, która ma już tabele, np. na produkcji. |
| `supabase/check-schema.sql` | Kontrola schematu, tylko odczyt. Na stagingu potwierdza, że wszystko jest; na produkcji pokazuje brakujące migracje. |
| `docs/staging.env.example` | Lista zmiennych stagingu. |
| `npm run staging:check-env -- .env.staging` | Sprawdza zmienne przed wpisaniem do Netlify, m.in. czy baza nie jest produkcyjna i czy klucze Stripe są testowe. |
| `npm run staging:smoke -- .env.staging` | Szybkie sprawdzenie wdrożonego stagingu przez HTTP. |

## 1. Supabase: nowy projekt (ok. 15 min)

> **Stan 23.10.2026:** punkty 1–3 zrobione przez konektor Supabase. Projekt `sprawdzdzialke-staging` (ref `gnpwqwjaehppholjysss`, eu-central-2) ma schemat ze wszystkich 7 plików, a kontrola schematu dała 33/33 `ok`. Zostały punkty 4–7.

1. **Utwórz projekt:** supabase.com → New project.
   - Nazwa: `sprawdzdzialke-staging`.
   - Region: ten sam co produkcja.
   - Silne hasło bazy, zapisane w menedżerze haseł.
2. **Wgraj schemat:** SQL Editor → wklej całą zawartość `supabase/staging/bootstrap.sql` → Run.
   - Oczekiwany wynik: „Success. No rows returned”.
   - Jeśli skrypt zgłosi, że baza ma już `public.profiles`, jesteś w złym projekcie. Nic nie zostało zmienione.
3. **Sprawdź schemat:** SQL Editor → `supabase/check-schema.sql` → Run. Wszystkie wiersze powinny mieć `ok = true`.
4. **Authentication → URL Configuration:**
   - Site URL: `https://testdzialki.netlify.app`. Domyślne `http://localhost:3000` psuje linki z maili, gdy adres powrotu nie pasuje do listy poniżej.
   - Redirect URLs: `https://testdzialki.netlify.app/**` i `http://localhost:3000/**` (lokalny `next dev` na stagingu).
5. **Authentication → Providers:**
   - E-mail wystarczy do testów. Na stagingu można wyłączyć „Confirm email”, żeby nie czekać na maile; wbudowana poczta Supabase ma niski limit wysyłki. Przy włączonym potwierdzaniu rejestracja pokazuje „wysłaliśmy link aktywacyjny”, a link wraca przez `/auth/callback`.
   - **Google** (stan 23.10.2026: wyłączony, `external.google = false`; przycisk pokazuje „Logowanie przez Google jest chwilowo niedostępne”):
     1. Google Cloud Console → Google Auth Platform (dawniej „OAuth consent screen”): typ odbiorców External, stan publikacji **„Testing”** z listą testerów (Audience → Test users, do 100 adresów Gmail; inni dostaną „Dostęp zablokowany”). Publikacja („In production”) wymaga adresu strony głównej i polityki prywatności — strony są na gałęzi `chore/launch-blockers` (`/polityka-prywatnosci`, `/regulamin`), dostępne publicznie dopiero po wdrożeniu i odnowieniu domeny. Branding → Autoryzowane domeny: `gnpwqwjaehppholjysss.supabase.co`, `testdzialki.netlify.app` (bez `https://`).
     2. Clients → Create client → Web application. Authorized JavaScript origins: `https://testdzialki.netlify.app`, `http://localhost:3000`. Authorized redirect URIs: `https://gnpwqwjaehppholjysss.supabase.co/auth/v1/callback`. Skopiuj Client ID i Client secret (sekret widać tylko przy tworzeniu).
     3. Supabase → Authentication → Sign In / Providers → Google → Enable, wklej Client ID i Client secret → Save.
     4. Sprawdzenie: `curl -s https://gnpwqwjaehppholjysss.supabase.co/auth/v1/settings -H "apikey: <anon>"` → `"google":true`; przycisk „Kontynuuj z Google” prowadzi na ekran zgody Google.
   - Produkcja po wznowieniu: najpierw strona główna i polityka prywatności na `sprawdzdzialke.com` → Branding (strona główna, polityka prywatności, autoryzowana domena `sprawdzdzialke.com` i `<ref produkcji>.supabase.co`) → Audience → Publish app. Ten sam klient może mieć drugi redirect URI `https://<ref produkcji>.supabase.co/auth/v1/callback` i origin `https://sprawdzdzialke.com`; w projekcie produkcji Site URL `https://sprawdzdzialke.com`, Redirect URLs `https://sprawdzdzialke.com/**`.
6. **Project Settings → API:** skopiuj URL, klucz anon (publishable) i service_role (secret) do `.env.staging` (krok 3).
7. **Panel admina (po pierwszej rejestracji na stagingu):** w SQL Editor uruchom
   `update public.profiles set role = 'admin' where user_id = (select id from auth.users where email = '<twój e-mail>');`

## 2. Stripe: tryb testowy (ok. 15 min)

1. **Włącz tryb testowy:** Dashboard → przełącznik „Test mode”.
2. **Klucze:** Developers → API keys → skopiuj `pk_test_…` i `sk_test_…`.
3. **Metody płatności:** Settings → Payment methods (w trybie testowym) → włącz BLIK i Przelewy24. Aplikacja tworzy płatność z metodami karta + BLIK + P24, a nieaktywna metoda może zablokować utworzenie płatności.
4. **Webhook:** Developers → Webhooks → Add endpoint.
   - Adres: `<adres stagingu>/api/payments/webhook`.
   - Zdarzenie: `checkout.session.completed`.
   - Skopiuj „Signing secret” (`whsec_…`).

## 3. Zmienne stagingu

```bash
cp docs/staging.env.example .env.staging
openssl rand -hex 32          # wartość dla CRON_SECRET
npm run staging:check-env -- .env.staging
```

Skrypt wypisuje tylko nazwy zmiennych i wynik, nigdy wartości. Przerwie się m.in. wtedy, gdy:
- URL Supabase jest produkcyjny (porównuje z `.env.local`);
- klucz Supabase należy do innego projektu;
- klucze Stripe są live;
- adres jest produkcyjny.

## 4. Netlify: osobna witryna (ok. 20 min)

1. **Utwórz witrynę:** Add new site → Import an existing project → GitHub → `stona0/sprawdzdzialke-`.
   - Branch to deploy: `fix/autonomous-recovery`.
   - Ustawienia builda biorą się z `netlify.toml`.
2. **Zmienne:** Site configuration → Environment variables → Import from a .env file → wklej `.env.staging`.
3. **Wdróż:** Deploy. Jeśli adres witryny różni się od `NEXT_PUBLIC_APP_URL`, popraw zmienną (i Site URL w Supabase oraz adres webhooka w Stripe), a potem wdróż ponownie.
4. **Dlaczego osobna witryna, a nie podgląd brancha w produkcyjnej:**
   - Funkcje zaplanowane Netlify (cron kolejki `report-jobs-cron`, co 5 min) działają na opublikowanym wdrożeniu witryny. W osobnej witrynie branch stagingu jest jej publikowanym wdrożeniem, więc cron działa.
   - Zmienne stagingu nie mieszają się z produkcyjnymi.
5. **Witryna produkcyjna:**
   - Podglądy PR (Deploy Previews) używają domyślnie zmiennych produkcji, czyli produkcyjnego Supabase i kluczy live.
   - Dopóki PR #6 jest otwarty, wyłącz podglądy (Site configuration → Build & deploy → Deploy Previews) albo ustaw dla kontekstu „Deploy Previews” wartości stagingu.

## 5. Opcjonalnie: kafle linii BDOT10k na stagingu

Bez kafli raport pokazuje linie z OSM, tak jak dziś. Żeby sprawdzić BDOT10k, wygeneruj kafle i wgraj je do stagingu:

```bash
npm run etl:power-lines -- --powiaty 0223,0264,0208,0213,1261,1463,1014,0605   # ~30 s; bez --powiaty cały kraj (~20 min)
ETL_SUPABASE_URL=<URL stagingu> ETL_SUPABASE_SERVICE_ROLE_KEY=<service_role stagingu> npm run etl:power-lines:upload -- --yes
```

## 6. Sprawdzenie stagingu

```bash
npm run staging:smoke -- .env.staging
```

Skrypt sprawdza:
- strony publiczne;
- przekierowanie na `/login`;
- 404 dla nieznanych ścieżek;
- cron (401 bez sekretu, 200 z sekretem);
- kafle w Storage.

Potem scenariusz ręczny:
1. **Rejestracja e-mailem i logowanie.** W Table Editor → `profiles` musi pojawić się wiersz z Twoim e-mailem.
   - To potwierdza, że trigger rejestracji działa po migracji `20261025` (odbiera uprawnienia do funkcji triggera).
   - Jeśli rejestracja kończy się błędem „Database error saving new user”, **nie** uruchamiaj tej migracji na produkcji.
2. **Darmowy raport:** działka, np. `022307_4.0003.541` (Sobótka, linia 110 kV). Raport powinien być gotowy w ok. 30–60 s. Sprawdź sekcje, mapę i „Podstawa: …” przy rekomendacjach.
3. **Płatny raport:** drugi raport → płatność kartą testową `4242 4242 4242 4242`, dowolna przyszła data i CVC. Po powrocie raport generuje się po webhooku. W Stripe (test) → Webhooks zdarzenie ma status 200.
4. **Baza** (Supabase → Table Editor):
   - `payments`: płatność opłacona;
   - `report_jobs`: zadania zakończone;
   - `profiles.free_reports_used = 1`.
5. **Cron:** po 5 min w Netlify → Logs → Functions → `report-jobs-cron` widać `HTTP 200`.
6. **Odporność (opcjonalnie):** odśwież stronę raportu w trakcie generowania. Zadanie powinno się dokończyć, a nie zawisnąć w „generating”.

## 7. Po stagingu: produkcja

1. **Kopia bazy produkcyjnej:** Database → Backups albo `pg_dump`.
2. **Kontrola przed migracjami:** SQL Editor produkcji → `supabase/check-schema.sql` (tylko odczyt). Wiersze z `ok = false` pokażą brakujące pliki, zwykle cztery migracje z tego brancha.
3. **Migracje po kolei**, każdą osobno w SQL Editor:
   - `20261020_source_cache_report_jobs.sql`
   - `20261024_power_lines_bucket.sql`
   - `20261024_utility_maps_write_policies.sql`
   - `20261025_security_definer_functions.sql`
   - Potem ponownie `check-schema.sql`: wszystko `ok = true`.
   - **Nie** używaj `bootstrap.sql` na produkcji (i tak odmówi).
4. **`CRON_SECRET`** w zmiennych witryny produkcyjnej.
5. **Scal PR #6.** Netlify wdroży produkcję. Migracje muszą być przed kodem: bez `report_jobs` generowanie zwraca 500.
6. **Sprawdzenie na produkcji:** jeden raport darmowy, jeden płatny prawdziwą płatnością (można ją zwrócić w Stripe) i log crona.
