'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

interface Stats {
  totalStudents: number;
  totalTimesheets: number;
  pendingTimesheets: number;
  approvedTimesheets: number;
  totalAssessments: number;
  pendingAssessments: number;
  submittedAssessments: number;
  totalHours: number;
}

interface ClassData {
  id: string;
  name: string;
}

interface StudentSummary {
  id: string;
  name: string;
  classId?: string;
  className?: string;
}

interface RawData {
  timesheets: Array<{ id: string; [key: string]: any }>;
  assessments: Array<{ id: string; [key: string]: any }>;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalTimesheets: 0,
    pendingTimesheets: 0,
    approvedTimesheets: 0,
    totalAssessments: 0,
    pendingAssessments: 0,
    submittedAssessments: 0,
    totalHours: 0,
  });
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentSummary[]>([]);
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }
      
      // Check user role
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        setUserRole(userDoc.data().role);
      }
      
      setUser(currentUser);
      await fetchStats(currentUser.uid, userDoc.data()?.role);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchStats = async (currentUserId: string, role?: string) => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const timesheetsSnapshot = await getDocs(collection(db, 'timesheets'));
      const assessmentsSnapshot = await getDocs(collection(db, 'assessmentRequests'));

      const isTeacher = role === 'teacher';
      const classDocs = isTeacher
        ? classesSnapshot.docs.filter(c => c.data().teacherUid === currentUserId)
        : classesSnapshot.docs;
      const classIds = new Set(classDocs.map(doc => doc.id));
      const classesData = classDocs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Okänd klass',
      }));
      setClasses(classesData);

      const allStudents = usersSnapshot.docs.filter(doc => doc.data().role === 'student');
      const students = isTeacher
        ? allStudents.filter(doc => {
            const data = doc.data();
            const classId = (data.classId || '').toString();
            const teacherUid = (data.teacherUid || '').toString();
            return teacherUid === currentUserId || (classId && classIds.has(classId));
          })
        : allStudents;
      const studentSummaries = students.map(doc => {
        const data = doc.data();
        const classId = (data.classId || '').toString();
        const className = classesData.find(c => c.id === classId)?.name || 'Ingen klass';
        return {
          id: doc.id,
          name: data.displayName || data.email || 'Okänd',
          classId,
          className,
        };
      });
      setStudents(studentSummaries);
      const studentIds = new Set(studentSummaries.map(doc => doc.id));

      const timesheets = isTeacher
        ? timesheetsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const classId = (data.classId || '').toString();
            const teacherUid = (data.teacherUid || '').toString();
            const studentUid = (data.studentUid || '').toString();
            return teacherUid === currentUserId || (classId && classIds.has(classId)) || studentIds.has(studentUid);
          })
        : timesheetsSnapshot.docs;
      const assessments = isTeacher
        ? assessmentsSnapshot.docs.filter(doc => {
            const studentUid = (doc.data().studentUid || '').toString();
            return studentIds.has(studentUid);
          })
        : assessmentsSnapshot.docs;
      const raw = {
        timesheets: timesheets.map(doc => ({ id: doc.id, ...doc.data() })),
        assessments: assessments.map(doc => ({ id: doc.id, ...doc.data() })),
      };
      setRawData(raw);
      
      // Update stats
      const tempStats = {
        totalStudents: studentSummaries.length,
        totalTimesheets: timesheets.length,
        pendingTimesheets: 0,
        approvedTimesheets: 0,
        totalAssessments: assessments.length,
        pendingAssessments: 0,
        submittedAssessments: 0,
        totalHours: 0,
      };
      
      applyClassFilter(selectedClassId, studentSummaries, raw, tempStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const applyClassFilter = (
    classId: string,
    allStudents: StudentSummary[],
    raw: RawData,
    baseStats?: Partial<Stats>
  ) => {
    const activeStudents =
      classId === 'ALL'
        ? allStudents
        : allStudents.filter(student => student.classId === classId);

    const studentIds = new Set(activeStudents.map(student => student.id));
    const timesheets = raw.timesheets.filter(ts => studentIds.has(ts.studentUid));
    const pending = timesheets.filter(ts => ts.approved === false);
    const approved = timesheets.filter(ts => ts.approved === true);

    let totalHours = 0;
    timesheets.forEach(ts => {
      const entries = ts.entries || {};
      Object.values(entries).forEach((dayEntries: any) => {
        if (dayEntries && typeof dayEntries === 'object') {
          Object.values(dayEntries).forEach((hours: any) => {
            totalHours += Number(hours) || 0;
          });
        }
      });
    });

    const assessments = raw.assessments.filter(a => studentIds.has(a.studentUid));
    const pendingAssessments = assessments.filter(a => a.status === 'pending');
    const submittedAssessments = assessments.filter(a => a.status === 'submitted');

    setFilteredStudents(activeStudents);
    setStats({
      totalStudents: activeStudents.length,
      totalTimesheets: timesheets.length,
      pendingTimesheets: pending.length,
      approvedTimesheets: approved.length,
      totalAssessments: assessments.length,
      pendingAssessments: pendingAssessments.length,
      submittedAssessments: submittedAssessments.length,
      totalHours,
    });
  };

  useEffect(() => {
    if (!rawData) return;
    applyClassFilter(selectedClassId, students, rawData);
  }, [selectedClassId, rawData, students]);

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
        <div className="mb-4 p-4 bg-blue-100 border-l-4 border-blue-600 rounded">
          <p className="text-blue-800 font-bold">✅ UPPDATERAD VERSION 2026-02-19</p>
        </div>
        {/* Admin Access */}
        {userRole === 'admin' && (
          <div className="mb-8">
            <button
              onClick={() => router.push('/dashboard/admin')}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition group"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-xl font-bold mb-1">🔐 Admin Panel</h3>
                  <p className="text-red-100">Hantera lärare, visa statistik och systemöversikt</p>
                </div>
                <svg className="w-8 h-8 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* Main Cards - Elever & Dokument */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => router.push('/dashboard/students')}
            className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition text-left group"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold group-hover:text-orange-600 transition">Elever</h3>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-orange-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <p className="text-gray-600">Se alla elever och deras APL-information</p>
            <p className="text-3xl font-bold text-orange-600 mt-3">{stats.totalStudents}</p>
          </button>

          <button
            onClick={() => router.push('/dashboard/documents')}
            className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition text-left group"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold group-hover:text-green-600 transition">APL-dokument</h3>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-green-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <p className="text-gray-600">Dela viktiga dokument med eleverna</p>
            <div className="text-3xl font-bold text-green-600 mt-3">📁</div>
          </button>
        </div>
      </main>
    </div>
  );
}
