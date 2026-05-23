import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl font-bold text-gray-200 font-playfair">404</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2 font-playfair">
            Strona nie istnieje
          </h1>
          <p className="text-gray-500 text-sm">
            Nie znaleźliśmy strony której szukasz. Sprawdź adres lub wróć na stronę główną.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-700 transition-colors"
        >
          Strona główna
        </Link>
      </div>
    </main>
  )
}
