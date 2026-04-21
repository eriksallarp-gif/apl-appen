'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function HomeDesignTestPage() {
  const router = useRouter();

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

      <main className="overflow-x-hidden bg-[#f7f9fb] text-[#191c1e] selection:bg-[#f97316]/30" style={{ fontFamily: 'Inter, sans-serif' }}>
        <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm shadow-slate-200/20 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
            <a href="/ny-hemsida-test" className="flex items-center gap-2 sm:gap-3" aria-label="Till startsidan">
              <img
                src="https://lh3.googleusercontent.com/aida/ADBb0uhE7u61HkfDy3ZM79duWMs3rVcoP42aFJI56z9U0fKoNAkMo6U9z3w4ReABBGlKlAzHyUQf2AjK3IJ3xIlkrJ0zpePuKPVVpG9oyalsDE0yjzTa06nYAJACLoAF3Ks-xN1K3k0gI5EzxvRCs7k34wYxOW3HeBqL3wn9ZN-os3mRgb6C3vR-JKTZ1ukd-MCN9PFdOBVCbdLF-cGOyF9WhtTpo6nexEAB8WDW5GrwVydBcPNwpGW3eiGpFk4oJrgwY69DtSH1r0wNag"
                alt="APL-appen Logo"
                className="h-9 w-auto object-contain sm:h-12"
              />
              <div className="text-lg font-black tracking-tighter text-slate-900 sm:text-2xl">APL-appen</div>
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

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => router.push('/login')}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-all duration-200 hover:border-[#f97316] hover:text-[#f97316] active:scale-95 sm:h-11 sm:px-5 sm:text-base"
              >
                Logga in
              </button>
              <button
                onClick={() => router.push('/register')}
                className="inline-flex h-10 items-center rounded-lg bg-[#f97316] px-3 text-xs font-semibold text-white transition-all duration-200 hover:bg-orange-600 active:scale-95 sm:h-11 sm:px-6 sm:text-base"
              >
                Kom igång
              </button>
            </div>
          </div>
        </nav>

        <section className="flex min-h-screen items-center overflow-hidden pb-16 pt-24 sm:pb-24 sm:pt-32 md:pb-32 md:pt-40 lg:pb-40 lg:pt-48">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="relative z-10">
                <span className="mb-5 inline-block rounded-full bg-[#ffdbca] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#783200] sm:mb-6 sm:text-sm">
                  Välkommen till APL-appen
                </span>
                <h1 className="mb-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-[#191c1e] sm:mb-8 sm:text-5xl md:text-6xl lg:text-7xl">
                  <span className="block">Hantera elevernas APL med</span>
                  <span className="block text-[#f97316]">APL-appen.</span>
                </h1>
                <p className="mb-8 max-w-xl text-base leading-relaxed text-[#584237] sm:mb-10 sm:text-lg md:text-xl">
                  Enkel och effektiv hantering av arbetsplatsförlagda timmar och bedömningar - för elever, handledare och lärare.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <button
                    onClick={() => router.push('/register')}
                    className="w-full rounded-xl bg-gradient-to-r from-[#9d4300] to-[#f97316] px-6 py-3.5 text-base font-bold text-white shadow-xl shadow-[#f97316]/30 transition-transform hover:scale-[1.02] sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
                  >
                    Börja använda APL-appen
                  </button>
                </div>
              </div>

              <div className="relative mt-4 sm:mt-6 lg:mt-0">
                <div className="absolute -right-10 -top-10 h-[260px] w-[260px] rounded-full bg-[#f97316]/10 blur-3xl sm:-right-16 sm:-top-16 sm:h-[360px] sm:w-[360px] lg:-right-20 lg:-top-20 lg:h-[500px] lg:w-[500px]" />
                <div className="editorial-shadow relative mx-auto w-full max-w-[260px] overflow-hidden rounded-[2.5rem] border-[7px] border-slate-900 shadow-2xl sm:max-w-[320px] sm:rounded-[3rem] sm:border-[8px]">
                  <img
                    src="https://lh3.googleusercontent.com/aida/ADBb0uio-xof-TtEpjt20MpDkjkgNfkhwRqcU23abAVqMNkPXpmkMWw75lYRkWaYKMP5NI13dMUK9jTouYLYtJ2rZQhbrNaUj3CylqRYVV-rue1VMmJC8El5SaZ9tuHHD05cIdSa0Y3nuOU0Ys48fFypdrp69ospGbxMi7EGNXNNbgu7G4QwunysRXauQ44Up84FR0in7oSDe9mDjZeTW7X8SQOqIf1S30gR2atYuAcsu8oyjsylK4eD7asjHicsJgEbhHVFoSObuB3E4Q"
                    alt="APL-appen mobilgranssnitt"
                    className="w-full object-cover"
                  />
                </div>

                <div className="editorial-shadow absolute -bottom-8 left-1/2 hidden w-[220px] -translate-x-1/2 rounded-xl bg-white p-5 sm:block lg:-bottom-10 lg:left-0 lg:w-auto lg:max-w-[240px] lg:-translate-x-10 lg:p-6">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f97316]">
                      <span className="material-symbols-outlined text-white">trending_up</span>
                    </div>
                    <span className="font-bold tracking-tight text-[#191c1e]">Real-tid status</span>
                  </div>
                  <p className="text-sm text-[#584237]">Se elevernas tider och bedömningar i realtid.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-[#f7f9fb] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
            <p className="text-xs text-slate-500 sm:text-sm">© 2024 APL-appen. Alla rättigheter förbehållna.</p>
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
