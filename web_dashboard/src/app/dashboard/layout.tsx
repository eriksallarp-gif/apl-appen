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
    <div className="min-h-screen bg-[#0F172A]">
      <Header />
      <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-56 bg-[#1E293B] border-r border-gray-800 flex flex-col py-8 px-6 z-10 shadow-xl">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white">APL-appen</h1>
          <p className="text-xs text-[#FF6A00] mt-1">{isAdmin ? 'Admin' : 'Lärare'}</p>
        </div>
        <nav className="flex-1 space-y-2">
          {menuItems.map(item => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-4 py-3 transition ${item.bold ? 'font-semibold' : 'font-medium'} ${active ? 'bg-[#FF6A00]/20 text-[#FF6A00] shadow-[0_0_15px_rgba(255,106,0,0.2)]' : 'text-gray-400 hover:bg-[#FF6A00]/10 hover:text-[#FF6A00]'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="ml-56 mt-16 max-w-7xl mx-auto px-8 py-12">
        {children}
      </main>
    </div>
  );
}
