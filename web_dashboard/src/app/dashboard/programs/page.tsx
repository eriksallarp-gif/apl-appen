'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Blocks, Plus, Trash2, Wrench } from 'lucide-react';
import { auth, db } from '@/lib/firebase';

interface ProgramEntry {
  name: string;
  specializations: string[];
}

const DEFAULT_PROGRAMS: ProgramEntry[] = [
  { name: 'Barn- och fritidsprogrammet', specializations: [] },
  {
    name: 'Bygg- och anläggningsprogrammet',
    specializations: ['Träarbetare', 'Murare', 'Målare', 'Plåtslagare', 'Anläggare'],
  },
  { name: 'El- och energiprogrammet', specializations: ['Elektriker'] },
  { name: 'Fordons- och transportprogrammet', specializations: [] },
  { name: 'Försäljning- och serviceprogrammet', specializations: [] },
  { name: 'Industritekniska programmet', specializations: [] },
  { name: 'Restaurang- och livsmedelsprogrammet', specializations: [] },
  { name: 'Vård- och omsorgsprogrammet', specializations: [] },
  { name: 'VVS- och fastighetsprogrammet', specializations: ['VVS'] },
];

function sanitizePrograms(programs: ProgramEntry[]): ProgramEntry[] {
  const seenPrograms = new Set<string>();
  const sanitized: ProgramEntry[] = [];

  for (const program of programs) {
    const name = program.name.trim();
    if (!name) continue;

    const normalizedName = name.toLowerCase();
    if (seenPrograms.has(normalizedName)) continue;
    seenPrograms.add(normalizedName);

    const seenSpecializations = new Set<string>();
    const specializations = program.specializations
      .map((entry) => entry.trim())
      .filter((entry) => {
        if (!entry) return false;
        const normalized = entry.toLowerCase();
        if (seenSpecializations.has(normalized)) return false;
        seenSpecializations.add(normalized);
        return true;
      });

    sanitized.push({ name, specializations });
  }

  return sanitized;
}

function parsePrograms(rawPrograms: unknown): ProgramEntry[] {
  if (!Array.isArray(rawPrograms)) return sanitizePrograms(DEFAULT_PROGRAMS);

  const parsed = rawPrograms
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      name: String(entry.name ?? '').trim(),
      specializations: Array.isArray(entry.specializations)
        ? entry.specializations.map((item) => String(item ?? '').trim())
        : [],
    }));

  const sanitized = sanitizePrograms(parsed);
  return sanitized.length > 0 ? sanitized : sanitizePrograms(DEFAULT_PROGRAMS);
}

