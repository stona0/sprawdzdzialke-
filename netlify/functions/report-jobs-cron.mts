// Funkcja zaplanowana Netlify: co 5 minut budzi kolejkę raportów (/api/cron/report-jobs).
// Wymaga zmiennej CRON_SECRET w ustawieniach witryny; URL ustawia Netlify.
export default async function reportJobsCron(): Promise<Response> {
  const base = process.env.URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret) {
    console.error('[report-jobs-cron] brak URL lub CRON_SECRET — pomijam')
    return new Response('skipped', { status: 500 })
  }
  const res = await fetch(`${base}/api/cron/report-jobs`, { headers: { authorization: `Bearer ${secret}` } })
  console.log(`[report-jobs-cron] HTTP ${res.status}`)
  return new Response(null, { status: res.ok ? 200 : 502 })
}

export const config = { schedule: '*/5 * * * *' }
