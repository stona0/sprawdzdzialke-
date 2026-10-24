import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = {
  title: 'Załóż konto',
  description: 'Załóż konto w SprawdzDziałkę.com — pierwszy raport planistyczny działki za darmo.',
}

export default function Page() {
  return <RegisterForm />
}
