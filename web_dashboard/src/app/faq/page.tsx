'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function NyHemsidaFaqPage() {
  const router = useRouter();

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

        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>

      <main className="min-h-screen bg-[#f7f9fb] pt-20 text-[#191c1e]">
        <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm shadow-slate-200/20 backdrop-blur-lg">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
            <a href="/" className="flex items-center gap-3" aria-label="Till startsidan">
              <img
                src="https://lh3.googleusercontent.com/aida/ADBb0uhE7u61HkfDy3ZM79duWMs3rVcoP42aFJI56z9U0fKoNAkMo6U9z3w4ReABBGlKlAzHyUQf2AjK3IJ3xIlkrJ0zpePuKPVVpG9oyalsDE0yjzTa06nYAJACLoAF3Ks-xN1K3k0gI5EzxvRCs7k34wYxOW3HeBqL3wn9ZN-os3mRgb6C3vR-JKTZ1ukd-MCN9PFdOBVCbdLF-cGOyF9WhtTpo6nexEAB8WDW5GrwVydBcPNwpGW3eiGpFk4oJrgwY69DtSH1r0wNag"
                alt="APL-appen Logo"
                className="h-12 w-auto object-contain"
              />
              <div className="text-2xl font-black tracking-tighter text-slate-900">APL-appen</div>
            </a>

            <div className="hidden items-center gap-8 md:flex">
              <a className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]" href="/funktioner">
                Funktioner
              </a>
              <a className="inline-flex h-10 items-center border-b-2 border-transparent text-base font-medium text-slate-600 transition-colors hover:text-[#f97316]" href="/kontakt">
                Kontakt
              </a>
              <a className="inline-flex h-10 items-center border-b-2 border-[#f97316] text-base font-semibold text-[#f97316]" href="#top">
                FAQ
              </a>
            </div>

            <div className="flex items-center gap-3">
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
          </div>
        </nav>

        <section id="top" className="mx-auto max-w-5xl px-8 pb-20 pt-16">
          <h1 className="text-5xl font-extrabold tracking-tight text-[#191c1e]">Vanliga frågor</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#584237]">
            Snabb översikt av vanliga frågor om APL-appen.
          </p>

          <div className="mt-10 space-y-4" data-accordion-group="single">
            <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-base font-semibold text-slate-900">Måste handledaren ha ett konto?</summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Nej, signering kan ske via länk/QR beroende på ditt upplägg.</p>
            </details>

            <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-base font-semibold text-slate-900">Använder både lärare och elever APL-appen?</summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Ja, men appen är främst avsedd för elever.</p>
            </details>

            <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer text-base font-semibold text-slate-900">Kan jag exportera data?</summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Ja, tanken är att du ska kunna ta fram rapporter och sammanställningar.</p>
            </details>
          </div>

          <div className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[#191c1e]">Integritetspolicy</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Här visas information om hur vi hanterar din data och skyddar din integritet.</p>

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
                  <li>Appfunktionalitet: tidkorthantering, bedömningar och kommunikation.</li>
                  <li>Kontohantering: inloggning, behörigheter och rollbaserad åtkomst.</li>
                  <li>äkerhet: skydda konton och förhindra missbruk.</li>
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
                </ol>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">OBS: är du raderar kontot tas all personlig data bort permanent och kan inte återställas.</p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">7. Hur länge sparar vi data?</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Data sparas så länge ditt konto är aktivt. Är du raderar ditt konto tas all personlig data bort inom 30 dagar.
                </p>
              </details>

              <details className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-semibold text-slate-900">8. Dina rättigheter</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                  <li>FÅ tillgång till din data.</li>
                  <li>Ätta felaktig data.</li>
                  <li>Radera ditt konto och din data.</li>
                  <li>Begära dataportabilitet.</li>
                  <li>Återkalla samtycke när som helst.</li>
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
