import './globals.css'
import { AuthProvider } from '../lib/auth-context'

export const metadata = { title: 'Zalisto — AI Product Importer' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
