'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import {
  AuthError,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';

type RegisterFormState = {
  firstName: string;
  lastName: string;
  password: string;
  email: string;
  mobileNumber: string;
  school: string;
  program: string;
};

type SchoolOption = {
  id: string;
  name: string;
};

type ProgramOption = {
  id: string;
  name: string;
};

const DEFAULT_PROGRAMS: ProgramOption[] = [
  { id: 'Barn- och fritidsprogrammet', name: 'Barn- och fritidsprogrammet' },
  { id: 'Bygg- och anläggningsprogrammet', name: 'Bygg- och anläggningsprogrammet' },
  { id: 'El- och energiprogrammet', name: 'El- och energiprogrammet' },
  { id: 'Fordons- och transportprogrammet', name: 'Fordons- och transportprogrammet' },
  { id: 'Försäljning- och serviceprogrammet', name: 'Försäljning- och serviceprogrammet' },
  { id: 'Industritekniska programmet', name: 'Industritekniska programmet' },
  { id: 'Restaurang- och livsmedelsprogrammet', name: 'Restaurang- och livsmedelsprogrammet' },
  { id: 'Vård- och omsorgsprogrammet', name: 'Vård- och omsorgsprogrammet' },
  { id: 'VVS- och fastighetsprogrammet', name: 'VVS- och fastighetsprogrammet' },
];

const INITIAL_FORM: RegisterFormState = {
  firstName: '',
  lastName: '',
  password: '',
  email: '',
  mobileNumber: '',
  school: '',
  program: '',
};

function parseProgramOptions(rawPrograms: unknown): ProgramOption[] {
  if (!Array.isArray(rawPrograms)) {
    return DEFAULT_PROGRAMS;
  }

  const parsed = rawPrograms
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      id: String(entry.name ?? '').trim(),
      name: String(entry.name ?? '').trim(),
    }))
    .filter((program) => program.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));

  return parsed.length > 0 ? parsed : DEFAULT_PROGRAMS;
}

function mapAuthError(error: unknown): string {
  const authError = error as AuthError;

  switch (authError?.code) {
    case 'auth/email-already-in-use':
      return 'Den här e-postadressen används redan av ett annat konto.';
    case 'auth/invalid-email':
      return 'E-postadressen är inte giltig.';
    case 'auth/weak-password':
      return 'Lösenordet är för svagt. Använd minst 6 tecken.';
    case 'auth/network-request-failed':
      return 'Nätverksfel. Kontrollera din anslutning och försök igen.';
    default:
      return authError?.message || 'Kunde inte skapa konto just nu. Försök igen.';
  }
}

function mapVerificationError(error: unknown): string {
  const authError = error as AuthError;

  switch (authError?.code) {
    case 'auth/too-many-requests':
      return 'För många försök på kort tid. Vänta en stund och försök skicka verifieringsmejlet igen.';
    case 'auth/user-token-expired':
      return 'Sessionen gick ut innan verifieringsmejlet kunde skickas. Försök logga in igen för att skicka ett nytt mejl.';
    case 'auth/network-request-failed':
      return 'Nätverksfel när verifieringsmejlet skulle skickas. Försök igen om en stund.';
    default:
      return authError?.message || 'Verifieringsmejlet kunde inte skickas automatiskt.';
  }
}

