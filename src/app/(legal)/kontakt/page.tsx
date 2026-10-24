import type { Metadata } from 'next'
import Link from 'next/link'
import { COMPANY, COMPANY_ADDRESS } from '@/lib/company'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Kontakt',
  description: 'Kontakt z SprawdzDziałkę.com: pytania o raporty, faktury VAT, reklamacje i dane osobowe.',
  alternates: { canonical: 'https://sprawdzdzialke.com/kontakt' },
}

export default function ContactPage() {
  return (
    <LegalPage title="Kontakt" document={false}>
      <p>
        Napisz na <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Jeśli sprawa dotyczy konkretnego raportu, podaj
        adres e-mail konta i identyfikator działki. Wtedy szybciej go znajdziemy.
      </p>

      <h2>Dane firmy</h2>
      <p>
        {COMPANY.name}
        <br />
        {COMPANY_ADDRESS}
        <br />
        NIP {COMPANY.nip}, REGON {COMPANY.regon}
      </p>

      <h2>Faktura VAT</h2>
      <p>
        Fakturę za raport wystawiamy na życzenie. Napisz na {COMPANY.email} i podaj adres e-mail konta, datę płatności
        oraz dane do faktury: imię i nazwisko albo nazwę firmy, adres i NIP, jeśli kupujesz jako firma.
      </p>

      <h2>Reklamacje i odstąpienie od umowy</h2>
      <p>
        Reklamacje i oświadczenia o odstąpieniu przyjmujemy na ten sam adres. Na reklamację odpowiadamy w ciągu 14 dni.
        Szczegóły są w <Link href="/regulamin">Regulaminie</Link>.
      </p>

      <h2>Dane osobowe i usunięcie konta</h2>
      <p>
        Wnioski dotyczące danych osobowych, w tym prośbę o usunięcie konta, wyślij z adresu przypisanego do konta. Zasady
        opisuje <Link href="/polityka-prywatnosci">Polityka prywatności</Link>.
      </p>
    </LegalPage>
  )
}
