'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from "next/image";

import {
  ArrowRight,
  Check,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  QrCode,
  School,
  User,
  Users,
} from 'lucide-react';

type AudienceKey = 'elev' | 'handledare' | 'larare';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.push('/dashboard');
    });
    return () => unsub();
  }, [router]);

  const [audience, setAudience] = useState<AudienceKey>('elev');

  const audienceContent = useMemo(() => {
    if (audience === 'elev') {
      return {
        title: 'För elever blir APL-appen ett enkelt sätt att registrera tid och få en överblick på ersättning och bedömning.',
        bullets: [
          'Registrera timmar enkelt i mobilen.',
          'Få överblick över ersättning och bedömning.',
          'Anpassad för yrkeselever.',
        ],
        icon: <User className="h-5 w-5" />,
      };
    }
    if (audience === 'handledare') {
      return {
        title: 'För handledare gör APL-appen det smidigt att signera elevers tidkort, ersättning och bedömning – utan extra konton eller krångel.',
        bullets: [
          'Signera via länk eller QR-kod.',
  
          'Lämna kommentarer kopplade till bedömning.',
        ],
        icon: <Users className="h-5 w-5" />,
      };
    }
    return {
      title: 'För lärare ger APL-appen en tydlig översikt över elevens APL.',
      bullets: [
        'Tydlig statistik över elevens APL.',
        'Följ timmar, ersättning och bedömningar.',
        'Exportera och sammanställ rapporter snabbt.',
      ],
      icon: <School className="h-5 w-5" />,
    };
  }, [audience]);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Subtle background accents */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute top-[35%] left-[-10%] h-[360px] w-[360px] rounded-full bg-orange-100/60 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end px-4 py-4 sm:px-6 lg:px-8 md:justify-between">

          <nav className="hidden items-center gap-6 text-sm text-slate-700 md:mr-auto md:flex">
            <a href="#funktioner" className="hover:text-slate-900">
              Funktioner
            </a>
            <a href="#for-larare" className="hover:text-slate-900">
              För lärare
            </a>
            <a href="#faq" className="hover:text-slate-900">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/login')}
              className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 sm:inline-flex"
            >
              Logga in
            </button>
            <button
              onClick={() => router.push('/signup')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
            >
              Kom igång <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center"
              aria-label="Gå till startsidan"
            >
              <Image
                src="/logo1.png"
                alt="APL-appen logotyp"
                width={160}
                height={160}
                className="h-40 w-40 object-contain"
              />
            </button>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Håll koll på APL – timmar, ersättning och bedömning.
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Enkel och effektiv hantering av arbetsplatsförlagda timmar och bedömningar – för elever,
              handledare och lärare.
            </p>

            <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
              <Check className="h-4 w-4 text-orange-600" />
              För elever, handledare och lärare
            </div>
          </div>

          {/* Dashboard mock */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                    <Image
                      src="/logo1.png"
                      alt="APL-appen logotyp"
                      width={36}
                      height={36}
                      className="h-9 w-9 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">APL-appen</p>
                    <p className="text-xs text-slate-500">Exempelvy</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  Vecka 22
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-500">Rapporterade timmar</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">252</p>
                  <p className="mt-1 text-xs text-slate-500">Senaste 8 veckorna</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-500">Ersättning</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">12 luncher och 22 km</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Aktivitet</p>
                </div>
                <ul className="divide-y divide-slate-200 text-sm">
                  <li className="flex items-center justify-between px-4 py-3">
                    <span className="text-slate-700">Bedömning inskickad</span>
                    <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">
                      Väntar
                    </span>
                  </li>
                  <li className="flex items-center justify-between px-4 py-3">
                    <span className="text-slate-700">Timmar registrerade</span>
                    <span className="text-xs text-slate-500">40</span>
                  </li>
                  <li className="flex items-center justify-between px-4 py-3">
                    <span className="text-slate-700">Handledarsignering</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      Klar
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pointer-events-none absolute -bottom-6 -left-6 hidden h-24 w-24 rounded-2xl bg-orange-100/60 blur-xl lg:block" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funktioner" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm font-medium text-orange-700">Funktioner</p>
          <h2 className="text-3xl font-semibold tracking-tight">Allt du behöver – i app eller på webben</h2>
          <p className="max-w-2xl text-slate-600">
            Byggt för att minska administration och göra APL tydligare för alla inblandade.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Clock className="h-5 w-5 text-orange-600" />}
            title="Registrera timmar enkelt"
            desc="Logga arbetad tid smidigt och följ utvecklingen vecka för vecka."
          />
          <FeatureCard
            icon={<ClipboardList className="h-5 w-5 text-orange-600" />}
            title="Enkel hantering av ersättning"
            desc="Sammanställ ersättning baserat på godkända veckor."
          />
          <FeatureCard
            icon={<School className="h-5 w-5 text-orange-600" />}
            title="Läraröversikt per klass"
            desc="Se elever, status och bedömningar tydligt i en och samma vy."
          />
          <FeatureCard
            icon={<QrCode className="h-5 w-5 text-orange-600" />}
            title="Handledarsignering via länk/QR"
            desc="Handledaren signerar tidkort och ersättning – utan extra konton och krångel."
          />
          <FeatureCard
            icon={<FileText className="h-5 w-5 text-orange-600" />}
            title="Bedömning med bilder & kommentarer"
            desc="Dokumentera APL med bild, självskattning och handledarfeedback."
          />
          <FeatureCard
            icon={<LayoutDashboard className="h-5 w-5 text-orange-600" />}
            title="Export & rapporter"
            desc="Skapa sammanställningar när du behöver, för uppföljning och rapportering."
          />
        </div>
      </section>

      {/* Audience tabs */}
      <section id="for-larare" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex flex-col gap-2">

            <h2 className="text-3xl font-semibold tracking-tight">För vem är APL-appen?</h2>
            <p className="max-w-2xl text-slate-600">
              Anpassad för elev, handledare och lärare – skapad för att förenkla.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <TabButton active={audience === 'elev'} onClick={() => setAudience('elev')}>
              Elev
            </TabButton>
            <TabButton active={audience === 'handledare'} onClick={() => setAudience('handledare')}>
              Handledare
            </TabButton>
            <TabButton active={audience === 'larare'} onClick={() => setAudience('larare')}>
              Lärare
            </TabButton>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 ring-1 ring-orange-100">
                {audienceContent.icon}
                {audience === 'elev' ? 'Elev' : audience === 'handledare' ? 'Handledare' : 'Lärare'}
              </div>

              <p className="mt-4 text-lg font-semibold text-slate-900">{audienceContent.title}</p>

              <ul className="mt-4 space-y-3 text-slate-700">
                {audienceContent.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-orange-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

            </div>

            <div className="relative">
              <div className="relative h-72 overflow-hidden rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100">
                <Image
                  src={
                    audience === 'elev'
                      ? '/elev.png'
                      : audience === 'handledare'
                      ? '/elev-handledare.png'
                      : '/larare.png'
                  }
                  alt={
                    audience === 'elev'
                      ? 'Förhandsvisning av elevvy i APL-appen'
                      : audience === 'handledare'
                      ? 'Förhandsvisning av handledarvy i APL-appen'
                      : 'Förhandsvisning av lärarvy i APL-appen'
                  }
                  fill
                  className="object-contain p-4"
                />
              </div>

              <div className="pointer-events-none absolute -right-6 -top-6 hidden h-24 w-24 rounded-2xl bg-orange-100/60 blur-xl lg:block" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="border-t border-slate-200 pt-10">
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <div className="mt-6 grid gap-3">
            <FaqItem q="Måste handledaren ha ett konto?" a="Nej, signering kan ske via länk/QR beroende på ditt upplägg." />
            <FaqItem q="Funkar det för både elever och lärare?" a="Ja, appen och webben kan ge olika vyer beroende på roll." />
            <FaqItem q="Kan jag exportera data?" a="Ja, tanken är att du ska kunna ta fram rapporter och sammanställningar." />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pb-2 pt-1 text-sm text-slate-600 sm:px-6 lg:px-8">
          <div className="flex items-center text-slate-900">
            <Image
              src="/logo.png"
              alt="APL-appen logotyp"
              width={120}
              height={120}
              className="h-[120px] w-[120px] object-contain"
            />
          </div>
          <p>© {new Date().getFullYear()} APL-appen. Alla rättigheter förbehållna.</p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full px-4 py-2 text-sm font-semibold transition',
        active
          ? 'bg-orange-600 text-white shadow-sm'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
      ].join(' ')}
      type="button"
    >
      {children}
    </button>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
        <div className="flex items-center justify-between">
          <span>{q}</span>
          <span className="ml-4 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">+</span>
        </div>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
    </details>
  );
}