export default function RegisterForm() {
  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadSchools = async () => {
      try {
        setSchoolsLoading(true);
        const schoolsQuery = query(collection(db, 'schools'), orderBy('name'));
        const schoolsSnapshot = await getDocs(schoolsQuery);
        setSchools(
          schoolsSnapshot.docs
            .map((schoolDoc) => ({
              id: schoolDoc.id,
              name: (schoolDoc.data().name ?? '').toString().trim(),
            }))
            .filter((school) => school.name.length > 0),
        );
      } catch (loadError) {
        setError('Kunde inte hämta skolor. Försök igen om en stund.');
        console.error('School load error:', loadError);
      } finally {
        setSchoolsLoading(false);
      }
    };

    void loadSchools();
  }, []);

  useEffect(() => {
    const loadPrograms = async () => {
      try {
        setProgramsLoading(true);
        const catalogDoc = await getDoc(doc(db, 'appSettings', 'programCatalog'));
        const rawPrograms = catalogDoc.exists() ? catalogDoc.data()?.programs : [];
        setPrograms(parseProgramOptions(rawPrograms));
      } catch (loadError) {
        setPrograms(DEFAULT_PROGRAMS);
        console.error('Program load error:', loadError);
      } finally {
        setProgramsLoading(false);
      }
    };

    void loadPrograms();
  }, []);

  const trimmedFirstName = useMemo(() => form.firstName.trim(), [form.firstName]);
  const trimmedLastName = useMemo(() => form.lastName.trim(), [form.lastName]);
  const trimmedFullName = useMemo(
    () => `${trimmedFirstName} ${trimmedLastName}`.trim(),
    [trimmedFirstName, trimmedLastName],
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!trimmedFirstName || !trimmedLastName || !form.password || !form.email.trim() || !form.mobileNumber.trim() || !form.school.trim() || !form.program.trim()) {
      setError('Fyll i alla fält för att skapa ett konto.');
      return;
    }

    if (schools.length === 0) {
      setError('Det finns inga skolor att välja mellan ännu. Lägg till en skola först.');
      return;
    }

    if (programs.length === 0) {
      setError('Det finns inga program att välja mellan ännu. Lägg till ett program först.');
      return;
    }

    setLoading(true);

    try {
      const email = form.email.trim().toLowerCase();
      const mobileNumber = form.mobileNumber.trim();
      const school = form.school.trim();
      const program = form.program.trim();
      let verificationErrorMessage = '';

      const credential = await createUserWithEmailAndPassword(auth, email, form.password);
      const uid = credential.user.uid;

      await updateProfile(credential.user, { displayName: trimmedFullName });

      try {
        await sendEmailVerification(credential.user);
      } catch (verificationError) {
        verificationErrorMessage = mapVerificationError(verificationError);
        console.error('Verification email error:', verificationError);
      }

      await setDoc(doc(db, 'users', uid), {
        name: trimmedFullName,
        displayName: trimmedFullName,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email,
        emailVerified: false,
        mobileNumber,
        role: 'teacher',
        school,
        assignedPrograms: [program],
        approved: false,
        createdAt: serverTimestamp(),
      });

      await signOut(auth);

      setForm(INITIAL_FORM);

      if (verificationErrorMessage) {
        setError(
          `Kontot skapades och väntar på admin-godkännande, men verifieringsmejlet kunde inte skickas automatiskt. ${verificationErrorMessage}`,
        );
        return;
      }

      setSuccess(
        'Ditt lärarkonto har skapats men väntar på e-postverifiering och godkännande från en administratör. Kontrollera inkorg och skräppost.',
      );
    } catch (submitError) {
      setError(mapAuthError(submitError));
      console.error('Register error:', submitError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-orange-100/40 sm:p-7">
      <div className="mb-5 text-center sm:mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Skapa lärarkonto</h1>
        <p className="mt-2 text-sm text-slate-600">
          Kom igång med APL-appen och få full överblick över dina elever.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-slate-700">
            Namn
          </label>
          <input
            id="firstName"
            type="text"
            value={form.firstName}
            onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            placeholder="Förnamn"
            autoComplete="given-name"
            required
          />
        </div>

        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-slate-700">
            Efternamn
          </label>
          <input
            id="lastName"
            type="text"
            value={form.lastName}
            onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            placeholder="Efternamn"
            autoComplete="family-name"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Lösenord
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            placeholder="Minst 6 tecken"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            E-post
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            placeholder="namn@skola.se"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label htmlFor="mobileNumber" className="mb-1 block text-sm font-medium text-slate-700">
            Mobilnummer
          </label>
          <input
            id="mobileNumber"
            name="mobileNumber"
            type="tel"
            inputMode="tel"
            value={form.mobileNumber}
            onChange={(event) => setForm((prev) => ({ ...prev, mobileNumber: event.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            placeholder="070-123 45 67"
            autoComplete="tel"
            required
          />
        </div>

        <div>
          <label htmlFor="school" className="mb-1 block text-sm font-medium text-slate-700">
            Skola
          </label>
          <select
            id="school"
            name="school"
            value={form.school}
            onChange={(event) => setForm((prev) => ({ ...prev, school: event.target.value }))}
            disabled={schoolsLoading || schools.length === 0}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            autoComplete="organization"
            required
          >
            <option value="">
              {schoolsLoading ? 'Laddar skolor...' : schools.length === 0 ? 'Inga skolor tillgängliga' : 'Välj skola'}
            </option>
            {schools.map((school) => (
              <option key={school.id} value={school.name}>
                {school.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-sm text-slate-500">
            Admin kommer att granska din ansökan innan du får tillgång.
          </p>
        </div>

        <div>
          <label htmlFor="program" className="mb-1 block text-sm font-medium text-slate-700">
            Program
          </label>
          <select
            id="program"
            name="program"
            value={form.program}
            onChange={(event) => setForm((prev) => ({ ...prev, program: event.target.value }))}
            disabled={programsLoading || programs.length === 0}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            required
          >
            <option value="">
              {programsLoading ? 'Laddar program...' : programs.length === 0 ? 'Inga program tillgängliga' : 'Välj program'}
            </option>
            {programs.map((program) => (
              <option key={program.id} value={program.name}>
                {program.name}
              </option>
            ))}
          </select>
        </div>

        <input type="hidden" name="role" value="teacher" readOnly />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || schoolsLoading || schools.length === 0}
          className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Skapar konto...' : 'Skapa konto'}
        </button>
      </form>

      <div className="mt-5 space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
        <p className="text-sm text-slate-600">Kommande inloggning:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500"
          >
            Fortsatt med Google (snart)
          </button>
          <button
            type="button"
            disabled
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500"
          >
            Fortsatt med Microsoft (snart)
          </button>
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-slate-600">
        Har du redan ett konto?{' '}
        <Link href="/login" className="font-semibold text-orange-700 hover:text-orange-800">
          Logga in
        </Link>
      </p>
    </div>
  );
}