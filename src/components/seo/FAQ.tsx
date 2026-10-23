/**
 * FAQ section component z wbudowanym JSON-LD FAQPage schema.
 * Dodaj do strony głównej — boost SEO (rich snippets) + GEO (AI cytuje Q&A).
 */
import { FAQPageJsonLd, type FaqItem } from './JsonLd'

export const homepageFaqs: FaqItem[] = [
  {
    question: 'Ile kosztuje raport o działce?',
    answer:
      'Pierwszy raport jest całkowicie darmowy. Kolejne raporty kosztują 29 zł za sztukę — bez subskrypcji, płacisz tylko gdy potrzebujesz.',
  },
  {
    question: 'Jakie dane zawiera raport?',
    answer:
      'Raport zawiera: ocenę możliwości zabudowy według przepisów obowiązujących od 1.09.2026, dane ewidencyjne z ULDK GUGiK (obręb, powiat, powierzchnia), informację o MPZP (czy plan obejmuje działkę, oznaczenie terenu i uchwała), plan ogólny gminy z Rejestru Urbanistycznego (strefa, parametry zabudowy, obszar uzupełnienia zabudowy), zagrożenie powodziowe (ISOK), ochronę przyrody (GDOŚ), sieci uzbrojenia w pobliżu działki oraz rekomendacje i ryzyka przygotowane przez AI na podstawie tych danych. Dla każdego źródła raport pokazuje, czy udało się pobrać dane.',
  },
  {
    question: 'Jak szybko dostanę raport?',
    answer:
      'Raport generowany jest automatycznie w 30–60 sekund. System odpytuje rejestry publiczne w czasie rzeczywistym i analizuje dane za pomocą AI.',
  },
  {
    question: 'Dla jakich gmin działa usługa?',
    answer:
      'Raport można wygenerować dla każdej działki w Polsce. Zakres zależy od tego, co gminy i powiaty przekazały do rejestrów krajowych. Informację o MPZP bierzemy z Krajowej Integracji MPZP; niektóre gminy podają tam tylko uchwałę, bez oznaczenia terenu, a dla Wrocławia dane pochodzą z GIS miasta. Plan ogólny pokazujemy, gdy gmina opublikowała go w Rejestrze Urbanistycznym. Sieci uzbrojenia są widoczne tam, gdzie powiat przekazuje dane do Krajowej Integracji Uzbrojenia Terenu. Gdy źródło nie ma danych, raport mówi to wprost.',
  },
  {
    question: 'Czy dane w raporcie są aktualne?',
    answer:
      'Dane pobieramy z rejestrów publicznych (GUGiK, Rejestr Urbanistyczny, Wody Polskie, GDOŚ, BDOT10k, OpenStreetMap) w chwili generowania raportu. Odpowiedzi rejestrów przechowujemy najwyżej 24 godziny, a Rejestru Urbanistycznego 6 godzin. Rejestry bywają opóźnione względem uchwał gmin, dlatego przed zakupem potwierdź stan planistyczny w urzędzie gminy.',
  },
  {
    question: 'Co to jest MPZP i dlaczego jest ważny?',
    answer:
      'MPZP (Miejscowy Plan Zagospodarowania Przestrzennego) to dokument uchwalany przez gminę, który określa co i jak można budować na danej działce — przeznaczenie terenu, maksymalną wysokość zabudowy, procent powierzchni biologicznie czynnej, typ dachu i inne parametry. Bez MPZP od 1.09.2026 nową decyzję o warunkach zabudowy (WZ) co do zasady można uzyskać tylko w obszarze uzupełnienia zabudowy wyznaczonym w planie ogólnym gminy.',
  },
  {
    question: 'Jak znaleźć identyfikator (numer EGB) działki?',
    answer:
      'Identyfikator EGB działki znajdziesz na Geoportal.gov.pl — klikając na działkę na mapie, w aktach notarialnych nieruchomości, lub w wypisie z ewidencji gruntów i budynków. Format to np. 026401_1.0037.AR_3.2.',
  },
  {
    question: 'Czy mogę sprawdzić działkę rolną?',
    answer:
      'Tak. System sprawdza każdą działkę zarejestrowaną w ewidencji gruntów ULDK GUGiK — zarówno budowlaną, jak i rolną, leśną czy inwestycyjną. Raport pokaże aktualne przeznaczenie w MPZP (jeśli istnieje) oraz ograniczenia środowiskowe.',
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="max-w-4xl mx-auto px-6 py-24">
      <FAQPageJsonLd faqs={homepageFaqs} />

      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-gray-900 tracking-tight font-playfair">
          Często zadawane pytania
        </h2>
        <p className="mt-4 text-gray-500 text-lg">
          Wszystko co musisz wiedzieć o SprawdzDziałkę.com
        </p>
      </div>

      <div className="space-y-4">
        {homepageFaqs.map((faq, i) => (
          <details
            key={i}
            className="group border border-gray-200 rounded-xl overflow-hidden"
          >
            <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-left hover:bg-gray-50 transition-colors">
              <h3 className="font-semibold text-gray-900 pr-4">{faq.question}</h3>
              <span className="text-gray-400 group-open:rotate-45 transition-transform duration-200 text-xl flex-shrink-0">
                +
              </span>
            </summary>
            <div className="px-6 pb-5 text-gray-600 leading-relaxed">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
