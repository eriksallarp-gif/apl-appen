'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function NyHemsidaFunktionerPage() {
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }

        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>

      <main className="bg-[#f7f9fb] pt-16 md:pt-20 text-[#191c1e]">
        <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
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
              <a className="inline-flex h-10 items-center border-b-2 border-[#f97316] text-base font-semibold text-[#f97316]" href="#top">
                Funktioner
              </a>
              <button
                onClick={() => router.push('/ny-hemsida-kontakt')}
                className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]"
                type="button"
              >
                Kontakt
              </button>
              <button
                onClick={() => router.push('/ny-hemsida-faq')}
                className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]"
                type="button"
              >
                FAQ
              </button>
            </div>

            <div className="flex items-center">
              <div className="hidden items-center gap-3 md:flex">
                <button
                  onClick={() => router.push('/login')}
                  className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-5 text-base font-semibold text-slate-700 transition-all duration-200 hover:border-[#f97316] hover:text-[#f97316]"
                  type="button"
                >
                  Logga in
                </button>
                <button
                  onClick={() => router.push('/register')}
                  className="inline-flex h-11 items-center rounded-lg bg-[#f97316] px-6 text-base font-semibold text-white transition-all duration-200 hover:bg-orange-600"
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
                <a className="flex h-12 items-center px-4 text-base font-medium text-[#f97316] font-semibold rounded-lg bg-orange-50" href="#top" onClick={() => setMobileMenuOpen(false)}>Funktioner</a>
                <a className="flex h-12 items-center px-4 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-[#f97316] rounded-lg" href="/ny-hemsida-kontakt" onClick={() => setMobileMenuOpen(false)}>Kontakt</a>
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

        <section id="top" className="relative overflow-hidden pb-24 pt-20">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 md:grid-cols-2">
            <div>
              <h1 className="mb-8 text-[3.5rem] font-extrabold leading-[1.1] tracking-tight text-[#191c1e]">
                Ett digitalt <span className="text-[#f97316]">hjälpmedel</span> för APL.
              </h1>
              <p className="mb-12 max-w-lg text-lg leading-relaxed text-[#584237]">
                Byggt för att minska administration och göra APL tydligare för alla inblandade. En digital plattform
                som knyter samman skola och arbetsliv.
              </p>
            </div>

            <div className="relative flex items-center justify-center">
              <Image
                alt="APL-appen screenshot"
                className="h-auto w-full max-w-[680px] rounded-lg object-contain"
                src="/funktionsbild3.png"
                width={768}
                height={768}
                priority
                sizes="(max-width: 768px) 100vw, 680px"
              />

              <div className="absolute left-1/2 top-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f97316]/5 blur-3xl" />
            </div>
          </div>
        </section>

        <section className="pb-24">
          <RoleSection
            title="För Elev"
            intro="Allt du behöver under din APL, direkt i fickan. Få full koll på dina timmar och bedömningar utan pappersarbete."
            imageAlt="Elev vid byggarbetsplats med mobil"
            imageSrc="/funktionsbild5.png"
            icon="person"
            iconBg="bg-[#ffdbca]"
            iconColor="text-[#341100]"
            points={[
              {
                icon: 'check_circle',
                heading: 'Registrera timmar',
                text: 'Logga dina timmar med ett enkelt knapptryck direkt på plats. Dina timmar kopplas till de arbetsmoment läraren valt.',
              },
              {
                icon: 'dashboard',
                heading: 'Total översikt',
                text: 'Följ enkelt din statistik över arbetsmoment, bedömning och ersättning direkt i appen.',
              },
            ]}
          />

          <div className="bg-[#f2f4f6] py-8">
            <RoleSection
              reverse
              title="För Handledare"
              intro="För handledare gör APL-appen det smidigt att signera elevers tidkort, ersättning och bedömning - utan extra konton och krångel."
              imageAlt="Handledare diskuterar med mobil"
              imageSrc="/funktionsbild4.png"
              icon="assignment_ind"
              iconBg="bg-[#d3e4fe]"
              iconColor="text-[#0b1c30]"
              points={[
                {
                  icon: 'edit_document',
                  heading: 'Digital signering',
                  text: 'Signera via länk eller QR-kod.',
                },
                {
                  icon: 'chat_bubble',
                  heading: 'Direkt feedback',
                  text: 'Lämna omdömen och kommentarer kopplade till elevernas tidkort som direkt delas med läraren.',
                },
              ]}
            />
          </div>

          <RoleSection
            title="För Lärare"
            intro="Slipp jagandet efter papper. Få realtidsdata på alla dina elever och deras APL-platser."
            imageAlt="Lärare som arbetar i APL-systemet"
            imageSrc="/funktionsbild 6.png"
            icon="school"
            iconBg="bg-[#dae2fd]"
            iconColor="text-[#131b2e]"
            points={[
              {
                icon: 'insights',
                heading: 'Statistik och analys',
                text: 'Tydlig statistik över elevernas APL.',
              },
              {
                icon: 'summarize',
                heading: 'Automatiska rapporter',
                text: 'Exportera kompletta underlag för betygssättning och myndighetsrapportering.',
              },
            ]}
          />
        </section>

        <section className="mx-auto mb-24 max-w-7xl px-6">
          <div className="rounded-xl bg-[#f97316] p-16 text-center text-white">
            <h3 className="mb-6 text-4xl font-bold">Redo att modernisera er APL?</h3>
            <p className="mx-auto mb-10 max-w-2xl text-lg opacity-90">
              Testa gratis och upptäck fördelarna med APL-appen.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <button
                className="rounded-lg bg-white px-8 py-4 font-bold text-[#f97316] transition-colors hover:bg-[#f7f9fb]"
                onClick={() => router.push('/register')}
                type="button"
              >
                Skapa konto
              </button>
              <button
                className="rounded-lg border-2 border-white/30 px-8 py-4 font-bold text-white transition-colors hover:bg-white/10"
                onClick={() => router.push('/ny-hemsida-kontakt')}
                type="button"
              >
                Kontakta oss
              </button>
            </div>
          </div>
        </section>

        <footer className="w-full border-t border-slate-200 bg-slate-50 py-12 text-sm leading-relaxed">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-8 md:flex-row">
            <div className="text-lg font-bold text-slate-900">APL-appen</div>
            <div className="flex gap-8">
              <a className="text-slate-500 transition-colors hover:text-[#f97316] hover:underline" href="/ny-hemsida-faq">
                Integritetspolicy
              </a>
              <a className="text-slate-500 transition-colors hover:text-[#f97316] hover:underline" href="/ny-hemsida-faq">
                Användarvillkor
              </a>
              <a className="text-slate-500 transition-colors hover:text-[#f97316] hover:underline" href="/ny-hemsida-kontakt">
                Kontakt
              </a>
            </div>
            <p className="text-slate-500">© 2024 APL-appen. Alla rättigheter förbehållna.</p>
          </div>
        </footer>
      </main>
    </>
  );
}

