export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav skeleton */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-14">
        {/* Header skeleton */}
        <div>
          <div className="h-10 w-64 bg-gray-100 rounded animate-pulse mb-3" />
          <div className="h-4 w-48 bg-gray-50 rounded animate-pulse" />
        </div>

        {/* Search skeleton */}
        <div className="border border-gray-100 rounded-2xl p-7 bg-white shadow-sm">
          <div className="h-20 bg-gray-50 rounded-xl animate-pulse mb-6" />
          <div className="h-10 bg-gray-100 rounded-xl animate-pulse mb-4" />
          <div className="h-12 bg-gray-200 rounded-full animate-pulse" />
        </div>

        {/* Reports skeleton */}
        <div>
          <div className="h-8 w-40 bg-gray-100 rounded animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-50 border border-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
