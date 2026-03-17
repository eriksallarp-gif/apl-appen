'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function mapVerificationError(error: unknown): string {
  const authError = error as { code?: string; message?: string };

  switch (authError?.code) {
    case 'auth/too-many-requests':
      return 'För många försök att skicka verifieringsmejl. Vänta en stund och försök igen.';
    case 'auth/network-request-failed':
      return 'Nätverksfel när verifieringsmejlet skulle skickas.';
    default:
      return authError?.message || 'Verifieringsmejlet kunde inte skickas.';
  }
}

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

      if (role === 'teacher' && !user.emailVerified) {
        let verificationMessage = 'Du måste verifiera din e-post först. Ett nytt verifieringsmejl har skickats. Kontrollera även skräppost.';

        try {
          await sendEmailVerification(user);
        } catch (verificationError) {
          console.error('Resend verification error:', verificationError);
          verificationMessage = `Du måste verifiera din e-post först, men verifieringsmejlet kunde inte skickas automatiskt. ${mapVerificationError(verificationError)}`;
        }

        await auth.signOut();
        setError(verificationMessage);
        setLoading(false);
        return;
      }

      // Check if teacher is approved
      if (role === 'teacher' && !userData.approved) {
        await auth.signOut();
        setError('Din e-post är verifierad men lärarkontot väntar fortfarande på godkännande från en administratör.');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="w-full max-w-96">
        {/* Tillbaka-knapp */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-orange-600 hover:text-orange-700 font-medium transition"
          >
            ← Tillbaka till startsidan
          </Link>
        </div>

        {/* Login-formulär */}
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-orange-600 mb-2">APL-appen</h1>
            <p className="text-gray-600 text-sm">Lärare & administratörinloggning</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-post
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="din@email.se"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lösenord
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50"
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
          </form>

          {/* Info för elever */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3">
              <strong>Är du elev?</strong>
            </p>
            <p className="text-sm text-gray-600 mb-4">
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
