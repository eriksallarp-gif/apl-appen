'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent mb-6">
          Välkommen till APL-appen
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          APL (Arbetsplatsförlagt lärande) är en väsentlig del av gymnasieutbildningen. 
          APL-appen hjälper dig att hålla koll på dina arbetsplatsförlagda studier, 
          registrera dina timmar och hantera all administrativ information på ett enkelt sätt.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white rounded-lg shadow-md p-8 border-t-4 border-orange-500 hover:shadow-lg transition">
            <div className="text-4xl mb-4">⏱️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Registrera Timmar</h3>
            <p className="text-gray-600">
              Enkelt registrera dina arbetade timmar direkt i systemet
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 border-t-4 border-orange-500 hover:shadow-lg transition">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Översikt</h3>
            <p className="text-gray-600">
              Få en tydlig överblick över dina timmar och ersättningar
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8 border-t-4 border-orange-500 hover:shadow-lg transition">
            <div className="text-4xl mb-4">👨‍🏫</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Lärarvyn</h3>
            <p className="text-gray-600">
              Lärare kan enkelt administrera sina elever och bedömningar
            </p>
          </div>
        </div>

        {/* What is APL */}
        <div className="mt-20 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-10 max-w-2xl mx-auto border-l-4 border-orange-600">
          <h3 className="text-2xl font-bold text-orange-900 mb-4">Vad är APL?</h3>
          <p className="text-gray-700 text-left">
            APL (Arbetsplatsförlagt lärande) är en del av gymnasieprogrammen där elever får 
            möjlighet att lära genom praktisk arbete på en arbetsplats. Det är ett sätt att 
            kombinera teoretiska studier med verklig arbetsupplevelse och ger eleverna värdefulla 
            kunskaper och erfarenheter från arbetsliv.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-orange-900 to-orange-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-orange-200">© 2026 APL-appen. Alla rättigheter förbehållna.</p>
        </div>
      </footer>
    </main>
  );
}
