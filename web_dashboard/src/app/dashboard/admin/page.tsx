'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db, functions } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Clock3, GraduationCap, School, Users } from 'lucide-react';

interface AdminStats {
  totalSchools: number;
  totalTeachers: number;
  totalStudents: number;
  pendingTeachers: number;
  approvedTeachers: number;
}

interface PendingTeacher {
  id: string;
  name: string;
  email: string;
  school: string;
  status?: string;
  createdAt: any;
}

interface ApprovedTeacher {
  id: string;
  name: string;
  email: string;
  school: string;
  status?: string;
  createdAt: any;
}

interface Student {
  id: string;
  name: string;
  email: string;
  school: string;
  status?: string;
  createdAt: any;
}

interface SchoolSummary {
  name: string;
  teacherCount: number;
}

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  school?: string;
  classId?: string;
  teacherUid?: string;
  specialization?: string;
  status?: string;
  assignedPrograms?: string[];
}

interface ClassSummary {
  id: string;
  name: string;
  teacherUid?: string;
  archived?: boolean;
}

function normalizeProgramList(value: unknown): string[] {
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

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats>({
    totalSchools: 0,
    totalTeachers: 0,
    totalStudents: 0,
    pendingTeachers: 0,
    approvedTeachers: 0,
  });
  const [pendingTeachers, setPendingTeachers] = useState<PendingTeacher[]>([]);
  const [approvedTeachers, setApprovedTeachers] = useState<ApprovedTeacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [allTeachers, setAllTeachers] = useState<UserSummary[]>([]);
  const [allStudents, setAllStudents] = useState<UserSummary[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [programOptions, setProgramOptions] = useState<string[]>([]);
  const [teacherProgramsById, setTeacherProgramsById] = useState<Record<string, string[]>>({});
  const [savingTeacherProgramsId, setSavingTeacherProgramsId] = useState<string | null>(null);
  const [openProgramDropdownByTeacher, setOpenProgramDropdownByTeacher] = useState<Record<string, boolean>>({});
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [classActionLoadingId, setClassActionLoadingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'pending' | 'approved' | 'schools' | 'students'>('pending');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    school: '',
    approved: true,
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'pending' || section === 'approved' || section === 'schools' || section === 'students') {
      setActiveSection(section);
    }
  }, [searchParams]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if user is admin
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        router.push('/login');
        return;
      }

      const userData = userDoc.data();
      const role = userData.role;
      setUserRole(role);

      if (role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setCurrentUser(user);
      await fetchAdminData();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const mapTeacher = (teacher: any) => ({
    id: teacher.id,
    name: teacher.name || 'Okänt namn',
    email: teacher.email || '',
    school: teacher.school || 'Ingen skola angiven',
    createdAt: teacher.createdAt,
  });

  const getCreatedAtMs = (value: any): number => {
    if (!value) {
      return 0;
    }
    if (typeof value.toMillis === 'function') {
      return value.toMillis();
    }
    if (typeof value.seconds === 'number') {
      const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
      return value.seconds * 1000 + Math.floor(nanos / 1000000);
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    return 0;
  };

  const mapStudent = (student: any) => ({
    id: student.id,
    name: student.name || 'Okänt namn',
    email: student.email || '',
    school: student.school || 'Ingen skola angiven',
    createdAt: student.createdAt,
  });

  const fetchAdminData = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const catalogDoc = await getDoc(doc(db, 'appSettings', 'programCatalog'));
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      const teachers = users.filter((u: any) => u.role === 'teacher');
      const students = users.filter((u: any) => u.role === 'student');
      const pending = teachers.filter(t => !t.approved);
      const approved = teachers.filter(t => t.approved);

      // Count unique schools
      const schoolSet = new Set(teachers.map(t => t.school).filter(s => s));
      const schoolCounts = new Map<string, number>();
      teachers.forEach((teacher) => {
        if (!teacher.school) {
          return;
        }
        const current = schoolCounts.get(teacher.school) || 0;
        schoolCounts.set(teacher.school, current + 1);
      });

      setClasses(
        classesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Okänd klass',
          teacherUid: doc.data().teacherUid || '',
          archived: doc.data().archived === true,
        }))
      );

      const programsFromCatalog = catalogDoc.exists()
        ? normalizeProgramList((catalogDoc.data() as any)?.programs?.map((entry: any) => entry?.name))
        : [];
      setProgramOptions(programsFromCatalog.sort((a, b) => a.localeCompare(b, 'sv-SE')));

      const nextTeacherProgramsById: Record<string, string[]> = {};
      for (const teacher of approved) {
        nextTeacherProgramsById[teacher.id] = normalizeProgramList(teacher.assignedPrograms);
      }
      setTeacherProgramsById(nextTeacherProgramsById);

      setSchools(
        Array.from(schoolCounts.entries())
          .map(([name, teacherCount]) => ({ name, teacherCount }))
          .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'))
      );

      const sortedPendingTeachers = pending
        .map(mapTeacher)
        .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt));
      
      // Update teacher lists
      setPendingTeachers(sortedPendingTeachers);
      setApprovedTeachers(approved.map(mapTeacher));
      setAllTeachers(
        approved
          .map((teacher) => ({
            id: teacher.id,
            name: teacher.name || 'Okänt namn',
            email: teacher.email || '',
            role: teacher.role || 'teacher',
            school: teacher.school || 'Ingen skola angiven',
            status: teacher.status || 'active',
            assignedPrograms: normalizeProgramList(teacher.assignedPrograms),
          }))
          .sort((a, b) => {
            const schoolCompare = (a.school || '').localeCompare((b.school || ''), 'sv-SE');
            if (schoolCompare !== 0) return schoolCompare;
            return a.name.localeCompare(b.name, 'sv-SE');
          }),
      );

      setAllStudents(
        students.map((student) => ({
          id: student.id,
          name: student.name || 'Okänt namn',
          email: student.email || '',
          role: student.role || 'student',
          school: student.school || 'Ingen skola angiven',
          classId: student.classId || '',
          teacherUid: student.teacherUid || '',
          status: student.status || 'active',
        })),
      );
      
      // Update stats
      setStats({
        totalSchools: schoolCounts.size,
        totalTeachers: teachers.length,
        totalStudents: students.length,
        pendingTeachers: pending.length,
        approvedTeachers: approved.length,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleTeacherProgramToggle = (teacherId: string, programName: string) => {
    setTeacherProgramsById((current) => {
      const selected = current[teacherId] ?? [];
      const exists = selected.some((entry) => entry.toLowerCase() === programName.toLowerCase());

      const nextSelected = exists
        ? selected.filter((entry) => entry.toLowerCase() !== programName.toLowerCase())
        : [...selected, programName];

      return {
        ...current,
        [teacherId]: nextSelected,
      };
    });
  };

  const toggleTeacherProgramDropdown = (teacherId: string) => {
    setOpenProgramDropdownByTeacher((current) => ({
      ...current,
      [teacherId]: !current[teacherId],
    }));
  };

  const handleSaveTeacherPrograms = async (teacherId: string) => {
    try {
      setSavingTeacherProgramsId(teacherId);
      const assignedPrograms = normalizeProgramList(teacherProgramsById[teacherId] ?? []);
      await updateDoc(doc(db, 'users', teacherId), { assignedPrograms });
      await fetchAdminData();
      alert('Programkoppling sparad.');
    } catch (saveError: any) {
      console.error('Error saving teacher programs:', saveError);
      alert(saveError?.message || 'Kunde inte spara programkoppling.');
    } finally {
      setSavingTeacherProgramsId(null);
    }
  };

  const handleCreateTeacher = async () => {
    setFormError(null);
    if (!teacherForm.firstName || !teacherForm.lastName || !teacherForm.email || !teacherForm.password || !teacherForm.school) {
      setFormError('Fyll i förnamn, efternamn, e-post, lösenord och skola.');
      return;
    }

    try {
      setCreating(true);
      const createUser = httpsCallable(functions, 'createUser');
      await createUser({
        role: 'teacher',
        firstName: teacherForm.firstName,
        lastName: teacherForm.lastName,
        email: teacherForm.email,
        password: teacherForm.password,
        school: teacherForm.school,
        approved: teacherForm.approved,
      });
      setTeacherForm({ firstName: '', lastName: '', email: '', password: '', school: '', approved: true });
      await fetchAdminData();
    } catch (error: any) {
      setFormError(error?.message || 'Fel vid skapande av lärare.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Är du säker på att du vill ta bort användaren?')) {
      return;
    }
    try {
      const deleteUserCallable = httpsCallable(functions, 'deleteUser');
      await deleteUserCallable({ uid });
      await fetchAdminData();
    } catch (error: any) {
      alert(error?.message || 'Fel vid borttagning.');
    }
  };

  const getTeacherClasses = (teacherId: string) =>
    classes
      .filter((classItem) => (classItem.teacherUid || '') === teacherId)
      .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));

  const teacherGroups = Object.entries(
    allTeachers.reduce<Record<string, UserSummary[]>>((groups, teacher) => {
      const schoolName = (teacher.school || 'Ingen skola angiven').trim() || 'Ingen skola angiven';
      if (!groups[schoolName]) {
        groups[schoolName] = [];
      }
      groups[schoolName].push(teacher);
      return groups;
    }, {}),
  )
    .sort((a, b) => a[0].localeCompare(b[0], 'sv-SE'))
    .map(([school, teacherList]) => ({
      school,
      teachers: [...teacherList].sort((a, b) => a.name.localeCompare(b.name, 'sv-SE')),
    }));

  const getClassStudentCount = (classId: string) =>
    allStudents.filter((student) => (student.classId || '') === classId).length;

  const getClassStudents = (classId: string) =>
    allStudents
      .filter((student) => (student.classId || '') === classId)
      .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));

  const handleArchiveClass = async (classId: string) => {
    try {
      setClassActionLoadingId(classId);
      await updateDoc(doc(db, 'classes', classId), {
        archived: true,
        archivedAt: new Date(),
        archivedBy: currentUser?.uid || '',
      });
      await fetchAdminData();
    } catch (error: any) {
      alert(error?.message || 'Kunde inte arkivera klassen.');
    } finally {
      setClassActionLoadingId(null);
    }
  };

  const handleRestoreClass = async (classId: string) => {
    try {
      setClassActionLoadingId(classId);
      await updateDoc(doc(db, 'classes', classId), {
        archived: false,
        archivedAt: deleteField(),
        archivedBy: deleteField(),
      });
      await fetchAdminData();
    } catch (error: any) {
      alert(error?.message || 'Kunde inte återställa klassen.');
    } finally {
      setClassActionLoadingId(null);
    }
  };

  const handleDeleteClassPermanent = async (classId: string, className: string) => {
    const confirmDelete = confirm(
      `Ta bort klassen "${className}" permanent? Historik kopplas loss men själva klassen försvinner. Detta kan inte ångras.`,
    );
    if (!confirmDelete) {
      return;
    }

    try {
      setClassActionLoadingId(classId);
      const deleteClassCallable = httpsCallable(functions, 'deleteClass');
      await deleteClassCallable({ classId, confirm: classId, hardDeleteTimesheets: false });
      await fetchAdminData();
    } catch (error: any) {
      alert(error?.message || 'Kunde inte ta bort klassen permanent.');
    } finally {
      setClassActionLoadingId(null);
    }
  };

  const handleSetUserStatus = async (uid: string, status: 'active' | 'frozen') => {
    const action = status === 'frozen' ? 'frysa' : 'aktivera';
    if (!confirm(`Är du säker på att du vill ${action} denna användare?`)) {
      return;
    }
    try {
      const setUserStatusCallable = httpsCallable(functions, 'setUserStatus');
      await setUserStatusCallable({ uid, status });
      await fetchAdminData();
      alert(`Användaren har ${status === 'frozen' ? 'frysts' : 'aktiverats'}!`);
    } catch (error: any) {
      alert(error?.message || `Fel vid ${action} av användare.`);
    }
  };

  const handleApproveTeacher = async (teacherId: string) => {
    try {
      // Update teacher's approved status
      await updateDoc(doc(db, 'users', teacherId), {
        approved: true,
      });

      // Find and delete admin notification
      const notificationsQuery = query(
        collection(db, 'adminNotifications'),
        where('teacherId', '==', teacherId),
        where('resolved', '==', false)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      notificationsSnapshot.docs.forEach(async (notificationDoc) => {
        await updateDoc(doc(db, 'adminNotifications', notificationDoc.id), {
          resolved: true,
          resolvedAt: new Date(),
        });
      });

      // Refresh data
      await fetchAdminData();

      alert('Läraren har godkänts!');
    } catch (error) {
      console.error('Error approving teacher:', error);
      alert('Fel vid godkännande av lärare');
    }
  };

  const handleRejectTeacher = async (teacherId: string) => {
    if (!confirm('Är du säker på att du vill avslå denna lärare? Detta tar bort kontot permanent.')) {
      return;
    }

    try {
      // Delete teacher account
      await deleteDoc(doc(db, 'users', teacherId));

      // Delete admin notification
      const notificationsQuery = query(
        collection(db, 'adminNotifications'),
        where('teacherId', '==', teacherId)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      notificationsSnapshot.docs.forEach(async (notificationDoc) => {
        await deleteDoc(doc(db, 'adminNotifications', notificationDoc.id));
      });

      // Refresh data
      await fetchAdminData();

      alert('Läraren har avslagits och kontot har tagits bort');
    } catch (error) {
      console.error('Error rejecting teacher:', error);
      alert('Fel vid avslag av lärare');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-700">
        <p>Laddar...</p>
      </div>
    );
  }

  const statCardBase =
    'rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:shadow';
  const statCardActive = 'ring-2 ring-orange-200';

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute top-[35%] left-[-10%] h-[360px] w-[360px] rounded-full bg-orange-100/60 blur-3xl" />
      </div>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-700">Adminpanel</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Översikt och lärarhantering</h1>
          <p className="mt-2 text-sm text-slate-600">Hantera lärare, lägg till, frys eller ta bort.</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveSection('approved')}
            className={`${statCardBase} ${activeSection === 'approved' ? statCardActive : ''}`}
            aria-label="Visa godkända lärare"
          >
            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <Users className="h-4 w-4 text-orange-600" />
              </span>
              <p className="text-sm font-medium">Godkända lärare</p>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{stats.approvedTeachers}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('pending')}
            className={`${statCardBase} ${activeSection === 'pending' ? statCardActive : ''}`}
            aria-label="Visa väntande lärare"
          >
            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <Clock3 className="h-4 w-4 text-orange-600" />
              </span>
              <p className="text-sm font-medium">Väntande lärare</p>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{stats.pendingTeachers}</p>
          </button>
        </div>

        {/* Admin user management */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-slate-900">Lägg till lärare</h2>
              <p className="mt-1 text-sm text-slate-600">Skapa lärarkonto</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  value={teacherForm.firstName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Förnamn"
                  autoComplete="off"
                />
                <input
                  value={teacherForm.lastName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Efternamn"
                  autoComplete="off"
                />
                <input
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="E-post"
                  autoComplete="off"
                  type="email"
                />
                <input
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Lösenord"
                  type="password"
                  autoComplete="new-password"
                />
                <input
                  value={teacherForm.school}
                  onChange={(e) => setTeacherForm({ ...teacherForm, school: e.target.value })}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Skola"
                  autoComplete="off"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={teacherForm.approved}
                    onChange={(e) => setTeacherForm({ ...teacherForm, approved: e.target.checked })}
                  />
                  Godkänd direkt
                </label>
              </div>
              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
              <button
                onClick={handleCreateTeacher}
                disabled={creating}
                className="rounded-xl bg-orange-600 px-4 py-2 text-white transition hover:bg-orange-700 disabled:opacity-60"
              >
                Skapa lärare
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Hantera lärare</h2>
              <p className="mt-1 text-sm text-slate-600">Frysa/aktivera/ta bort lärare</p>
            </div>
            <div className="space-y-3 p-6">
              {teacherGroups.length === 0 ? (
                <p className="text-slate-500">Inga lärare</p>
              ) : (
                teacherGroups.map((group) => (
                  <div key={group.school} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.school}</h3>
                        <p className="text-xs text-slate-500">{group.teachers.length} lärare</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {group.teachers.map((teacher) => {
                        const teacherClasses = getTeacherClasses(teacher.id);
                        const activeTeacherClasses = teacherClasses.filter((classItem) => !classItem.archived);
                        const archivedTeacherClasses = teacherClasses.filter((classItem) => classItem.archived);
                        const isExpanded = expandedTeacherId === teacher.id;

                        return (
                          <div key={teacher.id} className="rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setExpandedTeacherId((current) => (current === teacher.id ? null : teacher.id))}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                            >
                              <span className="font-medium text-slate-900">{teacher.name}</span>
                              <span className="text-sm text-slate-500">{isExpanded ? 'Dölj info' : 'Visa info'}</span>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                                  <div className="space-y-1 text-sm text-slate-700">
                                    <p><span className="font-medium text-slate-900">E-post:</span> {teacher.email}</p>
                                    <p><span className="font-medium text-slate-900">Skola:</span> {teacher.school || 'Ej angiven'}</p>
                                    {teacher.status && (
                                      <p className={teacher.status === 'frozen' ? 'text-red-600' : 'text-green-600'}>
                                        <span className="font-medium text-slate-900">Status:</span> {teacher.status === 'frozen' ? 'Fryst' : 'Aktiv'}
                                      </p>
                                    )}
                                    <p>
                                      <span className="font-medium text-slate-900">Program:</span>{' '}
                                      {(teacherProgramsById[teacher.id] ?? []).length > 0
                                        ? (teacherProgramsById[teacher.id] ?? []).join(', ')
                                        : 'Alla program'}
                                    </p>
                                    <p>
                                      <span className="font-medium text-slate-900">Klasser:</span> {activeTeacherClasses.length} aktiva, {archivedTeacherClasses.length} arkiverade
                                    </p>
                                  </div>

                                  <div>
                                    {programOptions.length > 0 && (
                                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                                        <button
                                          type="button"
                                          onClick={() => toggleTeacherProgramDropdown(teacher.id)}
                                          className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-700"
                                          aria-expanded={openProgramDropdownByTeacher[teacher.id] ? 'true' : 'false'}
                                        >
                                          <span>Koppla program</span>
                                          <span>{openProgramDropdownByTeacher[teacher.id] ? '▲' : '▼'}</span>
                                        </button>

                                        {openProgramDropdownByTeacher[teacher.id] && (
                                          <div className="mt-2">
                                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                              {programOptions.map((programName) => {
                                                const checked = (teacherProgramsById[teacher.id] ?? []).some(
                                                  (entry) => entry.toLowerCase() === programName.toLowerCase(),
                                                );

                                                return (
                                                  <label key={`${teacher.id}-${programName}`} className="flex items-center gap-2 text-xs text-slate-700">
                                                    <input
                                                      type="checkbox"
                                                      checked={checked}
                                                      onChange={() => handleTeacherProgramToggle(teacher.id, programName)}
                                                    />
                                                    <span>{programName}</span>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveTeacherPrograms(teacher.id)}
                                              disabled={savingTeacherProgramsId === teacher.id}
                                              className="mt-2 rounded-md border border-orange-300 px-2 py-1 text-xs font-medium text-orange-700 transition hover:bg-orange-50 disabled:opacity-60"
                                            >
                                              {savingTeacherProgramsId === teacher.id ? 'Sparar...' : 'Spara program'}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {teacher.status !== 'frozen' && (
                                        <button
                                          onClick={() => handleSetUserStatus(teacher.id, 'frozen')}
                                          className="text-sm font-medium text-red-600 hover:text-red-800"
                                        >
                                          Frysa
                                        </button>
                                      )}
                                      {teacher.status === 'frozen' && (
                                        <button
                                          onClick={() => handleSetUserStatus(teacher.id, 'active')}
                                          className="text-sm font-medium text-green-600 hover:text-green-800"
                                        >
                                          Aktivera
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteUser(teacher.id)}
                                        className="text-sm font-medium text-slate-600 hover:text-slate-800"
                                      >
                                        Ta bort
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                  <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Aktiva klasser</p>
                                    {activeTeacherClasses.length === 0 ? (
                                      <p className="text-sm text-slate-500">Inga aktiva klasser.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {activeTeacherClasses.map((classItem) => (
                                          <div key={classItem.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
                                            <div className="min-w-0 flex-1 pr-3">
                                              <p className="text-sm font-medium text-slate-900">{classItem.name}</p>
                                              <p className="text-xs text-slate-500">{getClassStudentCount(classItem.id)} elever</p>
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {getClassStudents(classItem.id).slice(0, 6).map((student) => (
                                                  <span
                                                    key={student.id}
                                                    className="inline-flex max-w-full rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-orange-100 transition hover:bg-orange-100"
                                                  >
                                                    <a href={`/dashboard/students/${student.id}`} className="truncate">
                                                      {student.name}
                                                    </a>
                                                  </span>
                                                ))}
                                                {getClassStudents(classItem.id).length > 6 && (
                                                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                    +{getClassStudents(classItem.id).length - 6} till
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <button
                                                type="button"
                                                onClick={() => handleArchiveClass(classItem.id)}
                                                disabled={classActionLoadingId === classItem.id}
                                                className="text-xs font-medium text-orange-700 hover:text-orange-900 disabled:opacity-60"
                                              >
                                                Arkivera
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteClassPermanent(classItem.id, classItem.name)}
                                                disabled={classActionLoadingId === classItem.id}
                                                className="text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-60"
                                              >
                                                Ta bort permanent
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Arkiverade klasser</p>
                                    {archivedTeacherClasses.length === 0 ? (
                                      <p className="text-sm text-slate-500">Inga arkiverade klasser.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {archivedTeacherClasses.map((classItem) => (
                                          <div key={classItem.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
                                            <div className="min-w-0 flex-1 pr-3">
                                              <p className="text-sm font-medium text-slate-900">{classItem.name}</p>
                                              <p className="text-xs text-slate-500">{getClassStudentCount(classItem.id)} elever</p>
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {getClassStudents(classItem.id).slice(0, 6).map((student) => (
                                                  <span
                                                    key={student.id}
                                                    className="inline-flex max-w-full rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                                                  >
                                                    <a href={`/dashboard/students/${student.id}`} className="truncate">
                                                      {student.name}
                                                    </a>
                                                  </span>
                                                ))}
                                                {getClassStudents(classItem.id).length > 6 && (
                                                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                    +{getClassStudents(classItem.id).length - 6} till
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <button
                                                type="button"
                                                onClick={() => handleRestoreClass(classItem.id)}
                                                disabled={classActionLoadingId === classItem.id}
                                                className="text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-60"
                                              >
                                                Återställ
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteClassPermanent(classItem.id, classItem.name)}
                                                disabled={classActionLoadingId === classItem.id}
                                                className="text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-60"
                                              >
                                                Ta bort permanent
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {activeSection === 'schools' && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Skolor</h2>
              <p className="text-sm text-gray-600 mt-1">Lista över skolor med anslutna lärare</p>
            </div>

            <div className="p-6">
              {schools.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Inga skolor hittades</p>
              ) : (
                <div className="space-y-3">
                  {schools.map((school) => (
                    <div
                      key={school.name}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">{school.name}</h3>
                        <span className="text-sm text-gray-600">{school.teacherCount} lärare</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'students' && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Elever</h2>
              <p className="text-sm text-gray-600 mt-1">Alla elever som är anslutna till appen</p>
            </div>

            <div className="p-6">
              {students.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Inga elever hittades</p>
              ) : (
                <div className="space-y-4">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{student.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">E-post:</span> {student.email}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Skola:</span> {student.school}
                          </p>
                          {student.status && (
                            <p className={`text-sm mt-2 font-medium ${student.status === 'frozen' ? 'text-red-600' : 'text-green-600'}`}>
                              Status: {student.status === 'frozen' ? 'Fryst' : 'Aktiv'}
                            </p>
                          )}
                          {student.createdAt && (
                            <p className="text-xs text-gray-500 mt-2">
                              Registrerad: {new Date(student.createdAt.seconds * 1000).toLocaleDateString('sv-SE')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {student.status !== 'frozen' && (
                            <button
                              onClick={() => handleSetUserStatus(student.id, 'frozen')}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Frysa
                            </button>
                          )}
                          {student.status === 'frozen' && (
                            <button
                              onClick={() => handleSetUserStatus(student.id, 'active')}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Aktivera
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'approved' && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Godkända lärare</h2>
              <p className="text-sm text-gray-600 mt-1">Alla lärare som är anslutna till appen</p>
            </div>

            <div className="p-6">
              {approvedTeachers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Inga godkända lärare</p>
              ) : (
                <div className="space-y-4">
                  {approvedTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{teacher.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">E-post:</span> {teacher.email}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Skola:</span> {teacher.school}
                          </p>
                          {teacher.status && (
                            <p className={`text-sm mt-2 font-medium ${teacher.status === 'frozen' ? 'text-red-600' : 'text-green-600'}`}>
                              Status: {teacher.status === 'frozen' ? 'Fryst' : 'Aktiv'}
                            </p>
                          )}
                          {teacher.createdAt && (
                            <p className="text-xs text-gray-500 mt-2">
                              Registrerad: {new Date(teacher.createdAt.seconds * 1000).toLocaleDateString('sv-SE')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {teacher.status !== 'frozen' && (
                            <button
                              onClick={() => handleSetUserStatus(teacher.id, 'frozen')}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Frysa
                            </button>
                          )}
                          {teacher.status === 'frozen' && (
                            <button
                              onClick={() => handleSetUserStatus(teacher.id, 'active')}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Aktivera
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'pending' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Väntande lärarregistreringar</h2>
              <p className="text-sm text-gray-600 mt-1">Godkänn eller avslå nya lärare</p>
            </div>

            <div className="p-6">
              {pendingTeachers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Inga väntande lärare</p>
              ) : (
                <div className="space-y-4">
                  {pendingTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="rounded-xl border border-slate-200 p-4 transition hover:border-orange-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{teacher.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">E-post:</span> {teacher.email}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Skola:</span> {teacher.school}
                          </p>
                          {teacher.createdAt && (
                            <p className="text-xs text-gray-500 mt-2">
                              Registrerad: {new Date(teacher.createdAt.seconds * 1000).toLocaleDateString('sv-SE')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleApproveTeacher(teacher.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
                          >
                            ✓ Godkänn
                          </button>
                          <button
                            onClick={() => handleRejectTeacher(teacher.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
                          >
                            ✗ Avslå
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
