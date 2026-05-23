export default function ReportLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Ładowanie raportu…</p>
        </div>
      </div>
    </div>
  )
}
