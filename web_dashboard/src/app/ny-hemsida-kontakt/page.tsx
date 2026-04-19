'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function NyHemsidaKontaktPage() {
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

        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>

      <main className="min-h-screen bg-[#f7f9fb] pt-20 text-[#191c1e]">
        <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm shadow-slate-200/20 backdrop-blur-lg">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
            <a href="/ny-hemsida-test" className="flex items-center gap-3" aria-label="Till startsidan">
              <img
                src="https://lh3.googleusercontent.com/aida/ADBb0uhE7u61HkfDy3ZM79duWMs3rVcoP42aFJI56z9U0fKoNAkMo6U9z3w4ReABBGlKlAzHyUQf2AjK3IJ3xIlkrJ0zpePuKPVVpG9oyalsDE0yjzTa06nYAJACLoAF3Ks-xN1K3k0gI5EzxvRCs7k34wYxOW3HeBqL3wn9ZN-os3mRgb6C3vR-JKTZ1ukd-MCN9PFdOBVCbdLF-cGOyF9WhtTpo6nexEAB8WDW5GrwVydBcPNwpGW3eiGpFk4oJrgwY69DtSH1r0wNag"
                alt="APL-appen Logo"
                className="h-12 w-auto object-contain"
              />
              <div className="text-2xl font-black tracking-tighter text-slate-900">APL-appen</div>
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
