'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCookieConsentFromDocument, setCookieConsent, type CookieConsentChoice } from '@/lib/cookieConsent';

export default function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsentChoice>('unknown');

  useEffect(() => {
    setConsent(getCookieConsentFromDocument());
  }, []);

  if (consent !== 'unknown') {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-orange-200 bg-white/95 px-4 py-4 shadow-lg backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-slate-900">Vi använder cookies för att hålla sidan säker och ge en bättre upplevelse.</p>
          <p className="mt-1 text-sm text-slate-600">
            Vi sparar endast det som behövs för autentisering och sessioner. Läs mer i vår{' '}
            <Link href="/integritet" className="font-semibold text-orange-700 hover:text-orange-800">
              integritetspolicy
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCookieConsent('rejected');
              setConsent('rejected');
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          >
            Avvisa
          </button>
          <button
            type="button"
            onClick={() => {
              setCookieConsent('accepted');
              setConsent('accepted');
            }}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            Acceptera
          </button>
        </div>
      </div>
    </div>
  );
}
