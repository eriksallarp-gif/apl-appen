'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { usePathname } from 'next/navigation';
import { BriefcaseBusiness, GraduationCap, School, Users } from 'lucide-react';

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  totalTimesheets: number;
  pendingTimesheets: number;
  approvedTimesheets: number;
  totalAssessments: number;
  pendingAssessments: number;
  submittedAssessments: number;
  totalHours: number;
  totalCompanies: number;
  totalSchools: number;
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
    totalTeachers: 0,
    totalTimesheets: 0,
    pendingTimesheets: 0,
    approvedTimesheets: 0,
    totalAssessments: 0,
    pendingAssessments: 0,
    submittedAssessments: 0,
    totalHours: 0,
    totalCompanies: 0,
    totalSchools: 0,
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
      const schoolsSnapshot = await getDocs(collection(db, 'schools'));

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
      const allTeachers = usersSnapshot.docs.filter(doc => doc.data().role === 'teacher');
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
      const schoolsCount = schoolsSnapshot.docs.length;
      // Update stats
      setStats(prev => ({
        ...prev,
        totalCompanies: companyCount,
        totalSchools: schoolsCount,
        totalTeachers: allTeachers.length,
      }));
      const tempStats = {
        totalStudents: studentSummaries.length,
        totalTeachers: allTeachers.length,
        totalTimesheets: timesheets.length,
        pendingTimesheets: 0,
        approvedTimesheets: 0,
        totalAssessments: assessments.length,
        pendingAssessments: 0,
        submittedAssessments: 0,
        totalHours: 0,
        totalCompanies: companyCount,
        totalSchools: schoolsCount,
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
        ...prev,
        totalStudents: activeStudents.length,
        totalTimesheets: timesheets.length,
        pendingTimesheets: pending.length,
        approvedTimesheets: approved.length,
        totalAssessments: assessments.length,
        pendingAssessments: pendingAssessments.length,
        submittedAssessments: submittedAssessments.length,
        totalHours,
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
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-700">
        <p>Laddar...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute top-[35%] left-[-10%] h-[360px] w-[360px] rounded-full bg-orange-100/60 blur-3xl" />
      </div>

      <section className="mx-auto max-w-7xl px-8 py-12">
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-700">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Översikt</h1>
          <p className="mt-2 text-sm text-slate-600">Samma visuella tema som startsidan för både admin och lärare.</p>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <GraduationCap className="h-5 w-5 text-orange-600" />
              </span>
              <span className="text-base font-semibold text-slate-900">Elever</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{stats.totalStudents}</div>
          </div>

          {userRole === 'admin' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                  <Users className="h-5 w-5 text-orange-600" />
                </span>
                <span className="text-base font-semibold text-slate-900">Lärare</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">{typeof stats.totalTeachers === 'number' ? stats.totalTeachers : '—'}</div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                  <Users className="h-5 w-5 text-orange-600" />
                </span>
                <span className="text-base font-semibold text-slate-900">Bedömningar</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">{stats.totalAssessments}</div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <BriefcaseBusiness className="h-5 w-5 text-orange-600" />
              </span>
              <span className="text-base font-semibold text-slate-900">Företag</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{stats.totalCompanies}</div>
          </div>

          {userRole === 'admin' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                  <School className="h-5 w-5 text-orange-600" />
                </span>
                <span className="text-base font-semibold text-slate-900">Skolor</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">{stats.totalSchools ?? 0}</div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
