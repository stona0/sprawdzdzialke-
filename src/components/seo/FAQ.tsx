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
      'Raport zawiera: dane ewidencyjne działki z ULDK GUGiK (powierzchnia, obręb, powiat), status MPZP (plan zagospodarowania przestrzennego), informacje o mediach i uzbrojeniu terenu (woda, kanalizacja, gaz, prąd), strefy ochrony przyrody z GDOŚ (Natura 2000, parki krajobrazowe), oraz rekomendacje AI dotyczące ryzyk inwestycyjnych.',
  },
  {
    question: 'Jak szybko dostanę raport?',
    answer:
      'Raport generowany jest automatycznie w 30–60 sekund. System odpytuje rejestry publiczne w czasie rzeczywistym i analizuje dane za pomocą AI.',
  },
  {
    question: 'Dla jakich gmin działa usługa?',
    answer:
      'Dane ewidencyjne (ULDK) i ochrona przyrody (GDOŚ) dostępne są dla całej Polski. Pełna analiza MPZP aktualnie działa dla Wrocławia (dane live z WFS Urzędu Miejskiego) — sukcesywnie dodajemy kolejne gminy.',
  },
  {
    question: 'Czy dane w raporcie są aktualne?',
    answer:
      'Tak. Dane pobierane są na żywo z oficjalnych rejestrów publicznych: GUGiK (ULDK), Generalnej Dyrekcji Ochrony Środowiska (GDOŚ WFS), WFS urzędów gmin, oraz OpenStreetMap. Stan danych odpowiada momentowi generowania raportu.',
  },
  {
    question: 'Co to jest MPZP i dlaczego jest ważny?',
    answer:
      'MPZP (Miejscowy Plan Zagospodarowania Przestrzennego) to dokument uchwalany przez gminę, który określa co i jak można budować na danej działce — przeznaczenie terenu, maksymalną wysokość zabudowy, procent powierzchni biologicznie czynnej, typ dachu i inne parametry. Bez MPZP budowa wymaga uzyskania decyzji o warunkach zabudowy (WZ).',
  },
  {
    question: 'Jak znaleźć identyfikator (numer EGB) działki?',
    answer:
      'Identyfikator EGB działki znajdziesz na Geoportal.gov.pl — klikając na działkę na mapie, w aktach notarialnych nieruchomości, lub w wypise z ewidencji gruntów i budynków. Format to np. 026401_1.0037.AR_3.2.',
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
