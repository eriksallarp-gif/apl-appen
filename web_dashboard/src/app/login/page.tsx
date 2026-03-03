'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check user role in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await auth.signOut();
        setError('Användare hittades inte');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const role = userData.role;
      const status = userData.status || 'active';

      // Check if user account is frozen
      if (status === 'frozen') {
        await auth.signOut();
        setError('Ditt konto är fryst. Kontakta en administratör för att aktivera det igen.');
        setLoading(false);
        return;
      }

      // Only allow teachers and admins
      if (role !== 'teacher' && role !== 'admin') {
        await auth.signOut();
        setError('Endast lärare och administratörer kan logga in på webbplatsen');
        setLoading(false);
        return;
      }

      // Check if teacher is approved
      if (role === 'teacher' && !userData.approved) {
        await auth.signOut();
        setError('Ditt lärarkonto väntar på godkännande från en administratör');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError('Fel användarnamn eller lösenord');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF6A00]/5 to-transparent"></div>
      
      <div className="w-full max-w-md relative z-10 px-4">
        {/* Tillbaka-knapp */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-gray-400 hover:text-[#FF6A00] font-medium transition"
          >
            ← Tillbaka till startsidan
          </Link>
        </div>

        {/* Login-formulär */}
        <div className="bg-[#1E293B] p-8 rounded-2xl shadow-2xl border border-gray-800">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">APL-appen</h1>
            <p className="text-gray-400 text-sm">Lärare & administratörinloggning</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                E-post
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0F172A] border border-[#FF6A00]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent transition"
                placeholder="din@email.se"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lösenord
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0F172A] border border-[#FF6A00]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6A00] text-white py-3 rounded-lg font-semibold hover:bg-[#FF6A00]/90 transition disabled:opacity-50 shadow-[0_0_20px_rgba(255,106,0,0.3)] hover:shadow-[0_0_30px_rgba(255,106,0,0.5)]"
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#1E293B] text-gray-500">eller fortsätt med</span>
            </div>
          </div>

          {/* Info för elever */}
          <div className="pt-6 border-t border-gray-800">
            <p className="text-sm text-gray-400 mb-3">
              <strong className="text-white">Är du elev?</strong>
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Elever loggar in via APL-appen på sina mobiler.
            </p>
            <p className="text-xs text-gray-500">
              Kontakta din lärare om du behöver hjälp med registreringen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
