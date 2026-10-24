/** Komunikat formularza: błąd (role="alert") albo informacja (role="status"). */
export function FormMessage({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  return tone === 'error' ? (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>
  ) : (
    <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{children}</p>
  )
}
