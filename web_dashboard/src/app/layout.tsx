import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../../styles/globals.css'
import ChunkErrorReload from '../ChunkErrorReload';
import CookieConsentBanner from '@/components/CookieConsentBanner';

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
    <html lang="sv" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100`}>
        {/* ChunkLoadError reload component */}
        <ChunkErrorReload />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  )
}
