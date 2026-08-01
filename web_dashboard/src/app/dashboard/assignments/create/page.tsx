'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type StudentOption = {
  id: string;
  name: string;
  email: string;
  className: string;
};

export default function CreateAssignmentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({});

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        router.push('/login');
        return;
      }

      const userData = userDoc.data();
      const role = (userData.role ?? '').toString();
      if (role !== 'teacher') {
        router.push('/dashboard');
        return;
      }

      setUserId(user.uid);
      setUserName((userData.displayName ?? userData.name ?? user.email ?? 'Lärare').toString());
      setSchoolId((userData.school ?? '').toString());

      const studentQuery = query(collection(db, 'users'), where('teacherUid', '==', user.uid));
      const studentSnapshot = await getDocs(studentQuery);

      const classSnapshot = await getDocs(query(collection(db, 'classes'), where('teacherUid', '==', user.uid)));
      const classMap = new Map<string, string>(
        classSnapshot.docs.map((classDoc) => [classDoc.id, (classDoc.data().name ?? 'Ingen klass').toString()]),
      );

      const studentOptions = studentSnapshot.docs
        .filter((studentDoc) => (studentDoc.data().role ?? '').toString() === 'student')
        .map((studentDoc) => {
          const data = studentDoc.data();
          const display = (data.displayName ?? data.name ?? '').toString().trim();
          const email = (data.email ?? '').toString().trim();
          const classId = (data.classId ?? '').toString().trim();
          return {
            id: studentDoc.id,
            name: display || email || 'Okänd elev',
            email,
            className: classMap.get(classId) ?? (classId || 'Ingen klass'),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));

      setStudents(studentOptions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const selectedIds = useMemo(
    () => Object.entries(selectedStudents).filter(([, checked]) => checked).map(([id]) => id),
    [selectedStudents],
  );

  const classOptions = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.className))).sort((a, b) =>
      a.localeCompare(b, 'sv-SE'),
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!selectedClass) {
      return [];
    }
    return students.filter((student) => student.className === selectedClass);
  }, [students, selectedClass]);

  const markAllInSelectedClass = () => {
    if (!selectedClass || filteredStudents.length === 0) {
      return;
    }

    setSelectedStudents((prev) => {
      const next = { ...prev };
      for (const student of filteredStudents) {
        next[student.id] = true;
      }
      return next;
    });
  };

  const onCreateAssignment = async () => {
    setError('');

    if (!title.trim() || !description.trim()) {
      setError('Titel och beskrivning är obligatoriskt.');
      return;
    }

    if (selectedIds.length === 0) {
      setError('Välj minst en elev.');
      return;
    }

    setSaving(true);

    try {
      const now = Timestamp.now();
      const due = dueDate ? Timestamp.fromDate(new Date(`${dueDate}T23:59:59`)) : null;

      const assignmentRef = await addDoc(collection(db, 'assignments'), {
        title: title.trim(),
        description: description.trim(),
        createdBy: userId,
        createdByName: userName,
        schoolId,
        assignedTo: selectedIds,
        assignmentStatus: 'active',
        createdAt: now,
        updatedAt: now,
        dueDate: due,
        totalAssigned: selectedIds.length,
        totalSubmitted: 0,
      });

      await Promise.all(
        selectedIds.map((studentId) =>
          setDoc(doc(db, 'assignments', assignmentRef.id, 'assignees', studentId), {
            studentId,
            isNew: true,
            assignedAt: now,
            seenAt: null,
            submittedAt: null,
          }),
        ),
      );

      router.push(`/dashboard/assignments/${assignmentRef.id}`);
    } catch (submitError) {
      console.error('Create assignment error:', submitError);
      setError('Kunde inte skapa uppgiften. Försök igen.');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-slate-600">Laddar...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Skapa uppgift</h1>
          <p className="mt-1 text-sm text-slate-600">Tilldela uppgiften till en eller flera elever.</p>
        </div>
        <Link href="/dashboard/assignments" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Tillbaka
        </Link>
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Titel</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Ex: Vecka 14 - Säkerhetsreflektion"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Beskrivning</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Skriv instruktioner till eleven..."
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Deadline (valfritt)</label>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-72"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Välj klass</label>
          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-80"
          >
            <option value="">Välj klass...</option>
            {classOptions.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-slate-700">Tilldela elever</label>
            <div className="flex items-center gap-3">
              {selectedClass && filteredStudents.length > 0 && (
                <button
                  type="button"
                  onClick={markAllInSelectedClass}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Markera alla
                </button>
              )}
              <span className="text-xs text-slate-500">{selectedIds.length} valda</span>
            </div>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3">
            {students.length === 0 ? (
              <p className="text-sm text-slate-500">Inga elever hittades.</p>
            ) : !selectedClass ? (
              <p className="text-sm text-slate-500">Välj först en klass för att se elever.</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-sm text-slate-500">Inga elever hittades i vald klass.</p>
            ) : (
              filteredStudents.map((student) => (
                <label key={student.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={!!selectedStudents[student.id]}
                    onChange={(event) =>
                      setSelectedStudents((prev) => ({
                        ...prev,
                        [student.id]: event.target.checked,
                      }))
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.email || 'Ingen e-post'} • {student.className}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCreateAssignment}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {saving ? 'Skapar uppgift...' : 'Skapa uppgift'}
          </button>
        </div>
      </div>
    </div>
  );
}
