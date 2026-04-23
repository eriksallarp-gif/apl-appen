'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ChevronDown, ChevronUp, EyeOff, FolderPlus, Plus, Save, Trash2, Wrench } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import {
  ActivityGroup,
  cloneActivityTemplate,
  getBuiltInActivityTemplate,
  getActivityTemplate,
  hasBuiltInActivityTemplate,
} from '@/lib/activityTemplates';

type ProgramEntry = {
  name: string;
  specializations: string[];
};

type TemplateItem = {
  name: string;
  enabled: boolean;
};

type TemplateGroup = {
  group: string;
  items: TemplateItem[];
};

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

function normalizeAssignedPrograms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    const name = String(item ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(name);
  }

  return normalized;
}

function buildTemplateId(teacherUid: string, program?: string, specialization?: string) {
  return `${teacherUid}__${encodeURIComponent((program ?? '').trim())}__${encodeURIComponent(
    (specialization ?? '').trim(),
  )}`;
}

function buildDefaultTemplateId(program?: string, specialization?: string) {
  return `${encodeURIComponent((program ?? '').trim())}__${encodeURIComponent(
    (specialization ?? '').trim(),
  )}`;
}

function templateFromActivityGroups(groups: ActivityGroup[]): TemplateGroup[] {
  return cloneActivityTemplate(groups).map((group) => ({
    group: group.group,
    items: group.items.map((item) => ({ name: item, enabled: true })),
  }));
}

function sanitizeTemplateGroups(groups: TemplateGroup[]): TemplateGroup[] {
  const sanitizedGroups: TemplateGroup[] = [];
  const seenGroups = new Set<string>();

  for (const group of groups) {
    const groupName = group.group.trim();
    if (!groupName) continue;

    const normalizedGroup = groupName.toLowerCase();
    if (seenGroups.has(normalizedGroup)) continue;
    seenGroups.add(normalizedGroup);

    const seenItems = new Set<string>();
    const items = group.items
      .map((item) => ({
        name: item.name.trim(),
        enabled: item.enabled !== false,
      }))
      .filter((item) => {
        if (!item.name) return false;
        const normalizedItem = item.name.toLowerCase();
        if (seenItems.has(normalizedItem)) return false;
        seenItems.add(normalizedItem);
        return true;
      });

    if (items.length === 0) continue;

    sanitizedGroups.push({ group: groupName, items });
  }

  return sanitizedGroups;
}

function parseStoredTemplate(rawGroups: unknown): TemplateGroup[] | null {
  if (!Array.isArray(rawGroups)) return null;

  const parsed = rawGroups
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      group: String(entry.group ?? '').trim(),
      items: Array.isArray(entry.items)
        ? entry.items
            .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
            .map((item) => ({
              name: String(item.name ?? '').trim(),
              enabled: item.enabled !== false,
            }))
        : [],
    }));

  const sanitized = sanitizeTemplateGroups(parsed);
  return sanitized.length > 0 ? sanitized : null;
}

function countTemplateItems(groups: TemplateGroup[]): number {
  return groups.reduce((sum, group) => sum + group.items.length, 0);
}

function hasGroup(groups: TemplateGroup[], groupName: string): boolean {
  return groups.some((group) => group.group === groupName);
}

function hasItemInGroup(
  groups: TemplateGroup[],
  groupName: string,
  itemName: string,
): boolean {
  return groups.some(
    (group) =>
      group.group === groupName &&
      group.items.some((item) => item.name === itemName),
  );
}

export default function TeacherTimesheetTemplatesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramEntry[]>(sanitizePrograms(DEFAULT_PROGRAMS));
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [baseTemplateGroups, setBaseTemplateGroups] = useState<TemplateGroup[]>([]);
  const [templateGroups, setTemplateGroups] = useState<TemplateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [hasSavedTemplate, setHasSavedTemplate] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [teacherAssignedPrograms, setTeacherAssignedPrograms] = useState<string[]>([]);

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const availableSpecializations = useMemo(() => {
    const specializations = programs.find((program) => program.name === selectedProgram)?.specializations ?? [];
    return [...specializations].sort((a, b) => a.localeCompare(b, 'sv'));
  }, [programs, selectedProgram]);

  const isAdminView = userRole === 'admin';

  const hasBuiltInTemplate = useMemo(
    () => hasBuiltInActivityTemplate(selectedSpecialization || undefined, selectedProgram || undefined),
    [selectedProgram, selectedSpecialization],
  );

  const builtInEditableGroups = useMemo(
    () =>
      isAdminView
        ? templateGroups
        : templateGroups.filter((group) => hasGroup(baseTemplateGroups, group.group)),
    [baseTemplateGroups, isAdminView, templateGroups],
  );

  const customGroups = useMemo(
    () =>
      isAdminView
        ? []
        : templateGroups.filter((group) => !hasGroup(baseTemplateGroups, group.group)),
    [baseTemplateGroups, isAdminView, templateGroups],
  );

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

      const assignedPrograms = role === 'teacher'
        ? normalizeAssignedPrograms((userDoc.data() as Record<string, unknown>).assignedPrograms)
        : [];
      setTeacherAssignedPrograms(assignedPrograms);

      if (role !== 'teacher' && role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      const catalogDoc = await getDoc(doc(db, 'appSettings', 'programCatalog'));
      const loadedPrograms = catalogDoc.exists()
        ? parsePrograms(catalogDoc.data().programs)
        : sanitizePrograms(DEFAULT_PROGRAMS);

      const visiblePrograms = role === 'teacher' && assignedPrograms.length > 0
        ? loadedPrograms.filter((program) =>
            assignedPrograms.some(
              (assignedProgram) => assignedProgram.toLowerCase() === program.name.toLowerCase(),
            ),
          )
        : loadedPrograms;

      const effectivePrograms = visiblePrograms.length > 0 ? visiblePrograms : loadedPrograms;

      setPrograms(effectivePrograms);
      const firstProgram = effectivePrograms[0]?.name ?? '';
      setSelectedProgram(firstProgram);
      setSelectedSpecialization(effectivePrograms[0]?.specializations[0] ?? '');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!selectedProgram) return;

    const nextSpecializations = programs.find((program) => program.name === selectedProgram)?.specializations ?? [];
    if (nextSpecializations.length === 0) {
      if (selectedSpecialization !== '') {
        setSelectedSpecialization('');
      }
      return;
    }

    if (!nextSpecializations.includes(selectedSpecialization)) {
      setSelectedSpecialization(nextSpecializations[0]);
    }
  }, [programs, selectedProgram, selectedSpecialization]);

  useEffect(() => {
    const loadTemplate = async () => {
      if (!userId || !selectedProgram) return;

      setMessage(null);
      setError(null);

      const staticTemplate = templateFromActivityGroups(
        getBuiltInActivityTemplate(selectedSpecialization || undefined, selectedProgram),
      );

      let resolvedBaseTemplate = staticTemplate;
      let hasStoredDefaultTemplate = false;

      try {
        const defaultTemplateId = buildDefaultTemplateId(
          selectedProgram,
          selectedSpecialization,
        );
        const defaultTemplateDoc = await getDoc(
          doc(db, 'defaultTimesheetTemplates', defaultTemplateId),
        );

        const defaultTemplate = defaultTemplateDoc.exists()
          ? parseStoredTemplate(defaultTemplateDoc.data().groups)
          : null;

        resolvedBaseTemplate = defaultTemplate ?? staticTemplate;
        hasStoredDefaultTemplate = defaultTemplateDoc.exists();
        setBaseTemplateGroups(resolvedBaseTemplate);

        if (isAdminView) {
          setTemplateGroups(resolvedBaseTemplate);
          setHasSavedTemplate(hasStoredDefaultTemplate);
          return;
        }
      } catch (loadError) {
        console.error('Error loading timesheet template:', loadError);
        setBaseTemplateGroups(staticTemplate);
        resolvedBaseTemplate = staticTemplate;

        if (isAdminView) {
          setHasSavedTemplate(false);
          setTemplateGroups(staticTemplate.length > 0 ? staticTemplate : []);
          setError('Kunde inte läsa in den förinställda tidkortsmallen. Standardinnehåll visas i stället.');
          return;
        }
      }

      if (isAdminView) {
        return;
      }

      try {
        const templateId = buildTemplateId(userId, selectedProgram, selectedSpecialization);
        const templateDoc = await getDoc(doc(db, 'timesheetTemplates', templateId));

        if (templateDoc.exists()) {
          const stored = parseStoredTemplate(templateDoc.data().groups);
          if (stored) {
            setTemplateGroups(stored);
            setHasSavedTemplate(true);
            return;
          }
        }
      } catch (teacherTemplateError) {
        console.error('Error loading teacher timesheet template:', teacherTemplateError);
        setError('Kunde inte läsa in din sparade lärarmall. Adminmallen visas i stället.');
      }

      setHasSavedTemplate(false);
      setTemplateGroups(resolvedBaseTemplate.length > 0 ? resolvedBaseTemplate : []);
    };

    if (!loading) {
      void loadTemplate();
    }
  }, [isAdminView, loading, selectedProgram, selectedSpecialization, userId]);

  const visibleItems = templateGroups.reduce(
    (sum, group) => sum + group.items.filter((item) => item.enabled).length,
    0,
  );
  const totalItems = countTemplateItems(templateGroups);
  const baseItems = countTemplateItems(baseTemplateGroups);
  const displayedBaseGroups = isAdminView ? templateGroups : builtInEditableGroups;

  const saveTemplate = async () => {
    if (!userId || !selectedProgram) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const emptyGroups = templateGroups.filter(
        (group) => group.group.trim() && group.items.every((item) => !item.name.trim()),
      );

      if (emptyGroups.length > 0) {
        setError(
          `Lägg till minst en arbetsuppgift i gruppen "${emptyGroups[0].group}" innan du sparar.`,
        );
        return;
      }

      const sanitizedGroups = sanitizeTemplateGroups(templateGroups);
      if (sanitizedGroups.length === 0 || countTemplateItems(sanitizedGroups) === 0) {
        setError('Lägg till minst en grupp och en arbetsuppgift innan du sparar tidkortsmallen.');
        return;
      }

      if (isAdminView) {
        const templateId = buildDefaultTemplateId(
          selectedProgram,
          selectedSpecialization,
        );

        await setDoc(
          doc(db, 'defaultTimesheetTemplates', templateId),
          {
            program: selectedProgram,
            specialization: selectedSpecialization,
            groups: sanitizedGroups,
            updatedAt: serverTimestamp(),
            updatedBy: userId,
          },
          { merge: true },
        );
      } else {
        const templateId = buildTemplateId(userId, selectedProgram, selectedSpecialization);

        await setDoc(
          doc(db, 'timesheetTemplates', templateId),
          {
            teacherUid: userId,
            program: selectedProgram,
            specialization: selectedSpecialization,
            groups: sanitizedGroups,
            hasBuiltInTemplate,
            updatedAt: serverTimestamp(),
            updatedBy: userId,
          },
          { merge: true },
        );
      }

      setTemplateGroups(sanitizedGroups);
      setHasSavedTemplate(true);
      setBaseTemplateGroups(isAdminView ? sanitizedGroups : baseTemplateGroups);
      setMessage(
        isAdminView
          ? 'Förinställd tidkortsmall sparad. Lärare får nu denna mall som grund.'
          : 'Tidkortsmall sparad. Elever med denna inriktning använder nu denna mall.',
      );
    } catch (saveError) {
      console.error('Error saving timesheet template:', saveError);
      setError('Kunde inte spara tidkortsmallen.');
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = async () => {
    if (!userId || !selectedProgram) return;
    if (!window.confirm('Återställ denna tidkortsmall till standard?')) return;

    try {
      if (isAdminView) {
        const templateId = buildDefaultTemplateId(
          selectedProgram,
          selectedSpecialization,
        );
        await deleteDoc(doc(db, 'defaultTimesheetTemplates', templateId));
      } else {
        const templateId = buildTemplateId(userId, selectedProgram, selectedSpecialization);
        await deleteDoc(doc(db, 'timesheetTemplates', templateId));
      }

      const fallbackTemplate = templateFromActivityGroups(
        getBuiltInActivityTemplate(selectedSpecialization || undefined, selectedProgram),
      );
      setBaseTemplateGroups(fallbackTemplate);
      setTemplateGroups(isAdminView ? fallbackTemplate : baseTemplateGroups);
      setHasSavedTemplate(false);
      setMessage(
        isAdminView
          ? 'Den förinställda tidkortsmallen återställdes till kodens standardmall.'
          : 'Tidkortsmallen återställdes till standard.',
      );
      setError(null);
    } catch (deleteError) {
      console.error('Error resetting timesheet template:', deleteError);
      setError('Kunde inte återställa tidkortsmallen.');
    }
  };

  const toggleItem = (groupName: string, itemName: string) => {
    setTemplateGroups((current) =>
      current.map((group) =>
        group.group !== groupName
          ? group
          : {
              ...group,
              items: group.items.map((item) =>
                item.name !== itemName ? item : { ...item, enabled: !item.enabled },
              ),
            },
      ),
    );
  };

  const toggleGroupVisibility = (groupName: string) => {
    setTemplateGroups((current) =>
      current.map((group) => {
        if (group.group !== groupName) return group;

        const shouldEnableAll = group.items.every((item) => !item.enabled);
        return {
          ...group,
          items: group.items.map((item) => ({
            ...item,
            enabled: shouldEnableAll,
          })),
        };
      }),
    );
  };

  const addItemToGroup = (groupName: string) => {
    const draft = (groupDrafts[groupName] ?? '').trim();
    if (!draft) {
      setError('Ange en arbetsuppgift innan du lägger till den.');
      return;
    }

    setTemplateGroups((current) =>
      current.map((group) => {
        if (group.group !== groupName) return group;
        if (group.items.some((item) => item.name.toLowerCase() === draft.toLowerCase())) {
          return group;
        }

        return {
          ...group,
          items: [...group.items, { name: draft, enabled: true }],
        };
      }),
    );
    setGroupDrafts((current) => ({ ...current, [groupName]: '' }));
    setError(null);
  };

  const removeItemFromGroup = (groupName: string, itemName: string) => {
    if (!isAdminView && hasItemInGroup(baseTemplateGroups, groupName, itemName)) {
      setError('Förinställda arbetsmoment kan bara döljas, inte tas bort.');
      return;
    }

    setTemplateGroups((current) =>
      current
        .map((group) =>
          group.group !== groupName
            ? group
            : {
                ...group,
                items: group.items.filter((item) => item.name !== itemName),
              },
        )
        .filter((group) => group.items.length > 0),
    );
  };

  const removeGroup = (groupName: string) => {
    if (!isAdminView && hasGroup(baseTemplateGroups, groupName)) {
      setError('Förinställda grupper kan bara döljas via sina arbetsmoment, inte tas bort.');
      return;
    }

    setTemplateGroups((current) => current.filter((group) => group.group !== groupName));
  };

  const addGroup = () => {
    const draft = newGroupName.trim();
    if (!draft) {
      setError('Ange ett gruppnamn.');
      return;
    }

    if (templateGroups.some((group) => group.group.toLowerCase() === draft.toLowerCase())) {
      setError('Gruppen finns redan.');
      return;
    }

    setTemplateGroups((current) => [...current, { group: draft, items: [] }]);
    setNewGroupName('');
    setError(null);
  };

  if (loading || !userRole) {
    return <div className="flex min-h-[40vh] items-center justify-center text-gray-500">Laddar tidkortsmallar...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tidkort</h1>
          <p className="mt-2 max-w-3xl text-gray-600">
            {isAdminView
              ? 'Välj program och yrkesutgång för att skapa och ändra de förinställda tidkort som lärarna sedan får som grundmall.'
              : 'Välj program och yrkesutgång för att se det som redan finns i grundmallen, dölja förinställda arbetsmoment och lägga till egna moment för just dina elever.'}
          </p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          {visibleItems} synliga av {totalItems} arbetsuppgifter i aktuell mall
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {userRole === 'teacher' && teacherAssignedPrograms.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Du är kopplad till följande program: {teacherAssignedPrograms.join(', ')}
        </div>
      )}

      <section className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_1fr_auto_auto]">
        <label className="space-y-2">
          <span className="text-sm font-medium text-gray-700">Program</span>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            {[...programs].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map((program) => (
              <option key={program.name} value={program.name}>
                {program.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-gray-700">Yrkesutgång</span>
          <select
            value={selectedSpecialization}
            onChange={(e) => setSelectedSpecialization(e.target.value)}
            disabled={availableSpecializations.length === 0}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-gray-100"
          >
            {availableSpecializations.length === 0 ? (
              <option value="">Ingen yrkesutgång</option>
            ) : (
              availableSpecializations.map((specialization) => (
                <option key={specialization} value={specialization}>
                  {specialization}
                </option>
              ))
            )}
          </select>
        </label>

        <button
          onClick={resetTemplate}
          disabled={!hasSavedTemplate}
          className="self-end rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Återställ
        </button>

        <button
          onClick={saveTemplate}
          disabled={saving}
          className="inline-flex self-end items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Spara mall
        </button>
      </section>

      {displayedBaseGroups.length === 0 && (
        <section className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Bygg eget tidkort</h2>
          <p className="mt-2 text-sm text-gray-600">
            {isAdminView
              ? 'Det finns inga förinställda tidkort för den här kombinationen ännu. Börja med att lägga till grupper och arbetsuppgifter som ska bli standard för lärarna.'
              : 'Det finns inga förinställda tidkort för den här kombinationen ännu. Börja med att lägga till en egen grupp och fyll sedan på med arbetsuppgifter.'}
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Det som redan finns</h2>
            <p className="mt-1 text-sm text-gray-600">
              {hasBuiltInTemplate
                ? `Det finns en förinställd grundmall med ${baseItems} arbetsuppgifter för den här kombinationen.`
                : 'Det finns ingen förinställd grundmall här ännu.'}
            </p>
          </div>
          <div className={`rounded-full px-3 py-1 text-sm ${hasSavedTemplate ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}`}>
            {hasSavedTemplate
              ? isAdminView
                ? 'Förinställd adminmall sparad'
                : 'Egen lärarmall sparad'
              : isAdminView
                ? 'Ingen adminmall sparad ännu'
                : 'Ingen egen lärarmall sparad ännu'}
          </div>
        </div>

        {displayedBaseGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
            Ingen grundmall hittades. Lägg till en egen grupp och egna arbetsuppgifter nedan för att skapa ett tidkort för just denna inriktning.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {displayedBaseGroups.map((group) => {
              const visibleCount = group.items.filter((item) => item.enabled).length;
              const groupHidden = visibleCount === 0;

              const isExpanded = expandedGroups.has(group.group);

              return (
                <article key={`base-${group.group}`} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <button
                    onClick={() => toggleGroupExpansion(group.group)}
                    className="w-full p-6 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">{group.group}</h3>
                            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs text-orange-700 ring-1 ring-orange-200">
                              {isAdminView ? 'Standardgrupp' : 'Förinställd grupp'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            {visibleCount} av {group.items.length} arbetsuppgifter synliga
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroupVisibility(group.group);
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        {groupHidden ? 'Visa grupp' : 'Dölj grupp'}
                      </button>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-6">

                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const builtInItem = hasItemInGroup(baseTemplateGroups, group.group, item.name);

                      return (
                        <label
                          key={`${group.group}-${item.name}`}
                          className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${item.enabled ? 'border-orange-100 bg-orange-50/50' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                        >
                          <span className="flex items-center gap-3">
                            {item.enabled ? (
                              <Wrench className="h-4 w-4 text-orange-600" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            )}
                            <span>{item.name}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs ${builtInItem ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'}`}>
                              {builtInItem ? (isAdminView ? 'Standard' : 'Förinställd') : 'Egen'}
                            </span>
                          </span>
                          <div className="ml-3 flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={() => toggleItem(group.group, item.name)}
                              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                            {builtInItem && !isAdminView ? (
                              <span className="text-xs text-gray-400">Kan bara döljas</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeItemFromGroup(group.group, item.name)}
                                className="text-gray-500 transition hover:text-gray-700"
                                aria-label={`Ta bort ${item.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input
                          type="text"
                          value={groupDrafts[group.group] ?? ''}
                          onChange={(e) => setGroupDrafts((current) => ({ ...current, [group.group]: e.target.value }))}
                          placeholder="Ny arbetsuppgift i gruppen"
                          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        />
                        <button
                          onClick={() => addItemToGroup(group.group)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 px-4 py-3 font-medium text-orange-700 transition hover:bg-orange-50"
                        >
                          <Plus className="h-4 w-4" />
                          Lägg till uppgift
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
            <FolderPlus className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{isAdminView ? 'Lägg till grupp i standardmallen' : 'Lägg till egen grupp'}</h2>
            <p className="text-sm text-gray-600">{isAdminView ? 'Här skapar du nya grupper som blir förinställda för lärare i vald inriktning.' : 'Behövs ett nytt område i tidkortet kan du skapa det här och fylla på med arbetsuppgifter.'}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Till exempel Service och felsökning"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <button
            onClick={addGroup}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 px-4 py-3 font-medium text-orange-700 transition hover:bg-orange-50"
          >
            <Plus className="h-4 w-4" />
            Lägg till grupp
          </button>
        </div>
      </section>

      {!isAdminView && customGroups.length > 0 && (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Egna grupper</h2>
          <p className="mt-1 text-sm text-gray-600">
            Här ligger grupper som läraren själv har skapat för just sina elever.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
        {customGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.group);

          return (
          <article key={group.group} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <button
              onClick={() => toggleGroupExpansion(group.group)}
              className="w-full p-6 text-left transition hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{group.group}</h3>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 ring-1 ring-blue-200">
                        Egen grupp
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {group.items.filter((item) => item.enabled).length} av {group.items.length} arbetsuppgifter synliga
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeGroup(group.group);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Ta bort grupp
                </button>
              </div>
            </button>

            {isExpanded && (
              <div className="px-6 pb-6">

            <div className="space-y-2">
              {group.items.map((item) => (
                    <label
                      key={`${group.group}-${item.name}`}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${item.enabled ? 'border-orange-100 bg-orange-50/50' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
                    >
                      <span className="flex items-center gap-3">
                        {item.enabled ? (
                          <Wrench className="h-4 w-4 text-orange-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                        <span>{item.name}</span>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 ring-1 ring-blue-200">
                          Egen
                        </span>
                      </span>
                      <div className="ml-3 flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={() => toggleItem(group.group, item.name)}
                          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeItemFromGroup(group.group, item.name)}
                          className="text-gray-500 transition hover:text-gray-700"
                          aria-label={`Ta bort ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </label>
              ))}
            </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={groupDrafts[group.group] ?? ''}
                    onChange={(e) => setGroupDrafts((current) => ({ ...current, [group.group]: e.target.value }))}
                    placeholder="Ny arbetsuppgift"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <button
                    onClick={() => addItemToGroup(group.group)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 px-4 py-3 font-medium text-orange-700 transition hover:bg-orange-50"
                  >
                    <Plus className="h-4 w-4" />
                    Lägg till uppgift
                  </button>
                </div>
              </div>
            )}
          </article>
          );
        })}
        </div>
      </section>
      )}
    </div>
  );
}