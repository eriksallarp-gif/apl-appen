'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function HomeDesignTestPage() {
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

        .editorial-shadow {
          box-shadow: 0 40px 60px -15px rgba(25, 28, 30, 0.05);
        }
      `}</style>

      <main className="bg-[#f7f9fb] text-[#191c1e] selection:bg-[#f97316]/30" style={{ fontFamily: 'Inter, sans-serif' }}>
        <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm shadow-slate-200/20 backdrop-blur-lg">
          <div className="mx-auto flex h-16 md:h-20 max-w-7xl items-center justify-between px-4 md:px-8">
            <a href="/" className="flex items-center gap-3" aria-label="Till startsidan">
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
              <a className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]" href="/ny-hemsida-kontakt">
                Kontakt
              </a>
              <a className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]" href="/ny-hemsida-faq">
                FAQ
              </a>
            </div>

            <div className="flex items-center">
              <div className="hidden items-center space-x-3 md:flex">
                <button
                  onClick={() => router.push('/login')}
                  className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-5 text-base font-semibold text-slate-700 transition-all duration-200 hover:border-[#f97316] hover:text-[#f97316] active:scale-95"
                >
                  Logga in
                </button>
                <button
                  onClick={() => router.push('/register')}
                  className="inline-flex h-11 items-center rounded-lg bg-[#f97316] px-6 text-base font-semibold text-white transition-all duration-200 hover:bg-orange-600 active:scale-95"
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
                <a className="flex h-12 items-center px-4 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-[#f97316] rounded-lg" href="/ny-hemsida-kontakt" onClick={() => setMobileMenuOpen(false)}>Kontakt</a>
                <a className="flex h-12 items-center px-4 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-[#f97316] rounded-lg" href="/ny-hemsida-faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => { setMobileMenuOpen(false); router.push('/login'); }}
                    className="flex h-12 items-center justify-center rounded-xl border border-slate-200 text-base font-semibold text-slate-700"
                  >
                    Logga in
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); router.push('/register'); }}
                    className="flex h-12 items-center justify-center rounded-xl bg-[#f97316] text-base font-semibold text-white"
                  >
                    Kom igång
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>

        <section className="flex min-h-screen items-center overflow-hidden pb-16 pt-24 md:pb-40 md:pt-48">
          <div className="mx-auto max-w-7xl px-6 md:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="relative z-10 text-center lg:text-left">
                <span className="mb-4 md:mb-6 inline-block rounded-full bg-[#ffdbca] px-3 py-1 text-xs md:text-sm font-bold uppercase tracking-wider text-[#783200]">
                  Välkommen till APL-appen
                </span>
                <h1 className="mb-6 md:mb-8 text-4xl font-extrabold leading-tight tracking-tighter text-[#191c1e] lg:text-[4.5rem] lg:leading-[1.05] lg:tracking-[-0.05em]">
                  <span className="block lg:inline">Hantera elevernas APL med</span>
                  <span className="hidden lg:inline"> </span>
                  <span className="block lg:inline text-[#f97316]">APL-appen.</span>
                </h1>
                <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-[#584237] md:mx-0 md:text-xl">
                  Enkel och effektiv hantering av arbetsplatsförlagda timmar och bedömningar - för elever, handledare och lärare.
                </p>
                <div className="flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
                  <button
                    onClick={() => router.push('/register')}
                    className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#9d4300] to-[#f97316] px-8 py-4 text-base md:text-lg font-bold text-white shadow-xl shadow-[#f97316]/30 transition-transform hover:scale-[1.02]"
                  >
                    Börja använda APL-appen
                  </button>
                </div>
              </div>

              <div className="relative mt-8 md:mt-0">
                <div className="absolute -right-20 -top-20 h-[300px] w-[300px] md:h-[500px] md:w-[500px] rounded-full bg-[#f97316]/10 blur-3xl" />
                <div className="relative mx-auto max-w-[320px] md:max-w-[410px] rounded-[2rem] md:rounded-[2.5rem] bg-[#f7f9fb] p-2">
                  <img
                    src="/Bildstartsida1.png"
                    alt="APL-appen mobilgranssnitt"
                    className="w-full rounded-[1.8rem] md:rounded-[2rem] object-cover aspect-[2/3]"
                  />
                </div>

                <div className="editorial-shadow absolute -bottom-6 -left-6 hidden max-w-[200px] rounded-xl bg-white p-4 md:block md:max-w-[240px] md:p-6">
                  <div className="mb-2 flex items-center gap-2 md:mb-3 md:gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316] md:h-10 md:w-10">
                      <span className="material-symbols-outlined text-sm text-white md:text-base">trending_up</span>
                    </div>
                    <span className="text-xs font-bold tracking-tight text-[#191c1e] md:text-base">Real-tid status</span>
                  </div>
                  <p className="text-xs text-[#584237] md:text-sm">Se elevernas tider och bedömningar i realtid.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-[#f7f9fb] px-6 py-10 md:px-8 md:py-12">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row md:gap-4">
            <p className="text-xs text-slate-500 md:text-sm">© 2024 <span className="text-[#f97316]">APL-appen</span>. Alla rättigheter förbehållna.</p>
            <div className="flex gap-6">
              <span className="material-symbols-outlined cursor-pointer text-slate-400 transition-colors hover:text-[#f97316]">
                public
              </span>
              <span className="material-symbols-outlined cursor-pointer text-slate-400 transition-colors hover:text-[#f97316]">
                mail
              </span>
              <span className="material-symbols-outlined cursor-pointer text-slate-400 transition-colors hover:text-[#f97316]">
                share
              </span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
