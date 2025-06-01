import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ParsoAI - Personal AI Assistant',
  description: 'Advanced AI assistant with screen sharing and voice interaction',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
