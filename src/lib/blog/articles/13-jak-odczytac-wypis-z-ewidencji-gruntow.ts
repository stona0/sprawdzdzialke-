import { BlogArticle } from '../types';

export const article: BlogArticle = {
  slug: 'jak-odczytac-wypis-z-ewidencji-gruntow',
  title: 'Jak odczytać wypis z ewidencji gruntów? Skróty i oznaczenia [2025]',
  metaTitle: 'Jak odczytać wypis z ewidencji gruntów? Skróty i oznaczenia [2025]',
  metaDescription: 'Nie wiesz, co oznacza RIVb, Lz czy Ps w wypisie z ewidencji gruntów? Tłumaczymy każdą sekcję dokumentu, wszystkie skróty użytków i klas bonitacyjnych oraz jak sprawdzić wypis online bez wizyty w starostwie.',
  excerpt: 'Artykuł evergreen na frazę o dużym wolumenie — każdy kupujący działkę rolną lub siedliskową staje przed wypisem pełnym skrótów, których nie rozumie. Przewodnik tłumaczy krok po kroku: jak zamówić wypis, co oznacza każda sekcja i dlaczego klasa bonitacyjna RIV vs RIII może zadecydować o możliwości budowy domu.',
  publishedAt: '2025-07-15',
  readingTime: 8,
  keywords: ['wypis z ewidencji gruntów', 'jak odczytać wypis z ewidencji', 'skróty ewidencja gruntów', 'klasa bonitacyjna', 'użytek gruntowy'],
  relatedSlugs: ['jak-odczytac-numer-dzialki-ewidencyjnej', 'dzialka-rolna-vs-budowlana', 'jak-sprawdzic-czy-dzialka-jest-budowlana'],
  faq: [
    {
      question: 'Czy wypis z ewidencji gruntów jest tym samym co odpis z księgi wieczystej?',
      answer: 'Nie. Wypis pochodzi z ewidencji gruntów prowadzonej przez starostwo i zawiera dane techniczne działki (użytek, klasę, powierzchnię). Księga wieczysta prowadzona jest przez sąd i zawiera dane prawne (właściciel, hipoteki, służebności). Oba dokumenty są niezbędne przy zakupie.'
    },
    {
      question: 'Ile kosztuje wypis z ewidencji gruntów?',
      answer: 'Wypis uproszczony (bez mapy): 17 zł. Wypis pełny z wyrównem gruntu: 17–50 zł, w zależności od powiatu i ilości działek.'
    },
    {
      question: 'Jak długo ważny jest wypis z ewidencji?',
      answer: 'Formalnie nie ma daty ważności, ale banki i notariusze zazwyczaj wymagają dokumentu nie starszego niż 3 miesiące.'
    },
    {
      question: 'Co to jest skrót „Br" w ewidencji gruntów?',
      answer: 'Br oznacza grunty rolne zabudowane — czyli siedliska wiejskie. Mogą na nich stać budynki gospodarcze lub mieszkalne związane z działalnością rolniczą, bez konieczności odrolnienia.'
    },
    {
      question: 'Czy RIII można odrolnić?',
      answer: 'Można, ale jest to trudne i kosztowne — wymaga zgody Ministra Rolnictwa i wniesienia opłat za wyłączenie z produkcji rolnej. Procedura może trwać rok i więcej.'
    }
  ],
  content: `
<p>Dostałeś wypis z ewidencji gruntów i budynków ze starostwa. Na kilku stronach A4 widnieją tajemnicze skróty: RIVb, Lz, Ps, dr, Br-RV — i zero wyjaśnień. Urzędnik powiedział tylko: "proszę, to pełen wypis". Co teraz?</p>

<p>Wypis z ewidencji gruntów to jeden z kluczowych dokumentów przy kupnie działki — a jednocześnie jeden z najmniej zrozumiałych. W tym artykule tłumaczymy go od A do Z: jak zamówić, jak czytać sekcja po sekcji i co każdy skrót naprawdę oznacza.</p>

<h2>Co to jest wypis z ewidencji gruntów i budynków?</h2>

<p>Ewidencja gruntów i budynków (EGiB) to oficjalny, państwowy rejestr prowadzony przez starostów i prezydentów miast na prawach powiatu. Zawiera dane o każdej działce w Polsce: jej numer, powierzchnię, właściciela, użytek gruntowy i klasę bonitacyjną.</p>

<p>Wypis to <strong>urzędowy wydruk</strong> tych danych dotyczący konkretnej działki lub zbioru działek. Dokument jest wymagany m.in. przy:</p>
<ul>
<li>zakupie lub sprzedaży nieruchomości,</li>
<li>składaniu wniosku o pozwolenie na budowę,</li>
<li>wniosku o kredyt hipoteczny,</li>
<li>procedurze odrolnienia działki,</li>
<li>zakładaniu lub zmianie księgi wieczystej.</li>
</ul>

<p>Ściśle rzecz biorąc, najczęściej spotykasz się z <strong>wypisem z rejestru gruntów</strong> (bez budynków). Wypis z rejestru budynków i lokali dotyczy obiektów już istniejących.</p>

<h2>Jak zamówić wypis z ewidencji gruntów?</h2>

<p>Wypis możesz zamówić na trzy sposoby:</p>

<h3>1. Osobiście w starostwie (wydziale geodezji)</h3>

<p>Najszybciej — często od ręki. Potrzebujesz: numeru działki i obrębu, dowodu osobistego. Koszt: 17 zł za działkę (wypis uproszczony) lub 17–50 zł za pełny wypis.</p>

<h3>2. Przez internet — portal GEODEZJA ONLINE lub geoportal powiatu</h3>

<p>Wiele powiatów udostępnia możliwość zamówienia wypisu przez ePUAP lub własny portal. Płatność online, dokument dostarcza się elektronicznie z podpisem kwalifikowanym.</p>

<h3>3. Pocztą</h3>

<p>Wniosek pisemny + opłata przelewem. Czas oczekiwania: 3–14 dni roboczych.</p>

<p>ℹ️ <strong>Uwaga:</strong> Wypis z ewidencji to nie to samo co odpis z księgi wieczystej — to dwa oddzielne dokumenty z różnych rejestrów. KW znajdziesz bezpłatnie na ekw.ms.gov.pl.</p>

<h2>Jak czytać wypis z ewidencji? Sekcja po sekcji</h2>

<p>Typowy wypis z rejestru gruntów zawiera następujące pola:</p>

<h3>Pole 1 — Identyfikator działki</h3>

<p>Format: <code>województwo.powiat.gmina.obręb.numer działki</code>, np. <code>141201_1.0004.56/3</code>. To unikalny identyfikator każdej działki w Polsce — ten sam numer, który wpisujesz w <a href="https://sprawdzdzialke.com"><strong>SprawdzDziałkę.com</strong></a>.</p>

<h3>Pole 2 — Powierzchnia ewidencyjna</h3>

<p>Powierzchnia działki w metrach kwadratowych lub hektarach (1 ha = 10 000 m²). Może się różnić od powierzchni widocznej na mapie — ewidencja jest prawnie wiążąca.</p>

<h3>Pole 3 — Użytek gruntowy i klasa bonitacyjna</h3>

<p>To najważniejsza część dokumentu dla kupujących. Format to skrót użytku + klasa, np. <code>RIVb</code>, <code>Ps III</code>, <code>Lz</code>. Wyjaśniamy dokładnie poniżej.</p>

<h3>Pole 4 — Właściciel / władający</h3>

<p>Dane właściciela (imię, nazwisko lub nazwa firmy) oraz numer księgi wieczystej. Zawsze weryfikuj, czy dane w wypisie zgadzają się z KW.</p>

<h3>Pole 5 — Data ostatniej aktualizacji</h3>

<p>Wypisy są ważne zazwyczaj 3 lub 6 miesięcy od daty wystawienia. Bank lub notariusz może wymagać dokumentu nie starszego niż 3 miesiące.</p>

<h2>Co oznaczają skróty użytków gruntowych?</h2>

<p>Skróty użytków gruntowych to system klasyfikacji terenu. Dzielą się na dwie grupy: <strong>grunty rolne</strong> i <strong>grunty nierolne</strong>.</p>

<h3>Grunty orne — R (najczęściej z klasą bonitacyjną)</h3>

<table>
<thead><tr><th>Skrót</th><th>Opis</th><th>Przykład</th></tr></thead>
<tbody>
<tr><td>R</td><td>Grunty orne</td><td>RIIIa, RIVb, RV</td></tr>
<tr><td>S</td><td>Sady</td><td>SIII, SIV</td></tr>
<tr><td>Ps</td><td>Łąki trwałe i pastwiska trwałe</td><td>Ps III, Ps IV</td></tr>
</tbody>
</table>

<h3>Grunty leśne i zadrzewione</h3>

<table>
<thead><tr><th>Skrót</th><th>Opis</th></tr></thead>
<tbody>
<tr><td>Ls</td><td>Las</td></tr>
<tr><td>Lz</td><td>Grunty zadrzewione i zakrzewione</td></tr>
</tbody>
</table>

<h3>Grunty zabudowane i zurbanizowane</h3>

<table>
<thead><tr><th>Skrót</th><th>Opis</th></tr></thead>
<tbody>
<tr><td>B</td><td>Tereny mieszkaniowe</td></tr>
<tr><td>Ba</td><td>Tereny przemysłowe</td></tr>
<tr><td>Bi</td><td>Inne tereny zabudowane</td></tr>
<tr><td>Bp</td><td>Zurbanizowane tereny niezabudowane</td></tr>
<tr><td>Br</td><td>Grunty rolne zabudowane (np. siedlisko)</td></tr>
<tr><td>K</td><td>Tereny komunikacyjne (drogi)</td></tr>
<tr><td>dr</td><td>Drogi publiczne</td></tr>
</tbody>
</table>

<h3>Wody i nieużytki</h3>

<table>
<thead><tr><th>Skrót</th><th>Opis</th></tr></thead>
<tbody>
<tr><td>W</td><td>Rowy</td></tr>
<tr><td>Wp</td><td>Płynne wody powierzchniowe</td></tr>
<tr><td>Ws</td><td>Wody stojące</td></tr>
<tr><td>N</td><td>Nieużytki</td></tr>
</tbody>
</table>

<p>ℹ️ <strong>Dlaczego to ważne:</strong> Jeśli działka ma użytek <code>R</code>, <code>Ps</code>, <code>Lz</code> lub <code>Ls</code>, jest klasyfikowana jako <strong>grunt rolny lub leśny</strong>. Przed budową domu możesz potrzebować decyzji o <strong>wyłączeniu gruntów z produkcji rolnej lub leśnej</strong> (tzw. odrolnienie), co kosztuje i trwa.</p>

<p>Natomiast <code>B</code>, <code>Ba</code>, <code>Bi</code>, <code>Bp</code> oznaczają tereny już zurbanizowane — tu tego problemu nie ma.</p>

<h2>Jak rozumieć klasę bonitacyjną? RI, RII, RIII, RIV, RV, RVI</h2>

<p>Klasa bonitacyjna określa <strong>jakość i urodzajność gleby</strong> — od najlepszej (I) do najgorszej (VI). Litera po cyfrze (a/b) oznacza podklasę.</p>

<table>
<thead><tr><th>Klasa</th><th>Jakość gleby</th><th>Znaczenie dla budowy</th></tr></thead>
<tbody>
<tr><td>RI</td><td>Najlepsza</td><td>Trudna do odrolnienia (wysoki koszt)</td></tr>
<tr><td>RII</td><td>Bardzo dobra</td><td>Trudna do odrolnienia</td></tr>
<tr><td>RIIIa</td><td>Dobra</td><td>Odrolnienie możliwe, ale kosztowne</td></tr>
<tr><td>RIIIb</td><td>Dobra średnio</td><td>Odrolnienie możliwe</td></tr>
<tr><td>RIVa</td><td>Średnio dobra</td><td>Łatwiejsze odrolnienie</td></tr>
<tr><td>RIVb</td><td>Średnio dobra (słabsza)</td><td>Jedne z najłatwiejszych do odrolnienia</td></tr>
<tr><td>RV</td><td>Słaba</td><td>Tanio i łatwo odrolnić</td></tr>
<tr><td>RVI</td><td>Najgorsza</td><td>Najtaniej i najszybciej</td></tr>
</tbody>
</table>

<h3>Kluczowa granica: klasa III vs IV</h3>

<p>Grunty klas I–III są objęte <strong>szczególną ochroną</strong> wynikającą z ustawy o ochronie gruntów rolnych. Ich odrolnienie (wyłączenie z produkcji) wymaga zgody <strong>Ministra Rolnictwa</strong> — jest to długa i kosztowna procedura, często ograniczająca możliwość budowy domu.</p>

<p>Grunty klas IV–VI są pod ochroną słabszą — decyzję o odrolnieniu wydaje starosta lub jest ono zbędne dla małych działek (do 0,5 ha na cele inne niż cele rolne). To praktyczna różnica milionów złotych i lat procedur.</p>

<h2>Skrót złożony — co oznacza Br-RV lub Lz-RIIIb?</h2>

<p>Czasem w wypisie pojawia się skrót dwuczęściowy, np. <code>Br-RV</code> lub <code>Lz-RIIIb</code>. Oznacza to grunty <strong>mieszane</strong>:</p>
<ul>
<li><code>Br-RV</code> — grunt rolny zabudowany (siedlisko), ale o glebie klasy V,</li>
<li><code>Lz-RIIIb</code> — grunt zadrzewiony na glebie dobrej klasy IIIb (może mieć wyższą opłatę za odrolnienie),</li>
<li><code>W-RV</code> — rów melioracyjny na gruncie klasy V.</li>
</ul>

<p>Druga część (po myślniku) zawsze określa klasę gleby pod spodem — ważną dla celów podatkowych i odrolnienia.</p>

<h2>Co zrobić, jeśli w wypisie są błędy?</h2>

<p>Ewidencja gruntów nie zawsze jest aktualna. Zdarzają się sytuacje, gdy:</p>
<ul>
<li>użytek w rejestrze (np. <code>R</code>) nie zgadza się z rzeczywistym stanem działki (np. działka jest od lat zabudowana),</li>
<li>powierzchnia w wypisie różni się od granicy z mapy,</li>
<li>wpisany właściciel różni się od danych w księdze wieczystej.</li>
</ul>

<p><strong>Co robić?</strong></p>
<ol>
<li>Złóż <strong>wniosek o zmianę w operacie ewidencyjnym</strong> do starostwa — powinien być załączony operat geodezyjny od uprawnionego geodety.</li>
<li>Jeśli błąd dotyczy właściciela — popraw jednocześnie księgę wieczystą (wniosek do sądu wieczystoksięgowego).</li>
<li>Czas sprostowania: od kilku tygodni do kilku miesięcy.</li>
</ol>

<p>⚠️ Nie kupuj działki z widoczną rozbieżnością między wypisem a KW lub stanem faktycznym — przed podpisaniem umowy poproś sprzedającego o sprostowanie.</p>

<h2>Sprawdź klasę bonitacyjną i użytek bez wizyty w starostwie</h2>

<p>Wiedza o użytku gruntowym i klasie bonitacyjnej działki jest dostępna online, w kilkanaście sekund.</p>

<p>Serwis <a href="https://sprawdzdzialke.com"><strong>SprawdzDziałkę.com</strong></a> automatycznie pobiera dane ewidencyjne dla dowolnej działki w Polsce. Wystarczy podać numer ewidencyjny (ten sam, który znasz z ogłoszenia lub z GEOPORTAL-u), a w raporcie znajdziesz:</p>
<ul>
<li>użytek gruntowy i klasę bonitacyjną każdej części działki,</li>
<li>czy działka wymaga odrolnienia przed budową,</li>
<li>status MPZP i warunki zagospodarowania,</li>
<li>strefę zalania, obszary Natura 2000, dostępność mediów,</li>
<li>rekomendacje AI o potencjale budowlanym.</li>
</ul>

<p>To szybki sposób, żeby wiedzieć, <strong>co kupujesz</strong>, jeszcze zanim udasz się do urzędu po oficjalny wypis.</p>

<p>👉 <a href="https://sprawdzdzialke.com"><strong>Sprawdź swoją działkę za darmo →</strong></a></p>
`,
};
