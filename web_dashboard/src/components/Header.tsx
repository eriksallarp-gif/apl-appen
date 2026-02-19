'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return <div className="h-20 bg-white border-b-4 border-orange-500"></div>;
  }

  return (
    <header className="bg-white border-b-4 border-orange-500 sticky top-0 z-50 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-orange-600 font-medium transition"
              >
                Dashboard
              </Link>
              {auth.currentUser && (
                <span className="text-gray-600 text-sm">
                  {auth.currentUser.email}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
              >
                Logga ut
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
              >
                Logga in
              </Link>
            </>
          )}
        </div>
        <Link href="/" className="flex items-center">
          <img
            src="/logo.png"
            alt="APL-appen"
            width={48}
            height={48}
            className="h-12 w-auto"
          />
        </Link>
      </nav>
    </header>
  );
}
