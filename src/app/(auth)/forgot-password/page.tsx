import type { Metadata } from 'next'
import ForgotPasswordForm from './ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Nie pamiętasz hasła?',
  description: 'Wyślemy link do ustawienia nowego hasła.',
  robots: { index: false },
}

export default function Page() {
  return <ForgotPasswordForm />
}
