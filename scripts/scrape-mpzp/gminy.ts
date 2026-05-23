/**
 * gminy.ts
 * Konfiguracja gmin w okolicach Wrocławia.
 * bip_url  – główna strona BIP gminy
 * mpzp_url – bezpośredni link do strony z MPZP (jeśli znany)
 * teryt    – kod TERYT gminy (7-cyfrowy)
 */

export interface GminaConfig {
  nazwa: string
  powiat: string
  teryt: string
  bip_url: string
  mpzp_url?: string   // znana bezpośrednia ścieżka
  search_hints?: string[] // frazy do szukania w linkowaniu
}

export const GMINY_WROCLAW: GminaConfig[] = [
  // ── Miasto Wrocław ────────────────────────────────────────────────
  {
    nazwa: 'Wrocław',
    powiat: 'Wrocław',
    teryt: '0264000',
    bip_url: 'https://bip.um.wroc.pl',
    mpzp_url: 'https://bip.um.wroc.pl/content/247',
  },

  // ── Powiat wrocławski (ziemski) ───────────────────────────────────
  {
    nazwa: 'Czernica',
    powiat: 'wrocławski',
    teryt: '0204022',
    bip_url: 'https://bip.czernica.pl',
  },
  {
    nazwa: 'Długołęka',
    powiat: 'wrocławski',
    teryt: '0204032',
    bip_url: 'https://bip.dlugoleka.pl',
    mpzp_url: 'https://bip.dlugoleka.pl/planowanie-przestrzenne',
  },
  {
    nazwa: 'Jordanów Śląski',
    powiat: 'wrocławski',
    teryt: '0204042',
    bip_url: 'https://bip.jordanowslaski.pl',
  },
  {
    nazwa: 'Kąty Wrocławskie',
    powiat: 'wrocławski',
    teryt: '0204053',
    bip_url: 'https://www.bip.katywroclawskie.pl',
    mpzp_url: 'https://www.bip.katywroclawskie.pl/planowanie-przestrzenne',
  },
  {
    nazwa: 'Kobierzyce',
    powiat: 'wrocławski',
    teryt: '0204062',
    bip_url: 'https://www.bip.kobierzyce.pl',
    mpzp_url: 'https://www.bip.kobierzyce.pl/mpzp',
  },
  {
    nazwa: 'Mietków',
    powiat: 'wrocławski',
    teryt: '0204072',
    bip_url: 'https://bip.mietkow.pl',
  },
  {
    nazwa: 'Miękinia',
    powiat: 'wrocławski',
    teryt: '0204082',
    bip_url: 'https://bip.miekinia.pl',
  },
  {
    nazwa: 'Siechnice',
    powiat: 'wrocławski',
    teryt: '0204093',
    bip_url: 'https://bip.siechnice.dolnyslask.pl',
  },
  {
    nazwa: 'Sobótka',
    powiat: 'wrocławski',
    teryt: '0204103',
    bip_url: 'https://bip.sobotka.pl',
  },
  {
    nazwa: 'Żórawina',
    powiat: 'wrocławski',
    teryt: '0204112',
    bip_url: 'https://bip.zorawina.pl',
  },

  // ── Powiat oławski ────────────────────────────────────────────────
  {
    nazwa: 'Oława',
    powiat: 'oławski',
    teryt: '0213043',
    bip_url: 'https://www.gmina.olawa.pl/bip',
  },
  {
    nazwa: 'Domaniów',
    powiat: 'oławski',
    teryt: '0213022',
    bip_url: 'https://bip.domaniow.pl',
  },
  {
    nazwa: 'Jelcz-Laskowice',
    powiat: 'oławski',
    teryt: '0213013',
    bip_url: 'https://bip.jelcz-laskowice.pl',
  },

  // ── Powiat średzki ────────────────────────────────────────────────
  {
    nazwa: 'Środa Śląska',
    powiat: 'średzki',
    teryt: '0221043',
    bip_url: 'https://bip.srodaslaska.pl',
  },
  {
    nazwa: 'Malczyce',
    powiat: 'średzki',
    teryt: '0221022',
    bip_url: 'https://bip.malczyce.pl',
  },
  {
    nazwa: 'Kostomłoty',
    powiat: 'średzki',
    teryt: '0221032',
    bip_url: 'https://bip.kostomloty.pl',
  },

  // ── Powiat trzebnicki ─────────────────────────────────────────────
  {
    nazwa: 'Trzebnica',
    powiat: 'trzebnicki',
    teryt: '0224043',
    bip_url: 'https://bip.trzebnica.pl',
  },
  {
    nazwa: 'Oborniki Śląskie',
    powiat: 'trzebnicki',
    teryt: '0224032',
    bip_url: 'https://bip.oborniki-slaskie.pl',
  },
  {
    nazwa: 'Prusice',
    powiat: 'trzebnicki',
    teryt: '0224042',
    bip_url: 'https://bip.prusice.pl',
  },
  {
    nazwa: 'Wisznia Mała',
    powiat: 'trzebnicki',
    teryt: '0224052',
    bip_url: 'https://bip.wiszniamala.pl',
  },
  {
    nazwa: 'Zawonia',
    powiat: 'trzebnicki',
    teryt: '0224062',
    bip_url: 'https://bip.zawonia.pl',
  },

  // ── Powiat oleśnicki ──────────────────────────────────────────────
  {
    nazwa: 'Oleśnica',
    powiat: 'oleśnicki',
    teryt: '0214043',
    bip_url: 'https://bip.olesnica.pl',
  },
  {
    nazwa: 'Dobroszyce',
    powiat: 'oleśnicki',
    teryt: '0214022',
    bip_url: 'https://bip.dobroszyce.pl',
  },
  {
    nazwa: 'Długołęka (oleśnicki)',
    powiat: 'oleśnicki',
    teryt: '0214032',
    bip_url: 'https://bip.bierutow.pl',
  },
]
