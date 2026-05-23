import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

const features = [
  'Dane działki z Geoportal (granice, obręb)',
  'Parametry zabudowy z MPZP',
  'Strefy zalewowe (ISOK)',
  'Formy ochrony przyrody (GDOŚ)',
  'Dostępność mediów (woda/gaz/prąd)',
  'Rekomendacje i ryzyka inwestycyjne',
  'Eksport do PDF',
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-20 px-4">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Prosty cennik</h1>
        <p className="text-gray-600 text-lg">Płacisz tylko za raporty których potrzebujesz.</p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Free */}
        <Card className="border-2">
          <CardHeader>
            <Badge variant="secondary" className="w-fit mb-2">Na start</Badge>
            <CardTitle className="text-2xl">Darmowy</CardTitle>
            <CardDescription>Jeden raport po rejestracji</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold mb-6">0 PLN</p>
            <ul className="space-y-3">
              {features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Link href="/register" className="w-full">
              <Button variant="outline" className="w-full">Zarejestruj się</Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Paid */}
        <Card className="border-2 border-green-600 shadow-lg">
          <CardHeader>
            <Badge className="w-fit mb-2 bg-green-600">Każdy kolejny</Badge>
            <CardTitle className="text-2xl">Płatny raport</CardTitle>
            <CardDescription>Pełny raport dla dowolnej działki</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold mb-6">29 PLN</p>
            <ul className="space-y-3">
              {features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Link href="/register" className="w-full">
              <Button className="w-full bg-green-600 hover:bg-green-700">Kup raport</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>

      <p className="text-center text-sm text-gray-500 mt-10">
        Płatność przez Stripe – karta, BLIK, Przelewy24. Faktura VAT na życzenie.
      </p>
    </main>
  )
}
