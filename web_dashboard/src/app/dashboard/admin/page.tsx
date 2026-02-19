'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, functions } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

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
  createdAt: any;
}

interface ApprovedTeacher {
  id: string;
  name: string;
  email: string;
  school: string;
  createdAt: any;
}

interface Student {
  id: string;
  name: string;
  email: string;
  school: string;
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
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    classId: '',
    teacherUid: '',
  });
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

      setStats({
        totalSchools: schoolSet.size,
        totalTeachers: teachers.length,
        totalStudents: students.length,
        pendingTeachers: pending.length,
        approvedTeachers: approved.length,
      });

      setPendingTeachers(pending.map(mapTeacher));
      setApprovedTeachers(approved.map(mapTeacher));
      setStudents(students.map(mapStudent));
      setAllTeachers(
        teachers.map((teacher: any) => ({
          id: teacher.id,
          name: teacher.name || teacher.displayName || 'Okant namn',
          email: teacher.email || '',
          role: teacher.role || 'teacher',
          school: teacher.school || '',
        }))
      );
      setAllStudents(
        students.map((student: any) => ({
          id: student.id,
          name: student.name || student.displayName || 'Okant namn',
          email: student.email || '',
          role: student.role || 'student',
          classId: student.classId || '',
          teacherUid: student.teacherUid || '',
          specialization: student.specialization || '',
        }))
      );
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
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateStudent = async () => {
    setFormError(null);
    if (!studentForm.firstName || !studentForm.lastName || !studentForm.email || !studentForm.password) {
      setFormError('Fyll i förnamn, efternamn, e-post och lösenord.');
      return;
    }

    try {
      setCreating(true);
      const createUser = httpsCallable(functions, 'createUser');
      await createUser({
        role: 'student',
        firstName: studentForm.firstName,
        lastName: studentForm.lastName,
        email: studentForm.email,
        password: studentForm.password,
        classId: studentForm.classId,
        teacherUid: studentForm.teacherUid,
      });
      setStudentForm({ firstName: '', lastName: '', email: '', password: '', classId: '', teacherUid: '' });
      await fetchAdminData();
    } catch (error: any) {
      setFormError(error?.message || 'Fel vid skapande av elev.');
    } finally {
      setCreating(false);
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
      <div className="flex min-h-screen items-center justify-center">
        <p>Laddar...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <button
            type="button"
            onClick={() => setActiveSection('schools')}
            className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow text-white text-left hover:shadow-lg transition"
            aria-label="Visa skolor"
          >
            <p className="text-sm opacity-90">Totalt antal skolor</p>
            <p className="text-4xl font-bold mt-2">{stats.totalSchools}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('approved')}
            className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow text-white text-left hover:shadow-lg transition"
            aria-label="Visa godkända lärare"
          >
            <p className="text-sm opacity-90">Godkända lärare</p>
            <p className="text-4xl font-bold mt-2">{stats.approvedTeachers}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('pending')}
            className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-lg shadow text-white text-left hover:shadow-lg transition"
            aria-label="Visa väntande lärare"
          >
            <p className="text-sm opacity-90">Väntande lärare</p>
            <p className="text-4xl font-bold mt-2">{stats.pendingTeachers}</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('students')}
            className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow text-white text-left hover:shadow-lg transition"
            aria-label="Visa elever"
          >
            <p className="text-sm opacity-90">Totalt antal elever</p>
            <p className="text-4xl font-bold mt-2">{stats.totalStudents}</p>
          </button>
        </div>

        {/* Admin user management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Lägg till elev</h2>
              <p className="text-sm text-gray-600 mt-1">Skapa elevkonto och koppla till klass/lärare</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  value={studentForm.firstName}
                  onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Förnamn"
                />
                <input
                  value={studentForm.lastName}
                  onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Efternamn"
                />
                <input
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="E-post"
                />
                <input
                  value={studentForm.password}
                  onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Lösenord"
                  type="password"
                />
                <select
                  value={studentForm.classId}
                  onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Valfri klass</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                <select
                  value={studentForm.teacherUid}
                  onChange={(e) => setStudentForm({ ...studentForm, teacherUid: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Valfri lärare</option>
                  {allTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
              <button
                onClick={handleCreateStudent}
                disabled={creating}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition disabled:opacity-60"
              >
                Skapa elev
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Lägg till lärare</h2>
              <p className="text-sm text-gray-600 mt-1">Skapa lärarkonto</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  value={teacherForm.firstName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Förnamn"
                />
                <input
                  value={teacherForm.lastName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Efternamn"
                />
                <input
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="E-post"
                />
                <input
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Lösenord"
                  type="password"
                />
                <input
                  value={teacherForm.school}
                  onChange={(e) => setTeacherForm({ ...teacherForm, school: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Skola"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
              >
                Skapa larare
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Ta bort lärare</h2>
              <p className="text-sm text-gray-600 mt-1">Raderar Auth + Firestore</p>
            </div>
            <div className="p-6 space-y-3">
              {allTeachers.length === 0 ? (
                <p className="text-gray-500">Inga lärare</p>
              ) : (
                allTeachers.map((teacher) => (
                  <div key={teacher.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-gray-900">{teacher.name}</p>
                      <p className="text-xs text-gray-600">{teacher.email}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(teacher.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Ta bort
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Ta bort elever</h2>
              <p className="text-sm text-gray-600 mt-1">Raderar Auth + Firestore</p>
            </div>
            <div className="p-6 space-y-3">
              {allStudents.length === 0 ? (
                <p className="text-gray-500">Inga elever</p>
              ) : (
                allStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-600">{student.email}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(student.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Ta bort
                    </button>
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
                        <h3 className="font-semibold text-gray-900">{school.name}</h3>
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
                          {student.createdAt && (
                            <p className="text-xs text-gray-500 mt-2">
                              Registrerad: {new Date(student.createdAt.seconds * 1000).toLocaleDateString('sv-SE')}
                            </p>
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
                          {teacher.createdAt && (
                            <p className="text-xs text-gray-500 mt-2">
                              Registrerad: {new Date(teacher.createdAt.seconds * 1000).toLocaleDateString('sv-SE')}
                            </p>
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
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
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
      </main>
    </div>
  );
}
