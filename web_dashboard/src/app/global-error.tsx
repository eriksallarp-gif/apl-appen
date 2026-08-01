'use client';

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  return (
    <html lang="sv">
      <body className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_55%)] text-gray-900">
        <div className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">Applikationsfel</p>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">Dashboarden tappade sitt felgränssnitt</h1>
            <p className="mt-3 text-sm text-gray-600">
              Det här fångar upp fel när Next annars fastnar i en refresh-loop under lokal utveckling.
            </p>
            <div className="mt-6 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-gray-200">
              {error.message || 'Okänt fel'}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700"
              >
                Försök igen
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Ladda om sidan
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}