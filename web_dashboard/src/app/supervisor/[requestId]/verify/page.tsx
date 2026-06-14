'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

export default function SupervisorVerificationPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const requestId = params.requestId as string;
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [expiresAtMillis, setExpiresAtMillis] = useState<number | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    void loadState();
  }, [requestId, token]);

  const expiresInSeconds = useMemo(() => {
    if (!expiresAtMillis) return null;
    const seconds = Math.floor((expiresAtMillis - Date.now()) / 1000);
    return Math.max(0, seconds);
  }, [expiresAtMillis]);

  const loadState = async () => {
    if (!token) {
      setError('Ogiltig länk - token saknas.');
      setLoading(false);
      return;
    }

    try {
      const stateCallable = httpsCallable(functions, 'getSupervisorVerificationState');
      const result = await stateCallable({ requestId, token });
      const payload = (result.data || {}) as {
        phoneMasked?: string;
        otpAttemptsLeft?: number;
        otpExpiresAtMillis?: number | null;
      };

      setMaskedPhone(payload.phoneMasked || 'okant nummer');
      setAttemptsLeft(typeof payload.otpAttemptsLeft === 'number' ? payload.otpAttemptsLeft : null);
      setExpiresAtMillis(typeof payload.otpExpiresAtMillis === 'number' ? payload.otpExpiresAtMillis : null);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunde inte ladda verifieringsstatus.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const normalizedCode = code.replace(/\D/g, '');
    if (normalizedCode.length !== 6) {
      setError('Koden måste vara 6 siffror.');
      return;
    }

    try {
      setSubmitting(true);
      const verifyCallable = httpsCallable(functions, 'verifySupervisorAssessmentOtp');
      await verifyCallable({ requestId, token, code: normalizedCode });
      setVerified(true);
      setSuccessMessage('Bedömningen är nu verifierad och inskickad. Tack!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunde inte verifiera kod.';
      setError(message);
      await loadState();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccessMessage('');
    try {
      setResending(true);
      const resendCallable = httpsCallable(functions, 'resendSupervisorAssessmentOtp');
      await resendCallable({ requestId, token });
      setSuccessMessage('Ny SMS-kod skickad.');
      await loadState();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunde inte skicka ny kod.';
      setError(message);
    } finally {
      setResending(false);
    }
  };

  const handleCancelAndBack = async () => {
    setError('');
    try {
      setCancelling(true);
      const cancelCallable = httpsCallable(functions, 'cancelSupervisorAssessmentVerification');
      await cancelCallable({ requestId, token });
      router.push(`/supervisor/${requestId}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunde inte avbryta verifieringen.';
      setError(message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-b-4 border-orange-600"></div>
          <p className="text-lg font-medium text-gray-700">Laddar verifiering...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Verifiera med SMS-kod</h1>
        <p className="mb-6 text-sm text-gray-600">
          Bedömningen är sparad som väntande verifiering. Ange koden som skickats till {maskedPhone}.
        </p>

        {expiresInSeconds !== null && (
          <p className="mb-2 text-sm text-gray-600">Koden går ut om cirka {expiresInSeconds} sekunder.</p>
        )}
        {attemptsLeft !== null && (
          <p className="mb-6 text-sm text-gray-600">Försök kvar: {attemptsLeft}</p>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
        {successMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{successMessage}</div>
        )}

        {!verified && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-800">SMS-kod (6 siffror)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg tracking-[0.35em] focus:border-orange-500 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-bold text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
            >
              {submitting ? 'Verifierar...' : 'Verifiera och skicka bedömning'}
            </button>
          </form>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={verified || resending}
            className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {resending ? 'Skickar ny kod...' : 'Skicka ny kod'}
          </button>
          <button
            type="button"
            onClick={handleCancelAndBack}
            disabled={cancelling}
            className="rounded-lg border border-orange-300 px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-60"
          >
            {cancelling ? 'Avbryter...' : 'Byt mobilnummer'}
          </button>
        </div>
      </div>
    </div>
  );
}
