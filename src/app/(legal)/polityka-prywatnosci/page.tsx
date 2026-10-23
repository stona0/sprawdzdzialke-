import type { Metadata } from 'next'
import Link from 'next/link'
import { COMPANY, COMPANY_ADDRESS } from '@/lib/company'
import { DraftNote, LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Polityka prywatności',
  description: 'Jak SprawdzDziałkę.com przetwarza dane osobowe i jakich plików cookies używa.',
  alternates: { canonical: 'https://sprawdzdzialke.com/polityka-prywatnosci' },
}

const mail = <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>

export default function PrivacyPage() {
  return (
    <LegalPage title="Polityka prywatności">
      <h2>1. Administrator danych</h2>
      <p>
        Administratorem danych osobowych jest {COMPANY.name}, {COMPANY_ADDRESS}, NIP {COMPANY.nip}, REGON {COMPANY.regon}.
        We wszystkich sprawach dotyczących danych osobowych można pisać na adres {mail}.
      </p>

      <h2>2. Jakie dane przetwarzamy i po co</h2>
      <ul>
        <li>
          <strong>Konto:</strong> adres e-mail i hasło, które przechowujemy wyłącznie jako skrót kryptograficzny. Przy
          logowaniu przez Google dostajemy też imię, nazwisko i adres zdjęcia profilowego, jeśli Google je udostępnia.
          Cel: założenie i prowadzenie Konta. Podstawa: wykonanie umowy (art. 6 ust. 1 lit. b RODO).
        </li>
        <li>
          <strong>Raporty:</strong> identyfikator działki, gmina, treść Raportu i data jego wygenerowania. Cel: dostarczenie
          Raportu i udostępnienie go w Koncie. Podstawa: wykonanie umowy.
        </li>
        <li>
          <strong>Płatności:</strong> identyfikator sesji płatności Stripe, kwota, status i data. Przy płatności Stripe
          przetwarza też adres e-mail oraz dane karty albo rachunku. Danych kart nie widzimy. Cel: rozliczenie zamówienia,
          zwroty i reklamacje. Podstawa: wykonanie umowy. Dane z faktur przechowujemy, bo wymagają tego przepisy
          podatkowe (art. 6 ust. 1 lit. c RODO).
        </li>
        <li>
          <strong>Zgody na regulamin i utratę prawa odstąpienia:</strong> wersja regulaminu i chwila wyrażenia zgody.
          Cel: wykazanie, że zgoda została wyrażona. Podstawa: obowiązek prawny i nasz prawnie uzasadniony interes (art. 6
          ust. 1 lit. c i f RODO).
        </li>
        <li>
          <strong>Dane techniczne:</strong> adres IP i informacje o żądaniach w logach dostawców hostingu i bazy danych.
          Adres IP krótkotrwale wykorzystujemy też do ograniczania liczby zapytań. Cel: bezpieczeństwo i ochrona przed
          nadużyciami. Podstawa: prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO).
        </li>
        <li>
          <strong>Korespondencja:</strong> treść wiadomości wysłanych na {COMPANY.email}. Cel: odpowiedź, obsługa reklamacji
          i odstąpień. Podstawa: wykonanie umowy, obowiązek prawny lub prawnie uzasadniony interes, zależnie od sprawy.
        </li>
      </ul>
      <p>
        Podanie danych jest dobrowolne, ale bez adresu e-mail (albo konta Google) nie można założyć Konta. Nie
        podejmujemy wobec Użytkowników decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, które wywoływałyby
        skutki prawne (art. 22 RODO). Model sztucznej inteligencji ocenia działkę, nie osobę.
      </p>

      <h2>3. Komu przekazujemy dane</h2>
      <p>Korzystamy z dostawców, którzy przetwarzają dane w naszym imieniu na podstawie umów powierzenia:</p>
      <ul>
        <li>
          <strong>Supabase Inc.</strong>: baza danych, logowanie, wysyłka e-maili do logowania (link aktywacyjny,
          reset hasła) oraz przechowywanie map. Serwery bazy stoją w Zurychu w Szwajcarii, a Komisja Europejska uznała
          Szwajcarię za państwo zapewniające odpowiedni stopień ochrony danych.
        </li>
        <li><strong>Netlify, Inc.</strong>: hosting Serwisu.</li>
        <li>
          <strong>Stripe Payments Europe, Ltd.</strong> (Irlandia): obsługa płatności. W zakresie określonym w swojej
          polityce prywatności, np. przy zapobieganiu oszustwom, Stripe działa jako odrębny administrator.
        </li>
        <li>
          <strong>Anthropic</strong>: dostawca modelu sztucznej inteligencji Claude, który przygotowuje rekomendacje
          w Raporcie. Przekazujemy mu wyłącznie dane o działce pochodzące z rejestrów publicznych, takie jak identyfikator,
          położenie i ustalenia planistyczne. Nie przekazujemy adresu e-mail ani innych danych Konta.
        </li>
      </ul>
      <p>
        Przy logowaniu przez Google dane udostępnia nam Google Ireland Limited, który przetwarza je jako odrębny
        administrator na zasadach własnej polityki prywatności. Do rejestrów publicznych (GUGiK, GDOŚ, Rejestr
        Urbanistyczny, KZGW, OpenStreetMap) Serwis wysyła wyłącznie identyfikator i współrzędne działki, bez danych
        Użytkownika.
      </p>
      <p>
        Część dostawców ma siedzibę w USA lub może mieć dostęp do danych spoza Europejskiego Obszaru Gospodarczego.
        Przekazanie następuje wtedy na podstawie decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony
        (w tym dla podmiotów certyfikowanych w ramach EU–US Data Privacy Framework) albo standardowych klauzul umownych.
        Kopię zabezpieczeń można otrzymać, pisząc na {COMPANY.email}.
      </p>
      <DraftNote>
        sprawdzić umowy powierzenia (DPA) i podstawy transferu u każdego dostawcy: Supabase, Netlify, Stripe, Anthropic.
        Ustalić podmiot Anthropic właściwy dla klientów z UE. Ocenić, czy identyfikator działki przekazywany do AI jest
        daną osobową, gdy działka należy do osoby fizycznej.
      </DraftNote>

      <h2>4. Jak długo przechowujemy dane</h2>
      <ul>
        <li>Konto i Raporty: do usunięcia Konta.</li>
        <li>Dane rozliczeniowe i faktury: 5 lat od końca roku kalendarzowego, w którym upłynął termin płatności podatku.</li>
        <li>Zgody i korespondencja dotycząca reklamacji: do upływu terminu przedawnienia roszczeń.</li>
        <li>Logi techniczne: przez krótki okres wynikający z ustawień dostawców hostingu i bazy danych.</li>
      </ul>
      <DraftNote>potwierdzić okresy przechowywania logów w Supabase i Netlify dla wykupionych planów.</DraftNote>

      <h2>5. Twoje prawa</h2>
      <p>
        Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przenoszenia, a także
        prawo sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie. Wniosek wyślij na {mail}.
        Przysługuje Ci też skarga do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).
      </p>

      <h2>6. Pliki cookies</h2>
      <p>
        Serwis używa wyłącznie plików cookies niezbędnych do działania logowania. Nie używamy cookies analitycznych ani
        reklamowych. Strony publiczne (strona główna, cennik, blog) nie zapisują żadnych cookies.
      </p>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-4 border-b border-gray-200 font-medium">Nazwa</th>
              <th className="py-2 pr-4 border-b border-gray-200 font-medium">Cel</th>
              <th className="py-2 border-b border-gray-200 font-medium">Czas</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 align-top">
            <tr>
              <td className="py-2 pr-4 border-b border-gray-100 font-mono text-xs">sb-…-auth-token</td>
              <td className="py-2 pr-4 border-b border-gray-100">Utrzymanie sesji po zalogowaniu (może być podzielone na części .0, .1)</td>
              <td className="py-2 border-b border-gray-100">Do wylogowania, najdłużej 400 dni</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 border-b border-gray-100 font-mono text-xs">sb-…-auth-token-code-verifier</td>
              <td className="py-2 pr-4 border-b border-gray-100">Zabezpieczenie logowania przez Google i linków z e-maili (PKCE)</td>
              <td className="py-2 border-b border-gray-100">Do zakończenia logowania</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Cookies niezbędne do świadczenia usługi, o którą prosi Użytkownik, nie wymagają zgody (art. 399 ustawy
        Prawo komunikacji elektronicznej). Cookies możesz usunąć lub zablokować w ustawieniach przeglądarki, ale wtedy
        logowanie nie będzie działać. Strona płatności Stripe (checkout.stripe.com) używa własnych cookies na zasadach
        polityki Stripe.
      </p>
      <DraftNote>jeśli dojdą cookies analityczne lub marketingowe, potrzebny będzie baner zgody, a ta sekcja wymaga zmiany.</DraftNote>

      <h2>7. Zmiany polityki</h2>
      <p>
        O istotnych zmianach informujemy w Serwisie, a Użytkowników posiadających Konto także e-mailem. Zobacz też{' '}
        <Link href="/regulamin">Regulamin</Link> i <Link href="/kontakt">Kontakt</Link>.
      </p>
    </LegalPage>
  )
}
