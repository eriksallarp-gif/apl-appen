'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ChevronDown, ChevronUp, ClipboardList, EyeOff, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';

import { auth, db } from '@/lib/firebase';
import {
  AssessmentTemplateSnapshot,
  SelfAssessmentField,
  SupervisorCriterion,
  TeacherAssessmentTemplateOverrides,
  createAssessmentFieldKey,
  defaultAssessmentTemplateSnapshot,
  hasTeacherAssessmentOverrides,
  mergeAssessmentTemplateSnapshot,
  orderTeacherSelfAssessmentFieldsForView,
  orderTeacherSupervisorCriteriaForView,
  sanitizeAssessmentTemplateSnapshot,
  sanitizeTeacherAssessmentTemplateOverrides,
} from '@/lib/assessmentTemplates';

function cloneSnapshot(snapshot: AssessmentTemplateSnapshot): AssessmentTemplateSnapshot {
  return {
    selfAssessmentFields: snapshot.selfAssessmentFields.map((field) => ({ ...field })),
    supervisorCriteria: snapshot.supervisorCriteria.map((criterion) => ({ ...criterion })),
  };
}

function cloneOverrides(
  overrides: TeacherAssessmentTemplateOverrides,
): TeacherAssessmentTemplateOverrides {
  return {
    hiddenSelfAssessmentFieldKeys: [...overrides.hiddenSelfAssessmentFieldKeys],
    hiddenSupervisorCriteriaKeys: [...overrides.hiddenSupervisorCriteriaKeys],
    selfAssessmentOrderKeys: [...overrides.selfAssessmentOrderKeys],
    supervisorCriteriaOrderKeys: [...overrides.supervisorCriteriaOrderKeys],
    additionalSelfAssessmentFields: overrides.additionalSelfAssessmentFields.map((field) => ({ ...field })),
    additionalSupervisorCriteria: overrides.additionalSupervisorCriteria.map((criterion) => ({ ...criterion })),
  };
}

const emptyTeacherOverrides: TeacherAssessmentTemplateOverrides = {
  hiddenSelfAssessmentFieldKeys: [],
  hiddenSupervisorCriteriaKeys: [],
  selfAssessmentOrderKeys: [],
  supervisorCriteriaOrderKeys: [],
  additionalSelfAssessmentFields: [],
  additionalSupervisorCriteria: [],
};

type OrderedTeacherSelfField = SelfAssessmentField & {
  source: 'admin' | 'teacher';
};

type OrderedTeacherCriterion = SupervisorCriterion & {
  source: 'admin' | 'teacher';
};

function moveKey(orderKeys: string[], key: string, direction: 'up' | 'down'): string[] {
  const next = [...orderKeys];
  const index = next.indexOf(key);
  if (index === -1) return next;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= next.length) return next;

  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

type AssessmentViewMode = 'both' | 'self' | 'supervisor';

