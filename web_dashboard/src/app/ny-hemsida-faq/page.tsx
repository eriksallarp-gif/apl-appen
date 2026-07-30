'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function NyHemsidaFaqPage() {
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

  useEffect(() => {
    const groups = Array.from(document.querySelectorAll<HTMLElement>('[data-accordion-group="single"]'));
    const cleanups: Array<() => void> = [];

    groups.forEach((group) => {
      const detailsElements = Array.from(group.querySelectorAll<HTMLDetailsElement>('details'));

      const handleToggle = (event: Event) => {
        const current = event.currentTarget as HTMLDetailsElement;
        if (!current.open) return;

        detailsElements.forEach((item) => {
          if (item !== current) {
            item.open = false;
          }
        });
      };

      detailsElements.forEach((item) => item.addEventListener('toggle', handleToggle));
      cleanups.push(() => detailsElements.forEach((item) => item.removeEventListener('toggle', handleToggle)));
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

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
              <a className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]" href="/ny-hemsida-kontakt">
                Kontakt
              </a>
              <a className="inline-flex h-10 items-center border-b-2 border-[#f97316] text-base font-semibold text-[#f97316]" href="#top">
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
                <a className="flex h-12 items-center px-4 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-[#f97316] rounded-lg" href="/ny-hemsida-kontakt" onClick={() => setMobileMenuOpen(false)}>Kontakt</a>
                <a className="flex h-12 items-center px-4 text-base font-medium text-[#f97316] font-semibold rounded-lg bg-orange-50" href="#top" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
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
          <h1 className="text-5xl font-extrabold tracking-tight text-[#191c1e]">Vanliga frågor</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#584237]">
            Snabb översikt av vanliga frågor om APL-appen.
          </p>

          <div className="mt-10 space-y-4" data-accordion-group="single">
            <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-base font-semibold text-slate-900">Måste handledaren ha ett konto?</summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Nej, signering sker via länk eller QR-kod beroende på ditt upplägg. 
                För att stärka signeringen innan appen har tillgång till mobilt bankID signerar handledaren bedömningen via SMS-verifiering.</p>
            </details>

            <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-base font-semibold text-slate-900">Använder både lärare och elever APL-appen?</summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Ja, men appen är främst avsedd för elever.</p>
            </details>

            <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-base font-semibold text-slate-900">Kan jag exportera data?</summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Ja, läraren kan exportera en sammanställning av elevernas tidkort och bedömningar.</p>
            </details>
          </div>

          <div className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[#191c1e]">Integritetspolicy</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Här visas information om hur vi hanterar din data och skyddar din integritet.{' '}
              <Link href="/integritet" className="font-semibold text-orange-700 hover:text-orange-800">
                Läs vår fullständiga integritetspolicy här.
              </Link>
            </p>

            <div className="mt-6 space-y-3" data-accordion-group="single">
              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">1. Inledning</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  APL-appen utvecklas för att hjälpa skolor, lärare och elever att hantera APL i ett säkert och enkelt arbetsflöde.
                  Vi värnar om din integritet och data.
                </p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">2. Vilken data samlar vi in?</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>Personuppgifter: namn, e-postadress, roll, skola och klasskoppling.</li>
                  <li>Innehåll: tidkort, kommentarer, bedömningar och statusuppdateringar.</li>
                  <li>Filer: bilder och dokument som laddas upp i APL-flöden.</li>
                  <li>Användningsdata: inloggningsaktivitet och appanvändning för säkerhet och felsökning.</li>
                </ul>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">3. Hur använder vi din data?</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>Appfunktionalitet: tidkorthantering, ersättning och bedömning.</li>
                  <li>Kontohantering: inloggning, behörigheter och rollbaserad åtkomst.</li>
                  <li>Säkerhet: skydda konton och förhindra missbruk.</li>
                  <li>Support: hjälp vid tekniska problem.</li>
                </ul>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">4. Hur skyddar vi din data?</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>All data krypteras vid överföring (HTTPS/TLS).</li>
                  <li>Säker backend via Firebase med autentisering och behörighetskontroller.</li>
                  <li>Rollbaserad åtkomst: du ser bara data du har rätt till.</li>
                  <li>Regelbundna säkerhetsgranskningar.</li>
                </ul>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">5. Delar vi din data med tredje part?</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Nej. Vi säljer eller delar inte din data med tredje part för marknadsföring eller annonsering.
                  Data behandlas i vår backend-infrastruktur (Firebase/Google Cloud) som en del av appens drift.
                </p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">6. Radera ditt konto och din data</summary>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>Öppna APL-appen och logga in.</li>
                  <li>Gå till Inställningar.</li>
                  <li>Välj Konto.</li>
                  <li>Tryck på "Radera mitt konto".</li>
                  <li>Bekräfta borttagningen.</li>
                  <li>Det går även att be din lärare att ta bort ditt konto.</li>
                </ol>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">OBS: När du raderar kontot tas all personlig data bort permanent och kan inte återställas.</p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">7. Hur länge sparar vi data?</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Data sparas så länge ditt konto är aktivt. När du raderar ditt konto tas all personlig data bort inom 30 dagar.
                </p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">8. Dina rättigheter</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>Få tillgång till din data.</li>
                  <li>Rätta felaktig data.</li>
                  <li>Radera ditt konto och din data.</li>
                </ul>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">9. Cookies och sparning</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  APL-appen använder sessionsbaserad autentisering via Firebase. Vi använder inte cookies för annonsering
                  eller sparning över webbplatser.
                </p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">10. Barn och unga</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Appen är avsedd för gymnasieelever och äldre. Om du är under 18 år rekommenderar vi att du diskuterar
                  användningen med vårdnadshavare.
                </p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">11. Ändringar i integritetspolicyn</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Vi kan uppdatera denna policy vid behov. Ändringar meddelas i appen eller via e-post.
                </p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">12. Kontakta oss</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Har du frågor om integritet eller vill utöva dina rättigheter?
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  E-post: <a href="mailto:support@aplappen.com" className="font-semibold text-orange-700 hover:text-orange-800">support@aplappen.com</a>
                </p>
                <p className="text-sm leading-relaxed text-slate-600">
                  Webbplats: <a href="https://www.apl-appen.com" className="font-semibold text-orange-700 hover:text-orange-800">www.apl-appen.com</a>
                </p>
              </details>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
