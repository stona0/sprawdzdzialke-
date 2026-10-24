/**
 * Reusable JSON-LD structured data components for SEO & GEO.
 * Renderowane server-side w layout.tsx lub page.tsx.
 */
import { COMPANY } from '@/lib/company'

// ─── WebApplication schema ──────────────────────────────────────────────────
export function WebApplicationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'SprawdzDziałkę.com',
    url: 'https://sprawdzdzialke.com',
    description:
      'Narzędzie do analizy działek budowlanych w Polsce. Raport planistyczny zwykle w mniej niż minutę — MPZP, plan ogólny, media, strefy Natura 2000 i rekomendacje AI.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    offers: [
      {
        '@type': 'Offer',
        name: 'Pierwszy raport',
        price: '0',
        priceCurrency: 'PLN',
        description: 'Pierwszy raport na konto za darmo',
      },
      {
        '@type': 'Offer',
        name: 'Każdy kolejny raport',
        price: '29',
        priceCurrency: 'PLN',
        description: 'Ten sam pełny raport, 29 zł brutto za sztukę, bez subskrypcji',
      },
    ],
    featureList: [
      'Ocena możliwości zabudowy według przepisów od 1.09.2026',
      'MPZP z Krajowej Integracji MPZP',
      'Plan ogólny gminy z Rejestru Urbanistycznego',
      'Sieci uzbrojenia terenu w pobliżu działki',
      'Ochrona przyrody — Natura 2000, parki, rezerwaty',
      'Zagrożenie powodziowe ISOK',
      'Rekomendacje i ryzyka AI (Claude) z podstawą w danych',
      'Raport zwykle w mniej niż minutę',
    ],
    creator: {
      '@type': 'Organization',
      name: COMPANY.name,
      url: COMPANY.url,
    },
    inLanguage: 'pl',
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

// ─── Organization schema ────────────────────────────────────────────────────
export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SprawdzDziałkę.com',
    legalName: COMPANY.name,
    url: COMPANY.url,
    logo: `${COMPANY.url}/logo.png`,
    description:
      'Profesjonalna analiza planistyczna działek budowlanych w Polsce. Dane z oficjalnych rejestrów: GUGiK, GDOŚ, WFS gmin.',
    foundingDate: '2026',
    vatID: `PL${COMPANY.nip}`,
    taxID: COMPANY.nip,
    address: {
      '@type': 'PostalAddress',
      streetAddress: COMPANY.street,
      postalCode: COMPANY.postalCode,
      addressLocality: COMPANY.city,
      addressCountry: 'PL',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: COMPANY.email,
      availableLanguage: 'Polish',
    },
    sameAs: [
      // TODO: dodać linki do social media gdy będą
      // 'https://www.linkedin.com/company/...',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

// ─── FAQPage schema ─────────────────────────────────────────────────────────
export interface FaqItem {
  question: string
  answer: string
}

export function FAQPageJsonLd({ faqs }: { faqs: FaqItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
