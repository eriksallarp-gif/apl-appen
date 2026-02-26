"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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
  const menuItems = [
    { href: '/dashboard', label: 'Hem', match: (p: string) => p === '/dashboard', bold: true },
    { href: '/dashboard/students', label: 'Elever', match: (p: string) => p.startsWith('/dashboard/students') },
    // Veckohantering och Klasser för lärare
    ...(isTeacher ? [
      { href: '/dashboard/veckohanterare', label: 'Veckohanterare', match: (p: string) => p.startsWith('/dashboard/veckohanterare') },
      { href: '/dashboard/klasser', label: 'Klasser', match: (p: string) => p.startsWith('/dashboard/klasser') },
    ] : []),
    { href: '/dashboard/companies', label: 'Företag', match: (p: string) => p.startsWith('/dashboard/companies') },
    { href: '/dashboard/documents', label: 'Dokument', match: (p: string) => p.startsWith('/dashboard/documents') },
    // Skolor endast för admin
    ...(isAdmin ? [{ href: '/dashboard/schools', label: 'Skolor', match: (p: string) => p.startsWith('/dashboard/schools') }] : []),
    // Lärare endast för admin
    ...(isAdmin ? [{ href: '/dashboard/admin', label: 'Lärare', match: (p: string) => p.startsWith('/dashboard/admin') }] : []),
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
      <aside className="fixed left-0 top-0 h-screen w-56 bg-gradient-to-br from-orange-50 to-white border-r border-orange-100/50 flex flex-col py-8 px-6 z-10">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-orange-600">APL-appen</h1>
          <p className="text-xs text-orange-400 mt-1">Hem</p>
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
        <div className="mt-auto pt-8">
          <button onClick={async () => { await signOut(auth); window.location.href = '/login'; }} className="w-full bg-orange-600 text-white rounded-lg py-2 font-semibold hover:bg-orange-700 transition">Logga ut</button>
        </div>
      </aside>
      <main className="ml-56 max-w-7xl mx-auto px-8 py-12">
        {children}
      </main>
    </div>
  );
}
