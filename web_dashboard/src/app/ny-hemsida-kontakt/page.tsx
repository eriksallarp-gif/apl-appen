'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function NyHemsidaKontaktPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        router.push('/dashboard');
      }
    });
    return () => unsub();
  }, [router]);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          font-feature-settings: 'liga';
          -webkit-font-smoothing: antialiased;
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }

        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>

      <main className="min-h-screen bg-[#f7f9fb] pt-16 md:pt-20 text-[#191c1e]">
        <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm shadow-slate-200/20 backdrop-blur-lg">
          <div className="mx-auto flex h-16 md:h-20 max-w-7xl items-center justify-between px-4 md:px-8">
            <a href="/ny-hemsida-test" className="flex items-center gap-3" aria-label="Till startsidan">
              <img
                src="/logo.png"
                alt="APL-appen Logo"
                className="h-12 w-auto object-contain"
              />
              <div className="hidden md:block text-2xl font-black tracking-tighter text-slate-900">APL-appen</div>
            </a>

            <div className="hidden items-center gap-8 md:flex">
              <a className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]" href="/ny-hemsida-funktioner">
                Funktioner
              </a>
              <a className="inline-flex h-10 items-center border-b-2 border-[#f97316] text-base font-semibold text-[#f97316]" href="#top">
                Kontakt
              </a>
              <a className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]" href="/ny-hemsida-faq">
                FAQ
              </a>
            </div>

            <div className="flex items-center">
              <div className="hidden items-center gap-3 md:flex">
                <button
                  onClick={() => router.push('/login')}
                  className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-5 text-base font-semibold text-slate-700 transition hover:border-[#f97316] hover:text-[#f97316]"
                  type="button"
                >
                  Logga in
                </button>
                <button
                  onClick={() => router.push('/register')}
                  className="inline-flex h-11 items-center rounded-lg bg-[#f97316] px-6 text-base font-semibold text-white transition hover:bg-orange-600"
                  type="button"
                >
                  Kom igång
                </button>
              </div>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Öppna meny"
              >
                <span className="material-symbols-outlined text-3xl">
                  {mobileMenuOpen ? 'close' : 'menu'}
                </span>
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="border-t border-slate-100 bg-white md:hidden">
              <div className="flex flex-col space-y-1 p-4">
                <a className="flex h-12 items-center px-4 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-[#f97316] rounded-lg" href="/ny-hemsida-funktioner" onClick={() => setMobileMenuOpen(false)}>Funktioner</a>
                <a className="flex h-12 items-center px-4 text-base font-medium text-[#f97316] font-semibold rounded-lg bg-orange-50" href="#top" onClick={() => setMobileMenuOpen(false)}>Kontakt</a>
                <a className="flex h-12 items-center px-4 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-[#f97316] rounded-lg" href="/ny-hemsida-faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => { setMobileMenuOpen(false); router.push('/login'); }}
                    className="flex h-12 items-center justify-center rounded-xl border border-slate-200 text-base font-semibold text-slate-700"
                    type="button"
                  >
                    Logga in
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); router.push('/register'); }}
                    className="flex h-12 items-center justify-center rounded-xl bg-[#f97316] text-base font-semibold text-white"
                    type="button"
                  >
                    Kom igång
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>

        <section id="top" className="mx-auto max-w-5xl px-8 pb-20 pt-16">
          <h1 className="text-5xl font-extrabold tracking-tight text-[#191c1e]">Kontakt</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#584237]">
            Har du frågor om APL-appen, behöver support eller vill veta mer?
          </p>

          <div className="mt-10 rounded-2xl border border-orange-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-[#191c1e]">Kontakta oss</h2>
            <p className="mt-3 text-slate-600">Vår support finns här för att hjälpa dig.</p>

            <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-500">Support e-post</p>
            <a className="mt-2 inline-block text-xl font-bold text-[#f97316] hover:text-orange-700 hover:underline" href="mailto:support@aplappen.com">
              support@aplappen.com
            </a>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="rounded-lg bg-[#f97316] px-6 py-3 text-center font-semibold text-white transition hover:bg-orange-600"
                href="mailto:support@aplappen.com"
              >
                Skicka e-post
              </a>
              <button
                className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => router.push('/ny-hemsida-faq')}
                type="button"
              >
                Gå till FAQ
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
