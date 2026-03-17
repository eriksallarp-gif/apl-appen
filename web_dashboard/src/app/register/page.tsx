'use client';

import Link from 'next/link';
import RegisterForm from '@/components/RegisterForm';

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8 lg:py-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 right-[-8%] h-[380px] w-[380px] rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute bottom-[-100px] left-[-12%] h-[340px] w-[340px] rounded-full bg-orange-100/70 blur-3xl" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <section className="flex w-full max-w-lg flex-col lg:min-h-[calc(100vh-5rem)]">
          <Link href="/" className="inline-flex text-sm font-medium text-orange-700 hover:text-orange-800">
            ← Tillbaka till startsidan
          </Link>

          <div className="flex flex-1 items-center">
            <div className="space-y-4">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Skapa ditt konto och börja hantera APL direkt
              </h2>
              <p className="text-base leading-relaxed text-slate-600">
                När kontot är skapat och godkänt av administratören får du tillgång till dashboard, klasshantering och elevuppföljning i samma system
                som mobilappen.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full lg:max-w-xl">
          <RegisterForm />
        </section>
      </div>
    </main>
  );
}