import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../../styles/globals.css'
import Header from '@/components/Header'
import ChunkErrorReload from '../ChunkErrorReload';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'APL-appen - APL för gymnasieelever',
  description: 'APL-systemet för gymnasieelever',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv">
      <body className={inter.className}>
        <Header />
          {/* ChunkLoadError reload component */}
          <ChunkErrorReload />
        {children}
      </body>
    </html>
  )
}
