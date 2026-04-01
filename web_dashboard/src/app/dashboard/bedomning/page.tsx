'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ClipboardList, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import {
  AssessmentTemplateSnapshot,
  SelfAssessmentField,
  SupervisorCriterion,
  createAssessmentFieldKey,
  defaultAssessmentTemplateSnapshot,
  sanitizeAssessmentTemplateSnapshot,
} from '@/lib/assessmentTemplates';

function cloneSnapshot(snapshot: AssessmentTemplateSnapshot): AssessmentTemplateSnapshot {
  return {
    selfAssessmentFields: snapshot.selfAssessmentFields.map((field) => ({ ...field })),
    supervisorCriteria: snapshot.supervisorCriteria.map((criterion) => ({ ...criterion })),
  };
}

export default function AssessmentTemplatesPage() {
  const router = useRouter();
  const settingsRef = useMemo(() => doc(db, 'appSettings', 'assessmentTemplates'), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [template, setTemplate] = useState<AssessmentTemplateSnapshot>(
    cloneSnapshot(defaultAssessmentTemplateSnapshot),
  );
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

      const templateDoc = await getDoc(settingsRef);
      const nextTemplate = templateDoc.exists()
        ? sanitizeAssessmentTemplateSnapshot(templateDoc.data())
        : defaultAssessmentTemplateSnapshot;

      if (!templateDoc.exists()) {
        await setDoc(
          settingsRef,
          {
            ...nextTemplate,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
          },
          { merge: true },
        );
      }

      setTemplate(cloneSnapshot(nextTemplate));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, settingsRef]);

  const handleSelfFieldChange = (
    fieldKey: string,
    update: Partial<SelfAssessmentField>,
  ) => {
    setTemplate((current) => ({
      ...current,
      selfAssessmentFields: current.selfAssessmentFields.map((field) =>
        field.key === fieldKey ? { ...field, ...update } : field,
      ),
    }));
  };

  const handleCriterionChange = (
    criterionKey: string,
    update: Partial<SupervisorCriterion>,
  ) => {
    setTemplate((current) => ({
      ...current,
      supervisorCriteria: current.supervisorCriteria.map((criterion) =>
        criterion.key === criterionKey ? { ...criterion, ...update } : criterion,
      ),
    }));
  };

  const addSelfAssessmentField = () => {
    setTemplate((current) => {
      const key = createAssessmentFieldKey('ny-fraga', current.selfAssessmentFields.map((field) => field.key));
      return {
        ...current,
        selfAssessmentFields: [
          ...current.selfAssessmentFields,
          {
            key,
            label: 'Ny fråga',
            placeholder: '',
            inputType: 'text',
          },
        ],
      };
    });
  };

  const addSupervisorCriterion = () => {
    setTemplate((current) => {
      const key = createAssessmentFieldKey('nytt-kriterium', current.supervisorCriteria.map((criterion) => criterion.key));
      return {
        ...current,
        supervisorCriteria: [
          ...current.supervisorCriteria,
          {
            key,
            label: 'Nytt kriterium',
          },
        ],
      };
    });
  };

  const removeSelfAssessmentField = (fieldKey: string) => {
    setTemplate((current) => ({
      ...current,
      selfAssessmentFields: current.selfAssessmentFields.filter((field) => field.key !== fieldKey),
    }));
  };

  const removeSupervisorCriterion = (criterionKey: string) => {
    setTemplate((current) => ({
      ...current,
      supervisorCriteria: current.supervisorCriteria.filter((criterion) => criterion.key !== criterionKey),
    }));
  };

  const resetDefaults = () => {
    if (!window.confirm('Återställ självskattning och handledarbedömning till standardmallen?')) {
      return;
    }

    setTemplate(cloneSnapshot(defaultAssessmentTemplateSnapshot));
    setMessage(null);
    setError(null);
  };

  const saveTemplate = async () => {
    if (!userId) return;

    const sanitized = sanitizeAssessmentTemplateSnapshot(template);
    const emptySelfLabel = sanitized.selfAssessmentFields.find((field) => !field.label.trim());
    if (emptySelfLabel) {
      setError('Alla självskattningsfrågor måste ha en rubrik.');
      setMessage(null);
      return;
    }

    const emptyCriterion = sanitized.supervisorCriteria.find((criterion) => !criterion.label.trim());
    if (emptyCriterion) {
      setError('Alla handledarkriterier måste ha en rubrik.');
      setMessage(null);
      return;
    }

    if (sanitized.selfAssessmentFields.length === 0 || sanitized.supervisorCriteria.length === 0) {
      setError('Det måste finnas minst en fråga i självskattningen och minst ett handledarkriterium.');
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await setDoc(
        settingsRef,
        {
          ...sanitized,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        },
        { merge: true },
      );
      setTemplate(cloneSnapshot(sanitized));
      setMessage('Bedömningsmallen sparades. Nya bedömningar använder den direkt.');
    } catch (saveError) {
      console.error('Error saving assessment templates:', saveError);
      setError('Kunde inte spara bedömningsmallen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || userRole !== 'admin') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        Laddar bedömningsmall...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bedömning</h1>
          <p className="mt-2 max-w-3xl text-gray-600">
            Här styr du vilka frågor som ska ingå i elevens självskattning och vilka kriterier handledaren ska betygsätta. Ändringar påverkar nya bedömningsförfrågningar och sparas som snapshots i varje begäran.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={resetDefaults}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-4 py-2 font-medium text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Återställ standard
          </button>
          <button
            onClick={saveTemplate}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Spara
          </button>
        </div>
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

      <section className="grid gap-8 xl:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Självskattning</h2>
                <p className="text-sm text-gray-600">Frågorna som eleven fyller i innan handledaren får länken.</p>
              </div>
            </div>
            <button
              onClick={addSelfAssessmentField}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
            >
              <Plus className="h-4 w-4" />
              Lägg till fråga
            </button>
          </div>

          <div className="space-y-4">
            {template.selfAssessmentFields.map((field, index) => (
              <div key={field.key} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-700">Fråga {index + 1}</p>
                  <button
                    onClick={() => removeSelfAssessmentField(field.key)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Ta bort
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Rubrik
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleSelfFieldChange(field.key, { label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Hjälptext
                    <input
                      type="text"
                      value={field.placeholder}
                      onChange={(e) => handleSelfFieldChange(field.key, { placeholder: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-700">
                    Svarstyp
                    <select
                      value={field.inputType}
                      onChange={(e) =>
                        handleSelfFieldChange(field.key, {
                          inputType: e.target.value === 'number' ? 'number' : 'text',
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="text">Löptext</option>
                      <option value="number">Siffra</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Handledarbedömning</h2>
                <p className="text-sm text-gray-600">Kriterierna som handledaren betygsätter på skalan 1-5.</p>
              </div>
            </div>
            <button
              onClick={addSupervisorCriterion}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
            >
              <Plus className="h-4 w-4" />
              Lägg till kriterium
            </button>
          </div>

          <div className="space-y-4">
            {template.supervisorCriteria.map((criterion, index) => (
              <div key={criterion.key} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-700">Kriterium {index + 1}</p>
                  <button
                    onClick={() => removeSupervisorCriterion(criterion.key)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Ta bort
                  </button>
                </div>

                <label className="block text-sm font-medium text-gray-700">
                  Rubrik
                  <input
                    type="text"
                    value={criterion.label}
                    onChange={(e) => handleCriterionChange(criterion.key, { label: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </label>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}