export default function AssessmentTemplatesPage() {
  const router = useRouter();
  const settingsRef = useMemo(() => doc(db, 'appSettings', 'assessmentTemplates'), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [template, setTemplate] = useState<AssessmentTemplateSnapshot>(
    cloneSnapshot(defaultAssessmentTemplateSnapshot),
  );
  const [teacherOverrides, setTeacherOverrides] = useState<TeacherAssessmentTemplateOverrides>(
    cloneOverrides(emptyTeacherOverrides),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<AssessmentViewMode>('both');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItemExpansion = (key: string) => {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isAdmin = userRole === 'admin';
  const isTeacher = userRole === 'teacher';
  const teacherTemplateRef = useMemo(
    () => (userId ? doc(db, 'teacherAssessmentTemplates', userId) : null),
    [userId],
  );
  const teacherPreview = useMemo(
    () => mergeAssessmentTemplateSnapshot(template, teacherOverrides),
    [teacherOverrides, template],
  );
  const orderedTeacherSelfFields = useMemo<OrderedTeacherSelfField[]>(
    () =>
      orderTeacherSelfAssessmentFieldsForView(template, teacherOverrides).map((field) => ({
        ...field,
        source: teacherOverrides.additionalSelfAssessmentFields.some(
          (additionalField) => additionalField.key === field.key,
        )
          ? 'teacher'
          : 'admin',
      })),
    [teacherOverrides, template],
  );
  const orderedTeacherCriteria = useMemo<OrderedTeacherCriterion[]>(
    () =>
      orderTeacherSupervisorCriteriaForView(template, teacherOverrides).map((criterion) => ({
        ...criterion,
        source: teacherOverrides.additionalSupervisorCriteria.some(
          (additionalCriterion) => additionalCriterion.key === criterion.key,
        )
          ? 'teacher'
          : 'admin',
      })),
    [teacherOverrides, template],
  );
  const showSelfAssessment = viewMode === 'both' || viewMode === 'self';
  const showSupervisorAssessment = viewMode === 'both' || viewMode === 'supervisor';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      setUserId(user.uid);

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          router.push('/dashboard');
          return;
        }

        const role = String(userDoc.data().role ?? '');
        setUserRole(role || null);

        if (role !== 'admin' && role !== 'teacher') {
          router.push('/dashboard');
          return;
        }

        const templateDoc = await getDoc(settingsRef);
        const nextTemplate = templateDoc.exists()
          ? sanitizeAssessmentTemplateSnapshot(templateDoc.data())
          : defaultAssessmentTemplateSnapshot;

        if (role === 'admin' && !templateDoc.exists()) {
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

        if (role === 'teacher') {
          try {
            const overridesDoc = await getDoc(
              doc(db, 'teacherAssessmentTemplates', user.uid),
            );
            const nextOverrides = overridesDoc.exists()
              ? sanitizeTeacherAssessmentTemplateOverrides(overridesDoc.data())
              : emptyTeacherOverrides;
            setTeacherOverrides(cloneOverrides(nextOverrides));
          } catch (overridesError) {
            console.error('Error loading teacher assessment overrides:', overridesError);
            setTeacherOverrides(cloneOverrides(emptyTeacherOverrides));
            setError(
              'Kunde inte läsa lärarens egna bedömningsinställningar. Standardmallen visas just nu.',
            );
          }
        }
      } catch (loadError) {
        console.error('Error loading assessment template page:', loadError);
        setError('Kunde inte läsa in bedömningssidan just nu. Försök igen om en stund.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, settingsRef]);

  const handleSelfFieldChange = (fieldKey: string, update: Partial<SelfAssessmentField>) => {
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
      const key = createAssessmentFieldKey(
        'ny-fraga',
        current.selfAssessmentFields.map((field) => field.key),
      );
      return {
        ...current,
        selfAssessmentFields: [
          ...current.selfAssessmentFields,
          { key, label: 'Ny fråga', placeholder: '', inputType: 'text' },
        ],
      };
    });
  };

  const addSupervisorCriterion = () => {
    setTemplate((current) => {
      const key = createAssessmentFieldKey(
        'nytt-kriterium',
        current.supervisorCriteria.map((criterion) => criterion.key),
      );
      return {
        ...current,
        supervisorCriteria: [...current.supervisorCriteria, { key, label: 'Nytt kriterium' }],
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

  const toggleHiddenSelfField = (fieldKey: string) => {
    setTeacherOverrides((current) => ({
      ...current,
      hiddenSelfAssessmentFieldKeys: current.hiddenSelfAssessmentFieldKeys.includes(fieldKey)
        ? current.hiddenSelfAssessmentFieldKeys.filter((key) => key !== fieldKey)
        : [...current.hiddenSelfAssessmentFieldKeys, fieldKey],
    }));
  };

  const toggleHiddenCriterion = (criterionKey: string) => {
    setTeacherOverrides((current) => ({
      ...current,
      hiddenSupervisorCriteriaKeys: current.hiddenSupervisorCriteriaKeys.includes(criterionKey)
        ? current.hiddenSupervisorCriteriaKeys.filter((key) => key !== criterionKey)
        : [...current.hiddenSupervisorCriteriaKeys, criterionKey],
    }));
  };

  const handleTeacherSelfFieldChange = (
    fieldKey: string,
    update: Partial<SelfAssessmentField>,
  ) => {
    setTeacherOverrides((current) => ({
      ...current,
      additionalSelfAssessmentFields: current.additionalSelfAssessmentFields.map((field) =>
        field.key === fieldKey ? { ...field, ...update } : field,
      ),
    }));
  };

  const handleTeacherCriterionChange = (
    criterionKey: string,
    update: Partial<SupervisorCriterion>,
  ) => {
    setTeacherOverrides((current) => ({
      ...current,
      additionalSupervisorCriteria: current.additionalSupervisorCriteria.map((criterion) =>
        criterion.key === criterionKey ? { ...criterion, ...update } : criterion,
      ),
    }));
  };

  const addTeacherSelfAssessmentField = () => {
    setTeacherOverrides((current) => {
      const key = createAssessmentFieldKey('ny-fraga', [
        ...template.selfAssessmentFields.map((field) => field.key),
        ...current.additionalSelfAssessmentFields.map((field) => field.key),
      ]);

      return {
        ...current,
        selfAssessmentOrderKeys: [
          ...orderTeacherSelfAssessmentFieldsForView(template, current).map((field) => field.key),
          key,
        ],
        additionalSelfAssessmentFields: [
          ...current.additionalSelfAssessmentFields,
          { key, label: 'Ny fråga', placeholder: '', inputType: 'text' },
        ],
      };
    });
  };

  const addTeacherCriterion = () => {
    setTeacherOverrides((current) => {
      const key = createAssessmentFieldKey('nytt-kriterium', [
        ...template.supervisorCriteria.map((criterion) => criterion.key),
        ...current.additionalSupervisorCriteria.map((criterion) => criterion.key),
      ]);

      return {
        ...current,
        supervisorCriteriaOrderKeys: [
          ...orderTeacherSupervisorCriteriaForView(template, current).map((criterion) => criterion.key),
          key,
        ],
        additionalSupervisorCriteria: [
          ...current.additionalSupervisorCriteria,
          { key, label: 'Nytt kriterium' },
        ],
      };
    });
  };

  const removeTeacherSelfAssessmentField = (fieldKey: string) => {
    setTeacherOverrides((current) => ({
      ...current,
      selfAssessmentOrderKeys: current.selfAssessmentOrderKeys.filter((key) => key !== fieldKey),
      additionalSelfAssessmentFields: current.additionalSelfAssessmentFields.filter(
        (field) => field.key !== fieldKey,
      ),
    }));
  };

  const removeTeacherCriterion = (criterionKey: string) => {
    setTeacherOverrides((current) => ({
      ...current,
      supervisorCriteriaOrderKeys: current.supervisorCriteriaOrderKeys.filter((key) => key !== criterionKey),
      additionalSupervisorCriteria: current.additionalSupervisorCriteria.filter(
        (criterion) => criterion.key !== criterionKey,
      ),
    }));
  };

  const moveTeacherSelfAssessmentField = (fieldKey: string, direction: 'up' | 'down') => {
    setTeacherOverrides((current) => ({
      ...current,
      selfAssessmentOrderKeys: moveKey(
        orderTeacherSelfAssessmentFieldsForView(template, current).map((field) => field.key),
        fieldKey,
        direction,
      ),
    }));
  };

  const moveTeacherCriterion = (criterionKey: string, direction: 'up' | 'down') => {
    setTeacherOverrides((current) => ({
      ...current,
      supervisorCriteriaOrderKeys: moveKey(
        orderTeacherSupervisorCriteriaForView(template, current).map((criterion) => criterion.key),
        criterionKey,
        direction,
      ),
    }));
  };

  const resetDefaults = () => {
    if (
      !window.confirm(
        isAdmin
          ? 'Återställ självskattning och handledarbedömning till standardmallen?'
          : 'Ta bort dina dolda och egna frågor så att adminmallen visas för dina elever igen?',
      )
    ) {
      return;
    }

    if (isAdmin) {
      setTemplate(cloneSnapshot(defaultAssessmentTemplateSnapshot));
    } else {
      setTeacherOverrides(cloneOverrides(emptyTeacherOverrides));
    }
    setMessage(null);
    setError(null);
  };

  const saveTemplate = async () => {
    if (!userId) return;

    if (isTeacher) {
      if (!teacherTemplateRef) return;

      const sanitized = sanitizeTeacherAssessmentTemplateOverrides(teacherOverrides);
      const emptySelfLabel = sanitized.additionalSelfAssessmentFields.find((field) => !field.label.trim());
      if (emptySelfLabel) {
        setError('Alla egna självskattningsfrågor måste ha en rubrik.');
        setMessage(null);
        return;
      }

      const emptyCriterion = sanitized.additionalSupervisorCriteria.find(
        (criterion) => !criterion.label.trim(),
      );
      if (emptyCriterion) {
        setError('Alla egna handledarkriterier måste ha en rubrik.');
        setMessage(null);
        return;
      }

      setSaving(true);
      setError(null);
      setMessage(null);

      try {
        if (!hasTeacherAssessmentOverrides(sanitized)) {
          await deleteDoc(teacherTemplateRef);
          setTeacherOverrides(cloneOverrides(emptyTeacherOverrides));
          setMessage('Lärarens bedömningsmall återställdes till adminmallen.');
        } else {
          await setDoc(
            teacherTemplateRef,
            {
              teacherUid: userId,
              ...sanitized,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
            },
            { merge: true },
          );
          setTeacherOverrides(cloneOverrides(sanitized));
          setMessage('Lärarens bedömningsmall sparades. Elevappen använder den för dina elever.');
        }
      } catch (saveError) {
        console.error('Error saving teacher assessment overrides:', saveError);
        setError('Kunde inte spara lärarens bedömningsmall.');
      } finally {
        setSaving(false);
      }
      return;
    }

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

  if (loading || (!isAdmin && !isTeacher)) {
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
            {isAdmin
              ? 'Här styr du vilka frågor som ska ingå i elevens självskattning och vilka kriterier handledaren ska betygsätta. Ändringar påverkar nya bedömningsförfrågningar och sparas som snapshots i varje begäran.'
              : 'Här ser du adminens standardmall och kan dölja frågor eller lägga till egna för just dina elever. Ändringarna används av elevappen när dina elever skapar en ny bedömning.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={resetDefaults}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-4 py-2 font-medium text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {isAdmin ? 'Återställ standard' : 'Återställ adminmall'}
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

      {isTeacher && (
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-orange-100 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">Din aktiva mall</p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">Förhandsvisning för dina elever</h2>
              <p className="mt-2 max-w-3xl text-sm text-gray-600">
                {teacherPreview.selfAssessmentFields.length} frågor i självskattningen och {teacherPreview.supervisorCriteria.length} kriterier i handledarbedömningen visas just nu för elever som är kopplade till dig.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-orange-100">
                <p className="text-xs uppercase tracking-wide text-gray-500">Dolda frågor</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{teacherOverrides.hiddenSelfAssessmentFieldKeys.length}</p>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-orange-100">
                <p className="text-xs uppercase tracking-wide text-gray-500">Egna frågor</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{teacherOverrides.additionalSelfAssessmentFields.length}</p>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-orange-100">
                <p className="text-xs uppercase tracking-wide text-gray-500">Dolda kriterier</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{teacherOverrides.hiddenSupervisorCriteriaKeys.length}</p>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-orange-100">
                <p className="text-xs uppercase tracking-wide text-gray-500">Egna kriterier</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{teacherOverrides.additionalSupervisorCriteria.length}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Visa innehåll</p>
          <p className="text-sm text-gray-600">
            Välj om du vill fokusera på självskattning, handledarbedömning eller båda samtidigt.
          </p>
        </div>
        <label className="flex min-w-[220px] flex-col gap-2 text-sm font-medium text-gray-700 sm:items-end">
          <span className="sr-only">Välj vad som ska visas</span>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as AssessmentViewMode)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 sm:max-w-[240px]"
          >
            <option value="both">Visa båda</option>
            <option value="self">Endast självskattning</option>
            <option value="supervisor">Endast handledarbedömning</option>
          </select>
        </label>
      </section>

      <section className={`grid gap-8 ${showSelfAssessment && showSupervisorAssessment ? 'xl:grid-cols-2' : 'max-w-4xl'}`}>
        {showSelfAssessment && (
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Självskattning</h2>
                <p className="text-sm text-gray-600">
                  {isAdmin
                    ? 'Frågorna som eleven fyller i innan handledaren får länken.'
                    : 'Adminens standardfrågor som du kan dölja för dina egna elever, samt dina egna tillägg.'}
                </p>
              </div>
            </div>
            <button
              onClick={isAdmin ? addSelfAssessmentField : addTeacherSelfAssessmentField}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
            >
              <Plus className="h-4 w-4" />
              {isAdmin ? 'Lägg till fråga' : 'Lägg till egen fråga'}
            </button>
          </div>

          <div className="space-y-4">
            {isAdmin && template.selfAssessmentFields.map((field, index) => {
              const hidden = teacherOverrides.hiddenSelfAssessmentFieldKeys.includes(field.key);
              const isExpanded = expandedItems.has(field.key);

              return (
                <div key={field.key} className="rounded-xl border border-gray-200 shadow-sm">
                  <button
                    onClick={() => toggleItemExpansion(field.key)}
                    className="w-full p-4 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Fråga {index + 1}</p>
                          {!isExpanded && field.label && (
                            <p className="text-sm text-gray-600 mt-1">{field.label}</p>
                          )}
                        </div>
                      </div>
                      {isAdmin ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSelfAssessmentField(field.key);
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Ta bort
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHiddenSelfField(field.key);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
                            hidden ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <EyeOff className="h-4 w-4" />
                          {hidden ? 'Dold' : 'Dölj'}
                        </button>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">

                  <div className={`space-y-3 ${!isAdmin && hidden ? 'opacity-50' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700">
                      Rubrik
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleSelfFieldChange(field.key, { label: e.target.value })}
                        disabled={!isAdmin}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Hjälptext
                      <input
                        type="text"
                        value={field.placeholder}
                        onChange={(e) => handleSelfFieldChange(field.key, { placeholder: e.target.value })}
                        disabled={!isAdmin}
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
                        disabled={!isAdmin}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      >
                        <option value="text">Löptext</option>
                        <option value="number">Siffra</option>
                      </select>
                    </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isTeacher && orderedTeacherSelfFields.map((field, index) => {
              const hidden = teacherOverrides.hiddenSelfAssessmentFieldKeys.includes(field.key);
              const isTeacherField = field.source === 'teacher';
              const isExpanded = expandedItems.has(field.key);

              return (
                <div key={field.key} className="rounded-xl border border-gray-200 shadow-sm">
                  <button
                    onClick={() => toggleItemExpansion(field.key)}
                    className="w-full p-4 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-700">Fråga {index + 1}</p>
                            {isTeacherField && (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 ring-1 ring-blue-200">
                                Egen
                              </span>
                            )}
                            {!isTeacherField && hidden && (
                              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs text-orange-700">
                                Dold
                              </span>
                            )}
                          </div>
                          {!isExpanded && field.label && (
                            <p className="text-sm text-gray-600 mt-1">{field.label}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => moveTeacherSelfAssessmentField(field.key, 'up')}
                          disabled={index === 0}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronUp className="h-4 w-4" />
                          Upp
                        </button>
                      <button
                        onClick={() => moveTeacherSelfAssessmentField(field.key, 'down')}
                        disabled={index === orderedTeacherSelfFields.length - 1}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronDown className="h-4 w-4" />
                        Ner
                      </button>
                      {isTeacherField ? (
                        <button
                          onClick={() => removeTeacherSelfAssessmentField(field.key)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Ta bort
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleHiddenSelfField(field.key)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
                            hidden ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <EyeOff className="h-4 w-4" />
                          {hidden ? 'Dold' : 'Dölj'}
                        </button>
                      )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className={`space-y-3 ${!isTeacherField && hidden ? 'opacity-50' : ''}`}>
                    <label className="block text-sm font-medium text-gray-700">
                      Rubrik
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          isTeacherField
                            ? handleTeacherSelfFieldChange(field.key, { label: e.target.value })
                            : handleSelfFieldChange(field.key, { label: e.target.value })
                        }
                        disabled={!isTeacherField}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Hjälptext
                      <input
                        type="text"
                        value={field.placeholder}
                        onChange={(e) =>
                          isTeacherField
                            ? handleTeacherSelfFieldChange(field.key, { placeholder: e.target.value })
                            : handleSelfFieldChange(field.key, { placeholder: e.target.value })
                        }
                        disabled={!isTeacherField}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Svarstyp
                      <select
                        value={field.inputType}
                        onChange={(e) => {
                          const inputType = e.target.value === 'number' ? 'number' : 'text';
                          if (isTeacherField) {
                            handleTeacherSelfFieldChange(field.key, { inputType });
                            return;
                          }
                          handleSelfFieldChange(field.key, { inputType });
                        }}
                        disabled={!isTeacherField}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      >
                        <option value="text">Löptext</option>
                        <option value="number">Siffra</option>
                      </select>
                    </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </article>
        )}

        {showSupervisorAssessment && (
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Handledarbedömning</h2>
                <p className="text-sm text-gray-600">
                  {isAdmin
                    ? 'Kriterierna som handledaren betygsätter på skalan 1-5.'
                    : 'Adminens standardkriterier som du kan dölja, plus egna kriterier för dina elever.'}
                </p>
              </div>
            </div>
            <button
              onClick={isAdmin ? addSupervisorCriterion : addTeacherCriterion}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
            >
              <Plus className="h-4 w-4" />
              {isAdmin ? 'Lägg till kriterium' : 'Lägg till eget kriterium'}
            </button>
          </div>

          <div className="space-y-4">
            {isAdmin && template.supervisorCriteria.map((criterion, index) => {
              const hidden = teacherOverrides.hiddenSupervisorCriteriaKeys.includes(criterion.key);
              const isExpanded = expandedItems.has(criterion.key);

              return (
                <div key={criterion.key} className="rounded-xl border border-gray-200 shadow-sm">
                  <button
                    onClick={() => toggleItemExpansion(criterion.key)}
                    className="w-full p-4 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Kriterium {index + 1}</p>
                          {!isExpanded && criterion.label && (
                            <p className="text-sm text-gray-600 mt-1">{criterion.label}</p>
                          )}
                        </div>
                      </div>
                      {isAdmin ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSupervisorCriterion(criterion.key);
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Ta bort
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHiddenCriterion(criterion.key);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
                            hidden ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <EyeOff className="h-4 w-4" />
                          {hidden ? 'Dolt' : 'Dölj'}
                        </button>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <label className={`block text-sm font-medium text-gray-700 ${!isAdmin && hidden ? 'opacity-50' : ''}`}>
                        Rubrik
                        <input
                          type="text"
                          value={criterion.label}
                          onChange={(e) => handleCriterionChange(criterion.key, { label: e.target.value })}
                          disabled={!isAdmin}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}

            {isTeacher && orderedTeacherCriteria.map((criterion, index) => {
              const hidden = teacherOverrides.hiddenSupervisorCriteriaKeys.includes(criterion.key);
              const isTeacherCriterion = criterion.source === 'teacher';
              const isExpanded = expandedItems.has(criterion.key);

              return (
                <div key={criterion.key} className="rounded-xl border border-gray-200 shadow-sm">
                  <button
                    onClick={() => toggleItemExpansion(criterion.key)}
                    className="w-full p-4 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-700">Kriterium {index + 1}</p>
                            {isTeacherCriterion && (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 ring-1 ring-blue-200">
                                Egen
                              </span>
                            )}
                            {!isTeacherCriterion && hidden && (
                              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs text-orange-700">
                                Dolt
                              </span>
                            )}
                          </div>
                          {!isExpanded && criterion.label && (
                            <p className="text-sm text-gray-600 mt-1">{criterion.label}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => moveTeacherCriterion(criterion.key, 'up')}
                        disabled={index === 0}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronUp className="h-4 w-4" />
                        Upp
                      </button>
                      <button
                        onClick={() => moveTeacherCriterion(criterion.key, 'down')}
                        disabled={index === orderedTeacherCriteria.length - 1}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronDown className="h-4 w-4" />
                        Ner
                      </button>
                      {isTeacherCriterion ? (
                        <button
                          onClick={() => removeTeacherCriterion(criterion.key)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Ta bort
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleHiddenCriterion(criterion.key)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition ${
                            hidden ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <EyeOff className="h-4 w-4" />
                          {hidden ? 'Dolt' : 'Dölj'}
                        </button>
                      )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <label className={`block text-sm font-medium text-gray-700 ${!isTeacherCriterion && hidden ? 'opacity-50' : ''}`}>
                        Rubrik
                        <input
                          type="text"
                          value={criterion.label}
                          onChange={(e) =>
                            isTeacherCriterion
                              ? handleTeacherCriterionChange(criterion.key, { label: e.target.value })
                              : handleCriterionChange(criterion.key, { label: e.target.value })
                          }
                          disabled={!isTeacherCriterion}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </article>
        )}
      </section>
    </div>
  );
}
