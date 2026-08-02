"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { Home, Users, Calendar, School, Clock, ClipboardCheck, ListTodo, FileText, Settings, UserCog, Layers } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [userEmail, setUserEmail] = React.useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    // Get user role from Firestore
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      import('@/lib/firebase').then(({ auth, db }) => {
        import('firebase/firestore').then(({ doc, getDoc }) => {
          onAuthStateChanged(auth, async (user) => {
            if (user) {
              setUserEmail(user.email || '');
              const userDoc = await getDoc(doc(db, 'users', user.uid));
              setUserRole(userDoc.exists() ? userDoc.data().role : null);
            } else {
              setUserEmail('');
              setUserRole(null);
            }
          });
        });
      });
    });
  }, []);

  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher';
  const roleLabel = isAdmin ? 'Admin' : 'Lärare';

  // Menystruktur: visa rätt länkar beroende på roll
  const menuItems = isAdmin
    ? [
        { href: '/dashboard', label: 'Hem', icon: Home, match: (p: string) => p === '/dashboard', bold: true },
        { href: '/dashboard/students', label: 'Elever', icon: Users, match: (p: string) => p.startsWith('/dashboard/students') },
        { href: '/dashboard/schools', label: 'Skolor', icon: School, match: (p: string) => p.startsWith('/dashboard/schools') },
        { href: '/dashboard/admin', label: 'Lärare', icon: UserCog, match: (p: string) => p.startsWith('/dashboard/admin') },
        { href: '/dashboard/programs', label: 'Program', icon: Layers, match: (p: string) => p.startsWith('/dashboard/programs') },
        { href: '/dashboard/tidkort', label: 'Tidkort', icon: Clock, match: (p: string) => p.startsWith('/dashboard/tidkort') },
        { href: '/dashboard/bedomning', label: 'Bedömning', icon: ClipboardCheck, match: (p: string) => p.startsWith('/dashboard/bedomning') },
        { href: '/dashboard/settings', label: 'Inställningar', icon: Settings, match: (p: string) => p === '/dashboard/settings' || p.startsWith('/dashboard/settings/') },
      ]
    : [
        { href: '/dashboard', label: 'Hem', icon: Home, match: (p: string) => p === '/dashboard', bold: true },
        { href: '/dashboard/students', label: 'Elever', icon: Users, match: (p: string) => p.startsWith('/dashboard/students') },
        ...(isTeacher ? [
          { href: '/dashboard/veckohanterare', label: 'Veckohanterare', icon: Calendar, match: (p: string) => p.startsWith('/dashboard/veckohanterare') },
          { href: '/dashboard/klasser', label: 'Klasser', icon: School, match: (p: string) => p.startsWith('/dashboard/klasser') },
          { href: '/dashboard/tidkort', label: 'Tidkort', icon: Clock, match: (p: string) => p.startsWith('/dashboard/tidkort') },
          { href: '/dashboard/bedomning', label: 'Bedömning', icon: ClipboardCheck, match: (p: string) => p.startsWith('/dashboard/bedomning') },
          { href: '/dashboard/assignments', label: 'Uppgifter', icon: ListTodo, match: (p: string) => p.startsWith('/dashboard/assignments') },
        ] : []),
        {
          href: '/dashboard/documents',
          label: 'Dokument',
          icon: FileText,
          match: (p: string) =>
            p.startsWith('/dashboard/documents') || p.startsWith('/dashboard/companies'),
        },
        { href: '/dashboard/settings', label: 'Inställningar', icon: Settings, match: (p: string) => p === '/dashboard/settings' || p.startsWith('/dashboard/settings/') },
      ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  if (!userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">Laddar meny...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100">
      <Sidebar
        pathname={pathname}
        menuItems={menuItems}
        roleLabel={roleLabel}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="lg:pl-[280px]">
        <Topbar
          userEmail={userEmail}
          onLogout={handleLogout}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
