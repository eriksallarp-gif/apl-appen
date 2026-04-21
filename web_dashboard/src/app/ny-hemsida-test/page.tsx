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

      <main className="bg-[#f7f9fb] text-[#191c1e] selection:bg-[#f97316]/30" style={{ fontFamily: 'Inter, sans-serif' }}>
        <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm shadow-slate-200/20 backdrop-blur-lg">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
            <a href="/ny-hemsida-test" className="flex items-center gap-3" aria-label="Till startsidan">
              <img
                src="/logo.png"
                alt="APL-appen Logo"
                className="h-12 w-auto object-contain"
              />
              <div className="text-2xl font-black tracking-tighter text-slate-900">APL-appen</div>
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

            <div className="flex items-center space-x-3">
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
          </div>
        </nav>

        <section className="flex min-h-screen items-center overflow-hidden pb-24 pt-32 md:pb-40 md:pt-48">
          <div className="mx-auto max-w-7xl px-8">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div className="relative z-10">
                <span className="mb-6 inline-block rounded-full bg-[#ffdbca] px-3 py-1 text-sm font-bold uppercase tracking-wider text-[#783200]">
                  Välkommen till APL-appen
                </span>
                <h1 className="mb-8 text-6xl font-extrabold leading-[1.05] tracking-tighter text-[#191c1e] md:text-7xl">
                  <span style={{ fontSize: '4.5rem', letterSpacing: '-0.05em' }}>Hantera elevernas APL med</span>
                  <span style={{ fontSize: '4.5rem', letterSpacing: '-0.05em' }}>{' '}</span>
                  <span style={{ color: '#f97316', fontSize: '4.5rem', letterSpacing: '-0.05em' }}>APL-appen.</span>
                </h1>
                <p className="mb-10 max-w-lg text-lg leading-relaxed text-[#584237] md:text-xl">
                  Enkel och effektiv hantering av arbetsplatsförlagda timmar och bedömningar - för elever, handledare och lärare.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    onClick={() => router.push('/register')}
                    className="rounded-xl bg-gradient-to-r from-[#9d4300] to-[#f97316] px-8 py-4 text-lg font-bold text-white shadow-xl shadow-[#f97316]/30 transition-transform hover:scale-[1.02]"
                  >
                    Börja använda APL-appen
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-[#f97316]/10 blur-3xl" />
                <div className="relative mx-auto max-w-[410px] rounded-[2.5rem] bg-[#f7f9fb] p-2">
                  <img
                    src="/Bildstartsida1.png"
                    alt="APL-appen mobilgranssnitt"
                    className="w-full rounded-[2rem] object-cover mix-blend-multiply"
                  />
                </div>

                <div className="editorial-shadow absolute -bottom-10 -left-10 hidden max-w-[240px] rounded-xl bg-white p-6 md:block">
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

        <footer className="border-t border-slate-200 bg-[#f7f9fb] px-8 py-12">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-slate-500">© 2024 APL-appen. Alla rättigheter förbehållna.</p>
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
