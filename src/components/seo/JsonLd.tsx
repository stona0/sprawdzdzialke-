/**
 * Reusable JSON-LD structured data components for SEO & GEO.
 * Renderowane server-side w layout.tsx lub page.tsx.
 */

// ─── WebApplication schema ──────────────────────────────────────────────────
export function WebApplicationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'SprawdzDziałkę.com',
    url: 'https://sprawdzdzialke.com',
    description:
      'Narzędzie do analizy działek budowlanych w Polsce. Raport planistyczny w 60 sekund — MPZP, media, strefy Natura 2000 i rekomendacje AI.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '0',
        priceCurrency: 'PLN',
        description: 'Pierwszy raport za darmo',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '29',
        priceCurrency: 'PLN',
        description: 'Pełny raport z rekomendacjami AI',
      },
    ],
    featureList: [
      'Analiza MPZP (plan zagospodarowania przestrzennego)',
      'Sprawdzenie mediów i uzbrojenia terenu',
      'Ochrona przyrody — Natura 2000, parki, rezerwaty',
      'Strefy zalewowe ISOK',
      'Rekomendacje AI (Claude)',
      'Raport w 60 sekund',
    ],
    creator: {
      '@type': 'Organization',
      name: 'Stona Consulting',
      url: 'https://sprawdzdzialke.com',
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
    legalName: 'Stona Consulting',
    url: 'https://sprawdzdzialke.com',
    // logo: 'https://sprawdzdzialke.com/logo.png',  // TODO: dodać logo
    description:
      'Profesjonalna analiza planistyczna działek budowlanych w Polsce. Dane z oficjalnych rejestrów: GUGiK, GDOŚ, WFS gmin.',
    foundingDate: '2026',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
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
