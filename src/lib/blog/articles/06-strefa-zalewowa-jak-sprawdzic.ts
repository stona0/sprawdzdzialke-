import { BlogArticle } from '../types';

export const article: BlogArticle = {
  slug: 'strefa-zalewowa-jak-sprawdzic',
  title: 'Strefa zalewowa — jak sprawdzić i co oznacza dla budowy domu?',
  metaTitle: 'Strefa zalewowa — jak sprawdzić? Mapa powodziowa online',
  metaDescription: 'Sprawdź czy Twoja działka leży w strefie zalewowej. Mapy zagrożenia powodziowego online, ograniczenia zabudowy i co robić gdy działka jest zagrożona.',
  excerpt: 'Strefa zalewowa może zablokować budowę domu lub drastycznie podnieść koszty ubezpieczenia. Sprawdź jak zweryfikować zagrożenie powodziowe online.',
  publishedAt: '2025-06-01',
  readingTime: 7,
  keywords: ['strefa zalewowa', 'mapa zagrożenia powodziowego', 'strefa zalewowa jak sprawdzić', 'budowa w strefie zalewowej', 'mapa powodziowa'],
  relatedSlugs: ['na-co-zwrocic-uwage-kupujac-dzialke', 'jak-sprawdzic-mpzp-dzialki', 'jak-sprawdzic-czy-dzialka-jest-budowlana'],
  faq: [
    {
      question: 'Czy mogę budować dom w strefie zalewowej?',
      answer: 'To zależy od typu strefy. Na obszarach bezpośredniego zagrożenia powodzią (Q1%) budowa jest zakazana, chyba że MPZP lub decyzja dyrektora RZGW na to pozwala. Na obszarach zagrożenia Q10% obowiązują ograniczenia (np. zakaz piwnic, podwyższony parter). Zawsze sprawdź konkretne ustalenia w MPZP i skonsultuj z gminą.'
    },
    {
      question: 'Co to jest powódź „stuletnia" (Q1%)?',
      answer: 'Powódź Q1% (stuletnia) to woda o prawdopodobieństwie wystąpienia 1% w danym roku — statystycznie raz na 100 lat. Q10% to powódź „dziesięcioletnia" (10% rocznie), a Q0,2% to „pięćsetletnia". Te scenariusze są podstawą map zagrożenia powodziowego.'
    },
    {
      question: 'Czy strefa zalewowa obniża wartość działki?',
      answer: 'Tak, i to znacząco. Działka w strefie zalewowej Q1% może być warta 30-70% mniej niż porównywalna działka poza strefą. Powodem są ograniczenia zabudowy, wyższe ubezpieczenia i ryzyko zalania. Dlatego zawsze sprawdzaj mapy powodziowe przed zakupem.'
    }
  ],
  content: `
<p>Powodzie w Polsce nie są rzadkością — wydarzenia z 1997 (Wrocław), 2010 (Sandomierz) czy 2024 (Nysa, Kłodzko) pokazały, jak niszczycielska może być woda. Jeśli kupujesz działkę, <strong>sprawdzenie strefy zalewowej to absolutna konieczność</strong>. Budowa w terenie zagrożonym powodzią może być nielegalna, niemożliwa do ubezpieczenia lub po prostu niebezpieczna.</p>

<h2>Czym jest strefa zalewowa?</h2>

<p><strong>Strefa zalewowa</strong> (obszar zagrożenia powodziowego) to teren, który może zostać zalany wodą w przypadku powodzi. Wody Polskie wyznaczają te obszary na podstawie modelowania hydrologicznego dla trzech scenariuszy:</p>

<ul>
<li><strong>Q10% (powódź dziesięcioletnia)</strong> — wysokie prawdopodobieństwo, mniejszy zasięg</li>
<li><strong>Q1% (powódź stuletnia)</strong> — umiarkowane prawdopodobieństwo, większy zasięg. To jest główna strefa regulacyjna</li>
<li><strong>Q0,2% (powódź pięćsetletnia)</strong> — niskie prawdopodobieństwo, maksymalny zasięg</li>
</ul>

<h2>Jak sprawdzić czy działka jest w strefie zalewowej?</h2>

<h3>Sposób 1: Hydroportal — mapy zagrożenia powodziowego</h3>

<p>Najszybszy i najpewniejszy sposób to skorzystanie z oficjalnego <strong>Hydroportalu</strong> prowadzonego przez Wody Polskie:</p>

<ol>
<li>Wejdź na <a href="https://mapy.isok.gov.pl/imap/" rel="noopener">mapy.isok.gov.pl</a></li>
<li>W panelu warstw włącz „Mapy zagrożenia powodziowego" lub „Mapy ryzyka powodziowego"</li>
<li>Znajdź swoją działkę (wyszukaj adres lub przybliż mapę)</li>
<li>Sprawdź czy działka jest w strefie Q10%, Q1% lub Q0,2%</li>
</ol>

<p>Kolory na mapie: <strong>ciemnoniebieski</strong> = Q10% (najczęstsze zalewanie), <strong>niebieski</strong> = Q1%, <strong>jasnoniebieski</strong> = Q0,2%.</p>

<h3>Sposób 2: MPZP</h3>

<p>Jeśli dla Twojej działki obowiązuje plan miejscowy, sprawdź czy nie zawiera oznaczeń stref zalewowych lub ograniczeń wynikających z zagrożenia powodziowego. MPZP musi uwzględniać mapy zagrożenia powodziowego.</p>

<h3>Sposób 3: Automatyczny raport</h3>

<p><strong><a href="https://sprawdzdzialke.com">SprawdzDziałkę.com</a></strong> automatycznie sprawdza zagrożenie powodziowe jako część raportu o działce — razem z MPZP, mediami i strefami ochronnymi.</p>

<h2>Co oznacza strefa zalewowa dla budowy?</h2>

<h3>Obszar bezpośredniego zagrożenia powodzią (Q1%)</h3>

<p>Na tych terenach obowiązuje <strong>zakaz</strong>:</p>
<ul>
<li>Budowy nowych obiektów budowlanych (z wyjątkami w MPZP)</li>
<li>Gromadzenia materiałów utrudniających przepływ wody</li>
<li>Sadzenia drzew i krzewów (z wyjątkami)</li>
<li>Zmiany ukształtowania terenu</li>
</ul>

<p>Wyjątki: dyrektor Regionalnego Zarządu Gospodarki Wodnej może wydać zwolnienie z zakazów, jeśli budowa nie pogorszy sytuacji powodziowej. W praktyce — trudne do uzyskania.</p>

<h3>Obszar zagrożenia Q10%</h3>

<p>Najsurowsze ograniczenia — budowa co do zasady zakazana. Istniejąca zabudowa może być użytkowana, ale rozbudowa jest problematyczna.</p>

<h3>Obszar zagrożenia Q0,2%</h3>

<p>Łagodniejsze ograniczenia — budowa zwykle możliwa, ale z dodatkowymi wymogami (np. podwyższony parter, brak piwnic, odpowiednia izolacja). Ubezpieczenie od powodzi będzie droższe.</p>

<h2>Konsekwencje finansowe budowy w strefie zalewowej</h2>

<ul>
<li><strong>Ubezpieczenie</strong> — składka ubezpieczenia od powodzi może być 3-10x wyższa niż poza strefą, a niektóre towarzystwa w ogóle odmówią ubezpieczenia</li>
<li><strong>Wartość nieruchomości</strong> — działka w Q1% może być warta 30-70% mniej. Dom w strefie zalewowej jest trudniejszy do sprzedaży</li>
<li><strong>Koszty budowy</strong> — podwyższony parter, specjalna izolacja, odporność na wodę = dodatkowe 50 000-150 000 zł</li>
<li><strong>Kredyt hipoteczny</strong> — niektóre banki odmawiają finansowania w strefie Q1%</li>
</ul>

<h2>Co robić jeśli działka jest w strefie zalewowej?</h2>

<ol>
<li><strong>Zastanów się czy warto</strong> — ryzyko i koszty mogą przewyższyć korzyści cenowe</li>
<li><strong>Sprawdź dokładny scenariusz</strong> — Q0,2% to zupełnie inna sytuacja niż Q10%</li>
<li><strong>Skonsultuj z gminą</strong> — co dokładnie mówi MPZP dla tej strefy</li>
<li><strong>Zapytaj o WZ</strong> — czy w konkretnym miejscu budowa jest w ogóle możliwa</li>
<li><strong>Policz koszty</strong> — ubezpieczenie + zabezpieczenia budowlane + potencjalną utratę wartości</li>
</ol>

<h2>Podsumowanie</h2>

<p>Sprawdzenie strefy zalewowej to <strong>5 minut, które mogą uratować setki tysięcy złotych</strong>. Nigdy nie kupuj działki bez sprawdzenia map powodziowych — nawet jeśli teren wygląda sucho, historia i modele hydrologiczne mogą mówić co innego.</p>

<p>Chcesz kompleksowo sprawdzić działkę? <strong><a href="https://sprawdzdzialke.com">Wygeneruj darmowy raport na SprawdzDziałkę.com</a></strong> — analiza obejmuje strefę zalewową, MPZP, Naturę 2000, media i rekomendacje AI.</p>
`
};
