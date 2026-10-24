import type { Metadata } from 'next'
import Link from 'next/link'
import { COMPANY, COMPANY_ADDRESS } from '@/lib/company'
import { DraftNote, LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Regulamin',
  description: 'Regulamin serwisu SprawdzDziałkę.com: zasady korzystania, ceny raportów, płatności, odstąpienie od umowy i reklamacje.',
  alternates: { canonical: 'https://sprawdzdzialke.com/regulamin' },
}

const mail = <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>

export default function TermsPage() {
  return (
    <LegalPage title="Regulamin serwisu SprawdzDziałkę.com">
      <h2>§ 1. Usługodawca i postanowienia ogólne</h2>
      <ol>
        <li>
          Regulamin określa zasady korzystania z serwisu internetowego SprawdzDziałkę.com dostępnego pod adresem{' '}
          <a href={COMPANY.url}>sprawdzdzialke.com</a> („Serwis”), w tym zasady świadczenia usług drogą elektroniczną
          i zawierania umów o dostarczenie treści cyfrowych.
        </li>
        <li>
          Serwis prowadzi {COMPANY.name}, {COMPANY_ADDRESS}, NIP {COMPANY.nip}, REGON {COMPANY.regon}{' '}
          („Usługodawca”). Kontakt: {mail}.
        </li>
        <li>Regulamin jest udostępniany nieodpłatnie w Serwisie w formie, która umożliwia jego pobranie, utrwalenie i wydrukowanie.</li>
      </ol>

      <h2>§ 2. Definicje</h2>
      <ul>
        <li><strong>Użytkownik</strong> — osoba korzystająca z Serwisu.</li>
        <li><strong>Konsument</strong> — Użytkownik będący konsumentem w rozumieniu art. 22¹ Kodeksu cywilnego.</li>
        <li>
          <strong>Przedsiębiorca na prawach konsumenta</strong> — osoba fizyczna zawierająca umowę bezpośrednio związaną
          z jej działalnością gospodarczą, gdy z treści umowy wynika, że nie ma ona dla niej charakteru zawodowego (art. 38a
          ustawy o prawach konsumenta). Postanowienia regulaminu dotyczące Konsumentów w zakresie odstąpienia od umowy,
          zgodności Raportu z umową i klauzul niedozwolonych stosuje się do niej odpowiednio.
        </li>
        <li><strong>Konto</strong> — indywidualne konto Użytkownika w Serwisie.</li>
        <li><strong>Raport</strong> — treść cyfrowa generowana przez Serwis dla wskazanej działki ewidencyjnej, opisana w § 3.</li>
      </ul>

      <h2>§ 3. Czym jest Raport</h2>
      <ol>
        <li>
          Raport zestawia informacje o działce pobrane automatycznie z rejestrów i usług publicznych, w szczególności:
          ewidencji gruntów (ULDK, GUGiK), Krajowej Integracji Miejscowych Planów Zagospodarowania Przestrzennego,
          Rejestru Urbanistycznego (plany ogólne gmin), map zagrożenia powodziowego (ISOK), danych o formach ochrony
          przyrody (GDOŚ), Krajowej Integracji Uzbrojenia Terenu, BDOT10k oraz OpenStreetMap. Raport zawiera także ocenę
          możliwości zabudowy według przepisów obowiązujących w chwili jego wygenerowania oraz rekomendacje i ryzyka
          przygotowane przez model sztucznej inteligencji (Claude, Anthropic) wyłącznie na podstawie tych danych.
        </li>
        <li>
          Raport ma charakter informacyjny. Nie jest wypisem ani wyrysem z planu miejscowego, zaświadczeniem, decyzją
          administracyjną, interpretacją przepisów prawa miejscowego ani poradą prawną.
        </li>
        <li>
          Rejestry publiczne bywają niekompletne, nieaktualne lub chwilowo niedostępne, a gminy przekazują do nich różny
          zakres danych. Raport wskazuje dla każdego źródła, czy dane zostały pobrane. Treści wygenerowane przez sztuczną
          inteligencję mogą zawierać błędy. Przed decyzją o zakupie lub inwestycji należy potwierdzić stan planistyczny
          w urzędzie gminy, a warunki przyłączenia mediów u operatorów sieci.
        </li>
        <li>Dane w Raporcie odpowiadają stanowi rejestrów w chwili jego wygenerowania. Serwis może korzystać z kopii odpowiedzi rejestrów nie starszych niż 24 godziny.</li>
      </ol>

      <h2>§ 4. Wymagania techniczne i zasady korzystania</h2>
      <ol>
        <li>
          Do korzystania z Serwisu potrzebne są: urządzenie z dostępem do internetu, aktualna przeglądarka internetowa
          z włączoną obsługą JavaScript i plików cookies oraz adres e-mail albo konto Google.
        </li>
        <li>Użytkownik nie może dostarczać treści o charakterze bezprawnym ani podejmować działań zakłócających działanie Serwisu, w tym automatycznego pobierania Raportów.</li>
      </ol>

      <h2>§ 5. Konto</h2>
      <ol>
        <li>
          Założenie Konta jest bezpłatne. Wymaga podania adresu e-mail i hasła albo zalogowania się kontem Google oraz
          akceptacji regulaminu. Umowa o prowadzenie Konta zostaje zawarta na czas nieoznaczony z chwilą jego założenia.
        </li>
        <li>
          Użytkownik może w każdej chwili wypowiedzieć umowę o prowadzenie Konta, wysyłając prośbę o usunięcie Konta na
          adres {mail}. Usunięcie Konta usuwa zapisane w nim Raporty.
        </li>
        <li>
          Usługodawca może wypowiedzieć umowę o prowadzenie Konta z zachowaniem 14-dniowego terminu wypowiedzenia, jeżeli
          Użytkownik rażąco narusza regulamin, po wcześniejszym bezskutecznym wezwaniu do zaprzestania naruszeń.
        </li>
      </ol>

      <h2>§ 6. Ceny i płatności</h2>
      <ol>
        <li>Pierwszy Raport w ramach Konta jest bezpłatny.</li>
        <li>
          Każdy kolejny Raport kosztuje 29 zł brutto (cena zawiera podatek VAT). Opłata jest jednorazowa, bez subskrypcji
          i bez opłat cyklicznych.
        </li>
        <li>
          Płatności obsługuje Stripe Payments Europe, Ltd. Dostępne metody: karta płatnicza, BLIK, Przelewy24. Serwis nie
          przetwarza danych kart płatniczych.
        </li>
        <li>
          Umowa o dostarczenie płatnego Raportu zostaje zawarta z chwilą złożenia zamówienia przyciskiem „Zapłać 29 zł”
          i opłacenia go w Stripe.
        </li>
        <li>Na żądanie Usługodawca wystawia fakturę VAT. Prośbę z danymi do faktury należy wysłać na adres {mail}.</li>
      </ol>

      <h2>§ 7. Dostarczenie Raportu</h2>
      <ol>
        <li>
          Raport jest generowany automatycznie niezwłocznie po zamówieniu bezpłatnego Raportu albo po potwierdzeniu
          płatności, z reguły w ciągu kilku minut, i udostępniany w Koncie. Raport pozostaje dostępny w Koncie do czasu
          jego usunięcia. Można go wydrukować lub zapisać jako plik PDF funkcją drukowania przeglądarki.
        </li>
        <li>
          Jeżeli Raport nie zostanie dostarczony, Konsument może wezwać Usługodawcę do jego dostarczenia. Gdy Usługodawca
          nie dostarczy Raportu niezwłocznie lub w dodatkowym, wyraźnie uzgodnionym terminie, Konsument może odstąpić od
          umowy, a Usługodawca zwraca zapłaconą cenę niezwłocznie, nie później niż w ciągu 14 dni.
        </li>
      </ol>
      <DraftNote>zwrot płatności za nieudany Raport wykonuje się dziś ręcznie w panelu Stripe. Serwis nie robi tego automatycznie.</DraftNote>

      <h2>§ 8. Odstąpienie od umowy</h2>
      <ol>
        <li>
          Konsument może odstąpić od umowy zawartej na odległość bez podania przyczyny w terminie 14 dni od dnia jej
          zawarcia, składając oświadczenie na adres {mail}. Wystarczy wysłać oświadczenie przed upływem terminu.
        </li>
        <li>
          Prawo odstąpienia nie przysługuje w odniesieniu do płatnego Raportu, jeżeli Usługodawca rozpoczął jego
          dostarczanie za wyraźną i uprzednią zgodą Konsumenta, który przed rozpoczęciem świadczenia został poinformowany,
          że po jego spełnieniu utraci prawo odstąpienia od umowy, przyjął to do wiadomości, a Usługodawca przekazał mu
          potwierdzenie zawarcia umowy (art. 38 ust. 1 pkt 13 ustawy o prawach konsumenta). Zgodę Konsument wyraża
          w Serwisie przed przejściem do płatności. Raport jest generowany natychmiast po płatności, dlatego bez takiej
          zgody nie można go zamówić.
        </li>
        <li>
          Potwierdzenie zawarcia umowy, wraz z treścią zgody, Usługodawca przekazuje na trwałym nośniku, na adres e-mail
          przypisany do Konta.
        </li>
        <li>
          W razie skutecznego odstąpienia Usługodawca zwraca płatność niezwłocznie, nie później niż w ciągu 14 dni, tą samą
          metodą, którą jej dokonano, chyba że Konsument zgodzi się na inną.
        </li>
        <li>
          Wzór oświadczenia: „Ja, [imię i nazwisko, adres e-mail Konta], informuję o odstąpieniu od umowy o dostarczenie
          Raportu dla działki [identyfikator działki], zawartej dnia [data]”.
        </li>
      </ol>
      <DraftNote>potwierdzenie z ust. 3 nie jest jeszcze wysyłane. Serwis nie ma dostawcy poczty transakcyjnej, a e-mail od Stripe nie zawiera treści zgody. Bez tego wyłączenie prawa odstąpienia może być nieskuteczne. Zobacz REPORT.md, sekcja „Blokery startu”.</DraftNote>

      <h2>§ 9. Reklamacje</h2>
      <ol>
        <li>
          Usługodawca odpowiada za zgodność Raportu z umową na zasadach określonych w rozdziale 5b ustawy o prawach
          konsumenta, a wobec Użytkowników niebędących Konsumentami — w zakresie wynikającym z § 10.
        </li>
        <li>
          Reklamację można złożyć na adres {mail}. Warto podać adres e-mail Konta, identyfikator działki lub Raportu oraz
          opis problemu. Usługodawca odpowiada na reklamację w ciągu 14 dni od jej otrzymania.
        </li>
        <li>
          Jeżeli Raport jest niezgodny z umową, Konsument może żądać doprowadzenia go do zgodności, w szczególności przez
          ponowne wygenerowanie, a w przypadkach przewidzianych w ustawie — obniżenia ceny lub odstąpienia od umowy.
        </li>
        <li>
          Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji, w tym z pomocy miejskiego lub
          powiatowego rzecznika konsumentów albo Wojewódzkiego Inspektoratu Inspekcji Handlowej. Informacje są dostępne
          na stronie <a href="https://uokik.gov.pl">uokik.gov.pl</a>.
        </li>
      </ol>
      <DraftNote>regulamin nie odsyła do platformy ODR, bo Komisja Europejska zamknęła ją 20.07.2025. Prawnik powinien to potwierdzić.</DraftNote>

      <h2>§ 10. Odpowiedzialność wobec przedsiębiorców</h2>
      <p>
        Wobec Użytkowników niebędących Konsumentami ani Przedsiębiorcami na prawach konsumenta odpowiedzialność
        Usługodawcy z tytułu Raportu jest ograniczona do zapłaconej za niego ceny i nie obejmuje utraconych korzyści.
        Ograniczenie nie dotyczy szkody wyrządzonej umyślnie.
      </p>

      <h2>§ 11. Dane osobowe</h2>
      <p>
        Zasady przetwarzania danych osobowych i plików cookies opisuje{' '}
        <Link href="/polityka-prywatnosci">Polityka prywatności</Link>.
      </p>

      <h2>§ 12. Postanowienia końcowe</h2>
      <ol>
        <li>
          Usługodawca może zmienić regulamin z ważnych przyczyn, w szczególności przy zmianie przepisów, zakresu Raportu,
          cen lub metod płatności. O zmianie Użytkownicy posiadający Konto są informowani e-mailem co najmniej 14 dni przed
          jej wejściem w życie. Do zamówień złożonych wcześniej stosuje się dotychczasową wersję.
        </li>
        <li>
          Do umów stosuje się prawo polskie. Wybór prawa nie pozbawia Konsumenta ochrony przyznanej mu przez przepisy,
          których nie można wyłączyć umową, obowiązujące w państwie jego zwykłego pobytu.
        </li>
      </ol>
    </LegalPage>
  )
}
