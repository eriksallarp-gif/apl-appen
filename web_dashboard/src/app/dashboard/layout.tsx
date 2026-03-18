"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import Header from '@/components/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userRole, setUserRole] = React.useState<string | null>(null);
  React.useEffect(() => {
    // Get user role from Firestore
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      import('@/lib/firebase').then(({ auth, db }) => {
        import('firebase/firestore').then(({ doc, getDoc }) => {
          onAuthStateChanged(auth, async (user) => {
            if (user) {
              const userDoc = await getDoc(doc(db, 'users', user.uid));
              setUserRole(userDoc.exists() ? userDoc.data().role : null);
            } else {
              setUserRole(null);
            }
          });
        });
      });
    });
  }, []);

  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher';

  // Menystruktur: visa rätt länkar beroende på roll
  const menuItems = isAdmin
    ? [
        { href: '/dashboard', label: 'Hem', match: (p: string) => p === '/dashboard', bold: true },
        { href: '/dashboard/students', label: 'Elever', match: (p: string) => p.startsWith('/dashboard/students') },
        { href: '/dashboard/schools', label: 'Skolor', match: (p: string) => p.startsWith('/dashboard/schools') },
        { href: '/dashboard/admin', label: 'Lärare', match: (p: string) => p.startsWith('/dashboard/admin') },
        { href: '/dashboard/settings', label: 'Inställningar', match: (p: string) => p === '/dashboard/settings' || p.startsWith('/dashboard/settings/') },
      ]
    : [
        { href: '/dashboard', label: 'Hem', match: (p: string) => p === '/dashboard', bold: true },
        { href: '/dashboard/students', label: 'Elever', match: (p: string) => p.startsWith('/dashboard/students') },
        ...(isTeacher ? [
          { href: '/dashboard/veckohanterare', label: 'Veckohanterare', match: (p: string) => p.startsWith('/dashboard/veckohanterare') },
          { href: '/dashboard/klasser', label: 'Klasser', match: (p: string) => p.startsWith('/dashboard/klasser') },
        ] : []),
        { href: '/dashboard/companies', label: 'Företag', match: (p: string) => p.startsWith('/dashboard/companies') },
        { href: '/dashboard/documents', label: 'Dokument', match: (p: string) => p.startsWith('/dashboard/documents') },
        { href: '/dashboard/settings', label: 'Inställningar', match: (p: string) => p === '/dashboard/settings' || p.startsWith('/dashboard/settings/') },
      ];

  if (!userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Laddar meny...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="sticky top-16 z-30 border-b border-orange-100 bg-white/95 backdrop-blur lg:hidden">
        <nav className="flex items-center gap-2 overflow-x-auto px-4 py-3">
          {menuItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${item.bold ? 'font-semibold' : 'font-medium'} ${active ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300' : 'bg-white text-gray-600 ring-1 ring-orange-100 hover:bg-orange-50'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-56 flex-col border-r border-orange-100/50 bg-gradient-to-br from-orange-50 to-white px-6 py-8 lg:flex">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-orange-600">APL-appen</h1>
          <p className="text-xs text-orange-400 mt-1">{isAdmin ? 'Admin' : 'Lärare'}</p>
        </div>
        <nav className="flex-1 space-y-4">
          {menuItems.map(item => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 transition ${item.bold ? 'font-semibold' : 'font-medium'} ${active ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="mt-16 lg:pl-56">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
