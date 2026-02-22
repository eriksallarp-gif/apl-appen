'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { usePathname } from 'next/navigation';

interface Stats {
  totalStudents: number;
  totalTimesheets: number;
  pendingTimesheets: number;
  approvedTimesheets: number;
  totalAssessments: number;
  pendingAssessments: number;
  submittedAssessments: number;
  totalHours: number;
  totalCompanies: number;
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
    totalCompanies: 0,
  });
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentSummary[]>([]);
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

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
      const companiesSnapshot = await getDocs(collection(db, 'companies'));

      const isTeacher = role === 'teacher';
      console.log('DEBUG: currentUserId', currentUserId, 'role', role);
      console.log('DEBUG: companies', companiesSnapshot.docs.map(doc => doc.data()));
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

      const companyCount = isTeacher
        ? companiesSnapshot.docs.filter(doc => doc.data().teacherUid === currentUserId).length
        : companiesSnapshot.docs.length;
      console.log('DEBUG: companyCount', companyCount);
      // Update stats
      setStats(prev => ({
        ...prev,
        totalCompanies: companyCount,
      }));
      const tempStats = {
        totalStudents: studentSummaries.length,
        totalTimesheets: timesheets.length,
        pendingTimesheets: 0,
        approvedTimesheets: 0,
        totalAssessments: assessments.length,
        pendingAssessments: 0,
        submittedAssessments: 0,
        totalHours: 0,
        totalCompanies: companyCount,
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
      setStats(prev => ({
        totalStudents: activeStudents.length,
        totalTimesheets: timesheets.length,
        pendingTimesheets: pending.length,
        approvedTimesheets: approved.length,
        totalAssessments: assessments.length,
        pendingAssessments: pendingAssessments.length,
        submittedAssessments: submittedAssessments.length,
        totalHours,
        totalCompanies: prev.totalCompanies, // behåll alltid det totala antalet företag
      }));
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
    <div className="min-h-screen bg-white">
      <aside className="fixed left-0 top-0 h-screen w-56 bg-gradient-to-br from-orange-50 to-white border-r border-orange-100/50 flex flex-col py-8 px-6 z-10">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-orange-600">APL-appen</h1>
          <p className="text-xs text-orange-400 mt-1">Hem</p>
        </div>
        <nav className="flex-1 space-y-4">
          <a href="/dashboard" className={`block font-semibold rounded-lg px-3 py-2 transition ${pathname === '/dashboard' ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Hem</a>
          <a href="/dashboard/students" className={`block font-medium rounded-lg px-3 py-2 transition ${pathname.startsWith('/dashboard/students') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Elever</a>
          <a href="/dashboard/companies" className={`block font-medium rounded-lg px-3 py-2 transition ${pathname.startsWith('/dashboard/companies') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Företag</a>
          <a href="/dashboard/documents" className={`block font-medium rounded-lg px-3 py-2 transition ${pathname.startsWith('/dashboard/documents') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Dokument</a>
          <a href="/dashboard/settings" className={`block font-medium rounded-lg px-3 py-2 transition ${pathname.startsWith('/dashboard/settings') ? 'bg-orange-100/60 text-orange-600 ring-2 ring-orange-400' : 'text-gray-600 hover:bg-orange-50'}`}>Inställningar</a>
        </nav>
        <div className="mt-auto pt-8">
          <button onClick={handleLogout} className="w-full bg-orange-600 text-white rounded-lg py-2 font-semibold hover:bg-orange-700 transition">Logga ut</button>
        </div>
      </aside>
      <main className="ml-56 max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-2xl shadow-lg p-6 flex flex-col items-start">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-white/30 rounded-full p-2 text-xl">🎓</span>
              <span className="text-base font-semibold">Elever</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-400 to-purple-500 text-white rounded-2xl shadow-lg p-6 flex flex-col items-start">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-white/30 rounded-full p-2 text-xl">👨‍🏫</span>
              <span className="text-base font-semibold">Bedömningar</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalAssessments}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-400 to-blue-500 text-white rounded-2xl shadow-lg p-6 flex flex-col items-start">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-white/30 rounded-full p-2 text-xl">🏢</span>
              <span className="text-base font-semibold">Företag</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
