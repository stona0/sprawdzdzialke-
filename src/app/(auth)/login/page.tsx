import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Zaloguj się',
  description: 'Zaloguj się do SprawdzDziałkę.com i wróć do raportów swoich działek.',
}

export default function Page() {
  return <LoginForm />
}
