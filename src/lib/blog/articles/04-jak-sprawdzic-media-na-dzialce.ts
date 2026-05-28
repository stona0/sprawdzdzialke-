import { BlogArticle } from '../types';

export const article: BlogArticle = {
  slug: 'jak-sprawdzic-media-na-dzialce',
  title: 'Jak sprawdzić media na działce? Woda, prąd, gaz, kanalizacja — poradnik',
  metaTitle: 'Jak sprawdzić media na działce? Woda, prąd, gaz, kanalizacja',
  metaDescription: 'Sprawdź dostępność mediów na działce — woda, prąd, gaz, kanalizacja. Gdzie szukać informacji, ile kosztują przyłącza i na co uważać.',
  excerpt: 'Dostępność mediów to jeden z kluczowych czynników przy zakupie działki. Sprawdź jak zweryfikować dostęp do wody, prądu, gazu i kanalizacji.',
  publishedAt: '2025-06-01',
  readingTime: 8,
  keywords: ['media na działce', 'jak sprawdzić media', 'przyłącze wody', 'przyłącze prądu', 'uzbrojenie działki', 'kanalizacja na działce'],
  relatedSlugs: ['na-co-zwrocic-uwage-kupujac-dzialke', 'jak-sprawdzic-czy-dzialka-jest-budowlana', 'jak-sprawdzic-mpzp-dzialki'],
  faq: [
    {
      question: 'Ile kosztuje doprowadzenie mediów do działki?',
      answer: 'Koszty zależą od odległości do sieci. Orientacyjnie: przyłącze wodociągowe 3 000-10 000 zł, kanalizacyjne 5 000-15 000 zł, elektryczne 2 000-8 000 zł (+ opłata za przyłączenie), gazowe 3 000-12 000 zł. Przy dużych odległościach koszty mogą być znacznie wyższe.'
    },
    {
      question: 'Co jeśli nie ma kanalizacji w okolicy?',
      answer: 'Masz dwie opcje: szambo bezodpływowe (koszt 5 000-10 000 zł, ale wymaga regularnego wywozu) lub przydomowa oczyszczalnia ścieków (15 000-30 000 zł, ale tańsza w eksploatacji). Oczyszczalnia wymaga odpowiednich warunków gruntowych.'
    },
    {
      question: 'Jak długo trwa uzyskanie warunków przyłączenia?',
      answer: 'Standardowo 14-30 dni od złożenia wniosku. W praktyce może to trwać dłużej w zależności od operatora i regionu. Warunki przyłączenia są ważne zwykle 2 lata.'
    },
    {
      question: 'Czy mapa zasadnicza pokazuje media?',
      answer: 'Tak. Mapa zasadnicza (dostępna w starostwie powiatowym) pokazuje przebieg sieci uzbrojenia terenu — wodociągowej, kanalizacyjnej, elektrycznej, gazowej i telekomunikacyjnej. To najlepsze źródło informacji o mediach w okolicy działki.'
    }
  ],
  content: `
<p>Piękna działka w atrakcyjnej lokalizacji, dobra cena — ale <strong>czy są media?</strong> Dostępność wody, prądu, gazu i kanalizacji to jeden z najważniejszych (i najczęściej pomijanych) aspektów przy zakupie działki. Brak mediów w pobliżu może oznaczać dodatkowe koszty rzędu <strong>kilkudziesięciu tysięcy złotych</strong>.</p>

<h2>Dlaczego sprawdzenie mediów jest tak ważne?</h2>

<p>Media to nie tylko komfort — to warunek konieczny do uzyskania pozwolenia na budowę. Zgodnie z prawem budowlanym, budynek mieszkalny musi mieć zapewnione:</p>

<ul>
<li>Zaopatrzenie w wodę</li>
<li>Odprowadzanie ścieków</li>
<li>Zasilanie w energię elektryczną</li>
<li>Ogrzewanie (gaz, prąd, pompa ciepła lub inne źródło)</li>
</ul>

<p>Brak sieci w pobliżu nie wyklucza budowy — ale oznacza alternatywne (i droższe) rozwiązania: studnię głębinową, szambo, przydomową oczyszczalnię, agregat prądotwórczy.</p>

<h2>Woda — jak sprawdzić dostępność</h2>

<h3>Gdzie szukać informacji</h3>
<ul>
<li><strong>Przedsiębiorstwo wodno-kanalizacyjne</strong> — złóż wniosek o wydanie warunków technicznych przyłączenia do sieci wodociągowej. To bezpłatne i daje pewną informację</li>
<li><strong>Mapa zasadnicza</strong> — dostępna w starostwie powiatowym, pokazuje przebieg sieci wodociągowej</li>
<li><strong>MPZP</strong> — część planów zawiera informację o planowanych sieciach</li>
<li><strong>Sąsiedzi</strong> — zapytaj skąd mają wodę (sieć miejska, studnia)</li>
</ul>

<h3>Koszty przyłącza wodociągowego</h3>
<p>Koszt przyłącza zależy od odległości do sieci i warunków terenowych:</p>
<ul>
<li><strong>Do 50 m od sieci</strong> — 3 000-5 000 zł</li>
<li><strong>50-200 m</strong> — 5 000-15 000 zł</li>
<li><strong>Brak sieci</strong> — studnia głębinowa: 8 000-25 000 zł (zależnie od głębokości)</li>
</ul>

<h3>Alternatywa: studnia głębinowa</h3>
<p>Jeśli sieci wodociągowej nie ma i nie jest planowana, rozważ studnię. Wymaga badania hydrogeologicznego i zgłoszenia (do 30 m głębokości) lub pozwolenia wodnoprawnego (powyżej 30 m). Koszt wiercenia: ok. 150-300 zł/metr głębokości.</p>

<h2>Kanalizacja — sieć, szambo czy oczyszczalnia?</h2>

<h3>Sprawdzenie dostępności</h3>
<ul>
<li><strong>Przedsiębiorstwo wodno-kanalizacyjne</strong> — warunki przyłączenia</li>
<li><strong>Mapa zasadnicza</strong> — przebieg sieci kanalizacyjnej</li>
<li><strong>MPZP</strong> — czy plan przewiduje budowę kanalizacji</li>
</ul>

<h3>Opcje gdy nie ma sieci kanalizacyjnej</h3>

<p><strong>Szambo bezodpływowe:</strong></p>
<ul>
<li>Koszt instalacji: 5 000-10 000 zł</li>
<li>Koszt eksploatacji: 200-500 zł/miesiąc (wywóz)</li>
<li>Wymaga regularnego opróżniania (co 2-4 tygodnie dla 4-osobowej rodziny)</li>
</ul>

<p><strong>Przydomowa oczyszczalnia ścieków:</strong></p>
<ul>
<li>Koszt instalacji: 15 000-30 000 zł</li>
<li>Koszt eksploatacji: 50-100 zł/miesiąc</li>
<li>Wymaga odpowiednich warunków gruntowych (nie na gruncie gliniastym)</li>
<li>Wymaga zgłoszenia lub pozwolenia wodnoprawnego</li>
</ul>

<h2>Prąd — energia elektryczna</h2>

<h3>Jak sprawdzić</h3>
<ul>
<li><strong>Operator sieci dystrybucyjnej</strong> (Tauron, PGE, Enea, Energa, innogy) — wniosek o warunki przyłączenia</li>
<li><strong>Mapa zasadnicza</strong> — linie energetyczne</li>
<li><strong>Wizja lokalna</strong> — czy w okolicy stoją słupy energetyczne, gdzie jest najbliższy transformator</li>
</ul>

<h3>Koszty przyłącza elektrycznego</h3>
<ul>
<li><strong>Opłata za przyłączenie</strong> — 7,87 zł za każdy kW mocy przyłączeniowej powyżej progu (dla gospodarstw domowych). Standardowe przyłącze 15-20 kW: ok. 2 000-3 000 zł</li>
<li><strong>Budowa linii</strong> — jeśli potrzebna nowa linia, operator pokrywa koszty do określonej odległości. Powyżej — współfinansowanie</li>
<li><strong>Brak sieci w zasięgu</strong> — rozważ instalację fotowoltaiczną z magazynem energii (30 000-60 000 zł) jako uzupełnienie lub tymczasowe rozwiązanie</li>
</ul>

<h2>Gaz — sieć gazowa</h2>

<h3>Sprawdzenie dostępności</h3>
<ul>
<li><strong>Polska Spółka Gazownictwa</strong> — wniosek o warunki przyłączenia</li>
<li><strong>Mapa zasadnicza</strong> — przebieg gazociągów</li>
<li><strong>Portal PSG</strong> — <a href="https://www.psgaz.pl" rel="noopener">psgaz.pl</a></li>
</ul>

<h3>Koszty i alternatywy</h3>
<ul>
<li><strong>Przyłącze gazowe</strong> — 3 000-12 000 zł (zależy od odległości)</li>
<li><strong>Brak gazu</strong> — alternatywy: pompa ciepła (35 000-60 000 zł), kocioł na pellet (15 000-25 000 zł), ogrzewanie elektryczne (niski koszt instalacji, wysoki eksploatacji)</li>
</ul>

<p><strong>Trend 2025:</strong> Coraz więcej nowych domów rezygnuje z gazu na rzecz pomp ciepła + fotowoltaiki. Brak gazu nie jest już dużą wadą — ale warto wiedzieć o dostępności.</p>

<h2>Internet i telekomunikacja</h2>

<p>W dobie pracy zdalnej dostęp do szybkiego internetu to nie luksus — to konieczność. Sprawdź:</p>
<ul>
<li><strong>Światłowód</strong> — portale operatorów (Orange, Play, Netia) lub <a href="https://internet.gov.pl" rel="noopener">internet.gov.pl</a></li>
<li><strong>5G/LTE</strong> — sprawdź zasięg na mapach operatorów komórkowych</li>
<li><strong>Internet satelitarny</strong> (Starlink) — opcja awaryjna dla trudno dostępnych lokalizacji</li>
</ul>

<h2>Gdzie znaleźć wszystko w jednym miejscu?</h2>

<p>Sprawdzenie mediów u każdego operatora osobno to proces na kilka dni. <strong><a href="https://sprawdzdzialke.com">SprawdzDziałkę.com</a></strong> analizuje dostępność mediów jako część kompleksowego raportu o działce — razem z MPZP, strefami ochronnymi i rekomendacjami AI. Pierwszy raport jest darmowy.</p>
`
};