function RoleSection({
  title,
  intro,
  imageAlt,
  imageSrc,
  icon,
  iconBg,
  iconColor,
  points,
  reverse,
}: {
  title: string;
  intro: string;
  imageAlt: string;
  imageSrc: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  points: Array<{ icon: string; heading: string; text: string }>;
  reverse?: boolean;
}) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className={['flex flex-col gap-8 md:flex-row md:items-stretch', reverse ? 'md:flex-row-reverse' : ''].join(' ')}>
        <div className="md:basis-[48%]">
          <div className="h-full rounded-lg bg-white p-10 shadow-sm">
            <div className={['mb-8 flex h-12 w-12 items-center justify-center rounded-lg', iconBg].join(' ')}>
              <span className={['material-symbols-outlined text-2xl', iconColor].join(' ')}>{icon}</span>
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#191c1e]">{title}</h2>
            <p className="mb-8 text-[#584237]">{intro}</p>
            <div className="space-y-4">
              {points.map((point) => (
                <div key={point.heading} className="flex gap-4">
                  <span className="material-symbols-outlined text-[#f97316]">{point.icon}</span>
                  <div>
                    <p className="font-bold">{point.heading}</p>
                    <p className="text-sm text-[#584237]">{point.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="md:basis-[52%]">
          <div className="h-full min-h-[360px] overflow-hidden rounded-lg bg-[#e6e8ea] md:min-h-[420px]">
            <img alt={imageAlt} className="block h-full w-full object-cover" src={imageSrc} />
          </div>
        </div>
      </div>
    </div>
  );
}