import type { Metadata } from 'next'
import ResetPasswordForm from './ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Nowe hasło',
  description: 'Ustaw nowe hasło do konta SprawdzDziałkę.com.',
  robots: { index: false },
}

export default function Page() {
  return <ResetPasswordForm />
}
