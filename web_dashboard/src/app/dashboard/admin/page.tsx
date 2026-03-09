'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db, functions } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  const [classes, setClasses] = useState<Array<{ id: string; name: string; teacherUid?: string }>>([]);
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
    name: teacher.name || 'Okant namn',
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
    name: student.name || 'Okant namn',
    email: student.email || '',
    school: student.school || 'Ingen skola angiven',
    createdAt: student.createdAt,
  });

  const fetchAdminData = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const classesSnapshot = await getDocs(collection(db, 'classes'));
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
          name: doc.data().name || 'Okand klass',
          teacherUid: doc.data().teacherUid || '',
        }))
      );
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
      setAllTeachers(approved.map((teacher) => ({
        id: teacher.id,
        name: teacher.name || 'Okant namn',
        email: teacher.email || '',
        role: teacher.role || 'teacher',
        school: teacher.school || 'Ingen skola angiven',
        status: teacher.status || 'active',
      })));
      
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
    if (!confirm('Ar du saker pa att du vill ta bort anvandaren?')) {
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

  const handleSetUserStatus = async (uid: string, status: 'active' | 'frozen') => {
    const action = status === 'frozen' ? 'frysa' : 'aktivera';
    if (!confirm(`Ar du saker pa att du vill ${action} denna anvandare?`)) {
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
                Skapa larare
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Hantera lärare</h2>
              <p className="mt-1 text-sm text-slate-600">Frysa/aktivera/ta bort lärare</p>
            </div>
            <div className="space-y-3 p-6">
              {allTeachers.length === 0 ? (
                <p className="text-slate-500">Inga lärare</p>
              ) : (
                allTeachers.map((teacher) => (
                  <div key={teacher.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{teacher.name}</p>
                      <p className="text-xs text-slate-600">{teacher.email}</p>
                      <p className="text-xs text-slate-500">Skola: {teacher.school || 'Ej angiven'}</p>
                      {teacher.status && (
                        <p className={`mt-1 text-xs ${teacher.status === 'frozen' ? 'text-red-600' : 'text-green-600'}`}>
                          Status: {teacher.status === 'frozen' ? 'Fryst' : 'Aktiv'}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
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
                ))
              )}
            </div>
          </div>
        </div>

        {activeSection === 'schools' && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Skolor</h2>
              <p className="text-sm text-gray-600 mt-1">Lista over skolor med anslutna larare</p>
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
                        <span className="text-sm text-gray-600">{school.teacherCount} larare</span>
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
              <p className="text-sm text-gray-600 mt-1">Alla elever som ar anslutna till appen</p>
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
