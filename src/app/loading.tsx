export default function GlobalLoading() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Ładowanie…</p>
      </div>
    </main>
  )
}
