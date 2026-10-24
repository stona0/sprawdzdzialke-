import { LEGAL_DRAFT, TERMS_DATE_LABEL } from '@/lib/legal'

// document = false: strona informacyjna (kontakt) — bez daty obowiązywania i banera wzoru.
export function LegalPage({ title, document = true, children }: { title: string; document?: boolean; children: React.ReactNode }) {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-20">
      {document && LEGAL_DRAFT && (
        <div role="note" className="mb-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Wzór dokumentu — wymaga weryfikacji prawnika</strong> przed uruchomieniem płatnej usługi.
          Fragmenty oznaczone „Do weryfikacji” wymagają decyzji lub sprawdzenia.
        </div>
      )}
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight font-playfair">{title}</h1>
      {document && <p className="mt-2 text-sm text-gray-500">Obowiązuje od {TERMS_DATE_LABEL}</p>}
      <div className="mt-8 prose prose-gray max-w-none prose-headings:font-playfair prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-10 prose-a:text-green-700 prose-li:my-1">
        {children}
      </div>
    </article>
  )
}

// Uwaga dla właściciela i prawnika; znika po ustawieniu LEGAL_DRAFT = false.
export function DraftNote({ children }: { children: React.ReactNode }) {
  if (!LEGAL_DRAFT) return null
  return (
    <span className="not-prose block my-3 rounded-lg border border-dashed border-amber-400 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
      Do weryfikacji: {children}
    </span>
  )
}
