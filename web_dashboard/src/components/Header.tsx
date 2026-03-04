'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        setUserEmail(user.email || '');
      } else {
        setIsLoggedIn(false);
        setUserEmail('');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return <div className="h-16 bg-white border-b border-orange-200"></div>;
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <header className="bg-white border-b border-orange-200 sticky top-0 z-40 shadow-sm">
      <div className="h-16 flex items-center justify-between px-8">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">{userEmail}</span>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium text-sm"
        >
          Logga ut
        </button>
      </div>
    </header>
  );
}
