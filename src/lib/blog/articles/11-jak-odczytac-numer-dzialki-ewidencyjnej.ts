import { BlogArticle } from '../types';

export const article: BlogArticle = {
  slug: 'jak-odczytac-numer-dzialki-ewidencyjnej',
  title: 'Jak odczytać numer działki ewidencyjnej? Kompletny przewodnik [2025]',
  metaTitle: 'Jak odczytać numer działki ewidencyjnej? Kompletny przewodnik',
  metaDescription: 'Numer działki ewidencyjnej to klucz do wszystkich informacji o gruncie. Dowiedz się, jak go czytać, gdzie znaleźć i jak sprawdzić pełny raport działki online w 60 sekund.',
  excerpt: 'Numer działki ewidencyjnej to precyzyjny adres gruntowy, dzięki któremu urzędy, sądy i aplikacje potrafią jednoznacznie zidentyfikować każdą parcelę w Polsce. Sprawdź jak go odczytać i co z nim zrobić.',
  publishedAt: '2025-06-15',
  readingTime: 7,
  keywords: ['numer działki ewidencyjnej', 'jak czytać numer działki', 'obręb ewidencyjny', 'identyfikator działki', 'numer ewidencyjny działki'],
  relatedSlugs: ['jak-sprawdzic-mpzp-dzialki', 'jak-sprawdzic-czy-dzialka-jest-budowlana', 'ksiega-wieczysta-dzialki-jak-sprawdzic'],
  faq: [
    {
      question: 'Czy numer działki może się zmienić?',
      answer: 'Tak — przy podziale lub scaleniu działek stary numer jest wycofywany i powstają nowe numery (np. 345/1, 345/2). Dlatego zawsze weryfikuj aktualność danych, szczególnie przy starszych dokumentach.'
    },
    {
      question: 'Co oznacza ukośnik w numerze działki (np. 345/2)?',
      answer: 'Ukośnik wskazuje na podział działki. Pierwotna działka nr 345 została podzielona na co najmniej dwie części — 345/1 i 345/2. Każda z nich to odrębna działka ewidencyjna z własnym statusem prawnym.'
    },
    {
      question: 'Czy numer działki to to samo co numer księgi wieczystej?',
      answer: 'Nie. Numer KW (księgi wieczystej) to oddzielny identyfikator prowadzony przez sądy wieczysto-księgowe. Jedna KW może obejmować kilka działek ewidencyjnych i odwrotnie — działka może nie mieć założonej KW.'
    },
    {
      question: 'Jak sprawdzić numer obrębu, mając tylko adres?',
      answer: 'Wejdź na geoportal.gov.pl i wyszukaj adres w wyszukiwarce. Po kliknięciu działki na mapie wyświetlą się dane ewidencyjne, w tym numer obrębu i numer działki.'
    }
  ],
  content: `
<p>Kupujesz działkę, przeglądasz ogłoszenie na OLX albo Otodom i widzisz w opisie coś w stylu: <em>„działka nr 345/2, obręb 0001 Długołęka"</em>. Albo w umowie przedwstępnej pojawia się tajemniczy ciąg cyfr: <strong>141204_2.0001.345/2</strong>. Co to właściwie oznacza? I dlaczego to ważne?</p>

<p>Numer działki ewidencyjnej to nie przypadkowe liczby — to precyzyjny adres gruntowy, dzięki któremu urzędy, sądy i aplikacje takie jak <strong>SprawdzDziałkę.com</strong> potrafią jednoznacznie zidentyfikować każdą parcelę w Polsce. Bez niego nie sprawdzisz MPZP, nie złożysz wniosku o warunki zabudowy ani nie wygenerujesz raportu AI o nieruchomości.</p>

<p>W tym artykule wyjaśniamy krok po kroku, jak ten numer czytać, gdzie go znaleźć i co zrobić, gdy masz już gotowe dane.</p>

<h2>Czym jest numer działki ewidencyjnej?</h2>

<p>Ewidencja gruntów i budynków (EGB), dawniej zwana katastrem, to ogólnopolski rejestr prowadzony przez starostów powiatowych. Każda działka gruntowa ma w nim swój <strong>unikalny identyfikator</strong>, składający się z kilku segmentów.</p>

<p>Numer działki sam w sobie — np. <strong>345/2</strong> — jest unikalny tylko w obrębie danego obrębu ewidencyjnego. Dwa powiaty mogą mieć działkę nr 345/2, ale połączone z nazwą obrębu i gminy wskazują zawsze na jedną, konkretną parcelę w Polsce.</p>

<h2>Jak zbudowany jest pełny identyfikator działki?</h2>

<p>Pełny identyfikator działki ma format:</p>

<p><code>WW PP GG_R.OOOO.NNN/X</code></p>

<p>Rozbijmy to na czynniki pierwsze:</p>

<h3>WW — kod województwa (2 cyfry)</h3>

<p>Każde z 16 województw ma przypisany kod. Na przykład:</p>

<ul>
<li><strong>02</strong> — dolnośląskie</li>
<li><strong>12</strong> — małopolskie</li>
<li><strong>14</strong> — mazowieckie</li>
<li><strong>22</strong> — pomorskie</li>
</ul>

<h3>PP — kod powiatu (2 cyfry)</h3>

<p>W obrębie województwa każdy powiat ma swój kolejny numer. Powiaty miejskie (grodzkie) i ziemskie numerowane są oddzielnie.</p>

<h3>GG_R — kod gminy i rodzaj (3 znaki)</h3>

<p>Gminy numerowane są alfabetycznie w powiatach (01, 02, 03…). Cyfra po podkreślniku oznacza rodzaj gminy:</p>

<ul>
<li><strong>_1</strong> — gmina miejska</li>
<li><strong>_2</strong> — gmina wiejska</li>
<li><strong>_3</strong> — gmina miejsko-wiejska (część miejska)</li>
<li><strong>_4</strong> — gmina miejsko-wiejska (część wiejska)</li>
<li><strong>_5</strong> — miasto w gminie miejsko-wiejskiej</li>
<li><strong>_8</strong> — dzielnica m.st. Warszawy</li>
<li><strong>_9</strong> — delegatura</li>
</ul>

<p>Przykład: <code>0004_2</code> oznacza czwartą gminę wiejską w danym powiecie.</p>

<h3>OOOO — numer obrębu ewidencyjnego (4 cyfry)</h3>

<p>To kluczowy element. Gminy dzielą się na <strong>obręby ewidencyjne</strong> — historyczne jednostki, zazwyczaj pokrywające się z granicami wsi lub dzielnic miast. Obręb ma swój czterocyfrowy numer (np. <strong>0001</strong>, <strong>0015</strong>) i często też nazwę własną (np. <em>„Długołęka"</em>, <em>„Psie Pole"</em>).</p>

<h3>NNN/X — numer działki (liczba naturalna, opcjonalnie z podciągiem)</h3>

<p>To najbardziej rozpoznawalna część. Numer podstawowy (np. <strong>345</strong>) jest nadawany przy pierwszym wpisaniu działki do rejestru. Gdy działka zostaje podzielona, powstają podciągi: <strong>345/1</strong>, <strong>345/2</strong>, <strong>345/3</strong>. Scalenie lub ponowny podział może tworzyć kolejne numery — <strong>346</strong>, <strong>347</strong> itd.</p>

<p><strong>Ważne:</strong> numer działki nigdy się nie powtarza w obrębie ewidencyjnym, nawet po wykreśleniu działki z rejestru. Zlikwidowana działka nie oddaje swojego numeru następnej.</p>

<h2>Przykład z życia: jak odczytać 141204_2.0001.345/2?</h2>

<p>Weźmy konkretny identyfikator i go rozszyfrujmy:</p>

<table>
<thead>
<tr><th>Segment</th><th>Wartość</th><th>Znaczenie</th></tr>
</thead>
<tbody>
<tr><td>WW</td><td>14</td><td>Województwo mazowieckie</td></tr>
<tr><td>PP</td><td>12</td><td>Powiat piaseczyński</td></tr>
<tr><td>GG_R</td><td>04_2</td><td>Czwarta gmina wiejska w powiecie</td></tr>
<tr><td>OOOO</td><td>0001</td><td>Obręb nr 1 (np. wieś Antoninów)</td></tr>
<tr><td>NNN/X</td><td>345/2</td><td>Działka nr 345, podciąg 2 (po podziale)</td></tr>
</tbody>
</table>

<p>Mamy więc działkę po podziale, leżącą w pierwszym obrębie czwartej gminy wiejskiej powiatu piaseczyńskiego na Mazowszu. Brzmi skomplikowanie? W praktyce wystarczy wkleić cały identyfikator do wyszukiwarki na <strong>SprawdzDziałkę.com</strong> — aplikacja sama rozpoznaje format i pobiera wszystkie dane z rejestrów.</p>

<h2>Gdzie znaleźć numer działki ewidencyjnej?</h2>

<p>Masz kilka opcji, zależnie od sytuacji:</p>

<h3>1. Odpis z księgi wieczystej</h3>

<p>Jeśli działka ma założoną księgę wieczystą (KW), numer działki znajdziesz w <strong>dziale I-O</strong> (Oznaczenie nieruchomości). Możesz sprawdzić KW bezpłatnie na stronie <a href="https://ekw.ms.gov.pl" rel="noopener">ekw.ms.gov.pl</a> — potrzebujesz numeru KW, który sprzedający powinien Ci udostępnić.</p>

<h3>2. Geoportal.gov.pl</h3>

<p>Wejdź na <a href="https://geoportal.gov.pl" rel="noopener">geoportal.gov.pl</a>, włącz warstwę działek ewidencyjnych i kliknij interesującą Cię parcelę. Pojawi się numer obrębu i numer działki. Identyfikator można też odczytać z adresu URL po wyszukaniu lokalizacji.</p>

<h3>3. Ogłoszenie nieruchomości</h3>

<p>Rzetelni sprzedający podają numer działki w opisie ogłoszenia. Jeśli go nie ma — poproś o dane przed oględzinami. To Twoje prawo jako potencjalnego kupującego.</p>

<h3>4. Umowa przedwstępna lub akt notarialny</h3>

<p>Każda umowa dotycząca gruntu zawiera pełny identyfikator działki w sekcji opisu przedmiotu umowy.</p>

<h3>5. Wypis z ewidencji gruntów i budynków</h3>

<p>Możesz złożyć wniosek do starostwa powiatowego (osobiście, pocztą lub przez ePUAP) o <strong>wypis z rejestru gruntów</strong> dla konkretnej działki. Koszt to zazwyczaj 30–50 zł, czas realizacji 7–14 dni roboczych.</p>

<p><strong>Pro tip:</strong> Zanim zapłacisz za wypis w starostwie, sprawdź czy gmina nie ma działki w portalu e-usług. Część starostw umożliwia pobranie uproszczonego wypisu online za darmo lub w niższej cenie.</p>

<h2>Co zrobić, gdy masz już numer działki?</h2>

<p>Mając numer działki, możesz sprawdzić praktycznie wszystko, co jest istotne przy zakupie gruntu:</p>

<ul>
<li><strong>Status MPZP</strong> — czy dla działki obowiązuje miejscowy plan zagospodarowania przestrzennego i co na niej można budować</li>
<li><strong>Klasa gruntu</strong> — czy to grunt rolny (i czy wymaga odrolnienia), czy już budowlany</li>
<li><strong>Ochrona przyrody</strong> — Natura 2000, parki krajobrazowe, strefy buforowe</li>
<li><strong>Ryzyko zalewowe</strong> — czy działka leży w strefie zagrożenia powodziowego</li>
<li><strong>Media</strong> — dostęp do sieci gazowej, elektrycznej, kanalizacji</li>
<li><strong>Dostęp do drogi</strong> — czy działka ma bezpośredni dostęp do drogi publicznej</li>
</ul>

<p>Tradycyjnie zebranie tych danych zajmuje kilka dni i wymaga wizyt w kilku urzędach. Dzisiaj możesz to zrobić w 60 sekund.</p>

<h2>Sprawdź działkę online w minutę</h2>

<p><a href="https://sprawdzdzialke.com"><strong>SprawdzDziałkę.com</strong></a> to narzędzie, które automatycznie pobiera dane z publicznych rejestrów (GUGiK, GDOŚ, ISOK, MPZP) i generuje pełny raport AI dla dowolnej działki w Polsce.</p>

<p>Wystarczy wpisać numer działki wraz z obrębem — aplikacja sama rozpoznaje format, pobiera dane i w mniej niż minutę dostarcza raport z:</p>

<ul>
<li>Wypis ewidencyjny z danymi o powierzchni, klasie gruntu i właścicielu</li>
<li>Analizą MPZP lub informacją o braku planu</li>
<li>Mapą ryzyka zalewowego</li>
<li>Oceną dostępu do mediów</li>
<li>Rekomendacjami AI: co sprawdzić dalej, na co uważać</li>
</ul>

<p><strong>Pierwszy raport jest bezpłatny.</strong> Przekonaj się, ile informacji kryje numer Twojej działki.</p>

<p>👉 <a href="https://sprawdzdzialke.com"><strong>Sprawdź swoją działkę za darmo →</strong></a></p>
`,
};
