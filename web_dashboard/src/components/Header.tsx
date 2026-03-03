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
    return <div className="h-16 bg-[#1E293B] border-b border-gray-800"></div>;
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <header className="bg-[#1E293B] border-b border-gray-800 sticky top-0 z-40 shadow-2xl">
      <div className="h-16 flex items-center justify-between px-8">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">{userEmail}</span>
        </div>
        <button
          onClick={handleLogout}
          className="px-5 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#FF6A00]/90 transition font-medium text-sm shadow-[0_0_15px_rgba(255,106,0,0.3)] hover:shadow-[0_0_25px_rgba(255,106,0,0.5)]"
        >
          Logga ut
        </button>
      </div>
    </header>
  );
}