export default function ProgramsPage() {
  const router = useRouter();
  const catalogRef = useMemo(() => doc(db, 'appSettings', 'programCatalog'), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramEntry[]>([]);
  const [newProgramName, setNewProgramName] = useState('');
  const [specializationDrafts, setSpecializationDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      setUserId(user.uid);

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        router.push('/dashboard');
        return;
      }

      const role = String(userDoc.data().role ?? '');
      setUserRole(role || null);

      if (role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      const catalogDoc = await getDoc(catalogRef);
      if (!catalogDoc.exists()) {
        const seededPrograms = sanitizePrograms(DEFAULT_PROGRAMS);
        await setDoc(catalogRef, {
          programs: seededPrograms,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
        setPrograms(seededPrograms);
      } else {
        setPrograms(parsePrograms(catalogDoc.data().programs));
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [catalogRef, router]);

  const savePrograms = async (nextPrograms: ProgramEntry[], successMessage: string) => {
    if (!userId) return;

    const sanitized = sanitizePrograms(nextPrograms);
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await setDoc(
        catalogRef,
        {
          programs: sanitized,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        },
        { merge: true },
      );
      setPrograms(sanitized);
      setMessage(successMessage);
    } catch (saveError) {
      console.error('Error saving program catalog:', saveError);
      setError('Kunde inte spara programkatalogen.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddProgram = async () => {
    const trimmedName = newProgramName.trim();
    if (!trimmedName) {
      setError('Ange ett programnamn.');
      return;
    }

    if (programs.some((program) => program.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Programmet finns redan.');
      return;
    }

    await savePrograms(
      [...programs, { name: trimmedName, specializations: [] }],
      'Program tillagt.',
    );
    setNewProgramName('');
  };

  const handleRemoveProgram = async (programName: string) => {
    if (!window.confirm(`Ta bort programmet "${programName}"?`)) return;

    await savePrograms(
      programs.filter((program) => program.name !== programName),
      'Program borttaget.',
    );
  };

  const handleAddSpecialization = async (programName: string) => {
    const draft = (specializationDrafts[programName] ?? '').trim();
    if (!draft) {
      setError('Ange en yrkesutgång.');
      return;
    }

    const targetProgram = programs.find((program) => program.name === programName);
    if (
      targetProgram != null &&
      targetProgram.specializations.some(
        (entry) => entry.toLowerCase() === draft.toLowerCase(),
      )
    ) {
      setError('Yrkesutgången finns redan i programmet.');
      return;
    }

    const nextPrograms = programs.map((program) =>
      program.name !== programName
        ? program
        : {
            ...program,
            specializations: [...program.specializations, draft],
          },
    );

    await savePrograms(nextPrograms, 'Yrkesutgång tillagd.');
    setSpecializationDrafts((current) => ({ ...current, [programName]: '' }));
  };

  const handleRemoveSpecialization = async (programName: string, specialization: string) => {
    if (!window.confirm(`Ta bort yrkesutgången "${specialization}" från "${programName}"?`)) {
      return;
    }

    const nextPrograms = programs.map((program) =>
      program.name !== programName
        ? program
        : {
            ...program,
            specializations: program.specializations.filter((entry) => entry !== specialization),
          },
    );

    await savePrograms(nextPrograms, 'Yrkesutgång borttagen.');
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Återställ standardprogrammen och deras nuvarande yrkesutgångar?')) {
      return;
    }

    await savePrograms(DEFAULT_PROGRAMS, 'Standardprogram återställda.');
  };

  if (loading || userRole !== 'admin') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        Laddar programkatalog...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Program och yrkesutgångar</h1>
          <p className="mt-2 max-w-3xl text-gray-600">
            Endast admin ser denna sida. Ändringar här slår igenom i elevens programval och fungerar även om katalogen ännu inte finns, eftersom sidan automatiskt seedar standardvärden första gången.
          </p>
        </div>
        <button
          onClick={handleResetDefaults}
          disabled={saving}
          className="rounded-lg border border-orange-200 px-4 py-2 font-medium text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
        >
          Återställ standard
        </button>
      </section>

      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
            <Blocks className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lägg till program</h2>
            <p className="text-sm text-gray-600">Skapa nya program och fyll på med yrkesutgångar efteråt.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newProgramName}
            onChange={(e) => setNewProgramName(e.target.value)}
            placeholder="Till exempel Fordons- och transportprogrammet"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <button
            onClick={handleAddProgram}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Lägg till program
          </button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {programs.map((program) => (
          <article key={program.name} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {program.specializations.length === 0
                    ? 'Inga yrkesutgångar ännu'
                    : `${program.specializations.length} yrkesutgång${program.specializations.length === 1 ? '' : 'ar'}`}
                </p>
              </div>
              <button
                onClick={() => handleRemoveProgram(program.name)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Ta bort
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {program.specializations.length === 0 && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
                  Ingen yrkesutgång kopplad ännu
                </span>
              )}
              {program.specializations.map((specialization) => (
                <span
                  key={`${program.name}-${specialization}`}
                  className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-sm text-orange-700 ring-1 ring-orange-100"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {specialization}
                  <button
                    onClick={() => handleRemoveSpecialization(program.name, specialization)}
                    disabled={saving}
                    className="text-orange-500 transition hover:text-red-600 disabled:opacity-50"
                    aria-label={`Ta bort ${specialization}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={specializationDrafts[program.name] ?? ''}
                onChange={(e) =>
                  setSpecializationDrafts((current) => ({
                    ...current,
                    [program.name]: e.target.value,
                  }))
                }
                placeholder="Ny yrkesutgång"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <button
                onClick={() => handleAddSpecialization(program.name)}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 px-4 py-3 font-medium text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Lägg till yrkesutgång
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}