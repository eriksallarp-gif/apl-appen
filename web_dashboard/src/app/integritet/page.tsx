import Link from 'next/link';

export default function IntegritetPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/ny-hemsida-faq" className="text-sm font-semibold text-orange-700 hover:text-orange-800">
          ← Tillbaka till FAQ-sidan
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Integritetspolicy</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          APL-appen behandlar personuppgifter för att kunna tillhandahålla tjänsten, hantera inloggning, skydda konton och stödja skolors arbete med APL.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Vilka uppgifter behandlas?</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Vi kan behandla namn, e-postadress, skola, klass, roll, innehåll såsom bedömningar och kommentarer samt uppgifter som behövs för säkerhets- och supportändamål.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Cookies och sessioner</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Vi använder sessionsbaserad autentisering för att skydda inloggningen. Vi använder också en enkel cookie för att spara ditt samtycke till cookies. Ingen reklam- eller spårningscookie används.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Dina rättigheter</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Du har rätt att begära tillgång till, rättelse eller radering av dina uppgifter. Kontakta oss på support@aplappen.com om du vill göra det.
        </p>
      </div>
    </main>
  );
}
