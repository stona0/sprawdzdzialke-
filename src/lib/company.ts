// Dane usługodawcy — jedno źródło dla stron prawnych, kontaktu i JSON-LD.
// Podane przez właściciela 23.10.2026.
export const COMPANY = {
  brand: 'SprawdzDziałkę.com',
  name: 'Konrad Stankiewicz Consulting',
  street: 'ul. Zatorska 136/8',
  postalCode: '51-215',
  city: 'Wrocław',
  country: 'Polska',
  nip: '8992924093',
  regon: '521874307',
  email: 'kontakt@lintel.pl',
  url: 'https://sprawdzdzialke.com',
} as const

export const COMPANY_ADDRESS = `${COMPANY.street}, ${COMPANY.postalCode} ${COMPANY.city}`
