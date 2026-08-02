'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { Briefcase, GraduationCap, School, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';

interface Stats {
  totalStudents: number;
  totalClasses: number;
  totalSpecializations: number;
  totalTeachers: number;
  pendingTeachers: number;
  totalTimesheets: number;
  pendingTimesheets: number;
  approvedTimesheets: number;
  totalAssessments: number;
  pendingAssessments: number;
  submittedAssessments: number;
  totalHours: number;
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
  specialization?: string;
}

interface RawData {
  timesheets: Array<{ id: string; [key: string]: any }>;
  assessments: Array<{ id: string; [key: string]: any }>;
}

function isAssessmentCompleted(data: { [key: string]: any }): boolean {
  const status = (data.status || '').toString().toLowerCase();
  return status === 'submitted' || status === 'approved' || Boolean(data.averageRating);
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalClasses: 0,
    totalSpecializations: 0,
    totalTeachers: 0,
    pendingTeachers: 0,
    totalTimesheets: 0,
    pendingTimesheets: 0,
    approvedTimesheets: 0,
    totalAssessments: 0,
    pendingAssessments: 0,
    submittedAssessments: 0,
    totalHours: 0,
    totalSchools: 0,
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
      const isTeacher = role === 'teacher';
      const classesSnapshot = isTeacher
        ? await getDocs(query(collection(db, 'classes'), where('teacherUid', '==', currentUserId)))
        : await getDocs(collection(db, 'classes'));
      const schoolsSnapshot = await getDocs(collection(db, 'schools'));

      console.log('DEBUG: currentUserId', currentUserId, 'role', role);
      const classDocs = isTeacher
        ? classesSnapshot.docs
        : classesSnapshot.docs;
      const classIds = new Set(classDocs.map(doc => doc.id));
      const classesData = classDocs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Okänd klass',
      }));
      setClasses(classesData);

      const allStudents = usersSnapshot.docs.filter(doc => doc.data().role === 'student');
      const allTeachers = usersSnapshot.docs.filter(doc => doc.data().role === 'teacher');
      const pendingTeachers = allTeachers.filter(doc => doc.data().approved !== true).length;
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
        const specialization = (data.specialization || '').toString().trim();
        return {
          id: doc.id,
          name: data.displayName || data.email || 'Okänd',
          classId,
          className,
          specialization,
        };
      });
      setStudents(studentSummaries);
      const studentIds = new Set(studentSummaries.map(doc => doc.id));

      let timesheetsDocs: any[] = [];
      let assessmentDocs: any[] = [];
      try {
        if (isTeacher) {
          const teacherTimesheetsSnapshot = await getDocs(
            query(collection(db, 'timesheets'), where('teacherUid', '==', currentUserId))
          );
          timesheetsDocs = teacherTimesheetsSnapshot.docs;
        } else {
          const timesheetsSnapshot = await getDocs(collection(db, 'timesheets'));
          timesheetsDocs = timesheetsSnapshot.docs;
        }
      } catch (error) {
        console.warn('Could not fetch timesheets for dashboard stats:', error);
      }

      try {
        if (isTeacher) {
          const teacherAssessmentsSnapshot = await getDocs(
            query(collection(db, 'assessmentRequests'), where('teacherUid', '==', currentUserId))
          );
          assessmentDocs = teacherAssessmentsSnapshot.docs;
        } else {
          const assessmentsSnapshot = await getDocs(collection(db, 'assessmentRequests'));
          assessmentDocs = assessmentsSnapshot.docs;
        }
      } catch (error) {
        console.warn('Could not fetch assessments for dashboard stats:', error);
      }

      const timesheets = isTeacher
        ? timesheetsDocs.filter(doc => studentIds.has((doc.data().studentUid || '').toString()))
        : timesheetsDocs;
      const assessments = isTeacher
        ? assessmentDocs.filter(doc => {
            const studentUid = (doc.data().studentUid || '').toString();
            return studentIds.has(studentUid);
          })
        : assessmentDocs;
      const raw = {
        timesheets: timesheets.map(doc => ({ id: doc.id, ...doc.data() })),
        assessments: assessments.map(doc => ({ id: doc.id, ...doc.data() })),
      };
      setRawData(raw);

      const schoolsCount = schoolsSnapshot.docs.length;
      // Update stats
      setStats(prev => ({
        ...prev,
        totalClasses: classesData.length,
        totalSchools: schoolsCount,
        totalTeachers: allTeachers.length,
        pendingTeachers,
      }));
      const tempStats = {
        totalStudents: studentSummaries.length,
        totalClasses: classesData.length,
        totalSpecializations: 0,
        totalTeachers: allTeachers.length,
        pendingTeachers,
        totalTimesheets: timesheets.length,
        pendingTimesheets: 0,
        approvedTimesheets: 0,
        totalAssessments: assessments.length,
        pendingAssessments: 0,
        submittedAssessments: 0,
        totalHours: 0,
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
    const pendingAssessments = assessments.filter(a => !isAssessmentCompleted(a));
    const submittedAssessments = assessments.filter(isAssessmentCompleted);
    const uniqueSpecializations = new Set(
      activeStudents
        .map(student => (student.specialization || '').trim())
        .filter(Boolean),
    );

    const classesInScope = new Set(
      activeStudents
        .map((student) => (student.classId || '').trim())
        .filter(Boolean),
    ).size;

    setFilteredStudents(activeStudents);
      setStats(prev => ({
        ...prev,
        totalStudents: activeStudents.length,
        totalClasses: classesInScope,
        totalSpecializations: uniqueSpecializations.size,
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

  const hasPendingTeachers = stats.pendingTeachers > 0;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-700 dark:text-slate-300">
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">Laddar...</p>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-7rem)] text-slate-900 dark:text-slate-100">
      <section className="space-y-6">
        <PageHeader
          eyebrow="Dashboard"
          title="Översikt"
          subtitle={
            userRole === 'admin'
              ? 'Här kan du hantera elever, lärare och skolor.'
              : 'Här kan du se en översikt på dina klasser, elever och deras bedömningar.'
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={GraduationCap} label="Elever" value={stats.totalStudents} />

          {userRole === 'admin' ? (
            <button
              type="button"
              onClick={() => router.push('/dashboard/admin?section=pending')}
              className={`rounded-2xl border p-5 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-orange-300 sm:p-6 ${
                hasPendingTeachers
                  ? 'border-orange-300 bg-orange-50/40 hover:border-orange-400 hover:shadow-md dark:border-orange-500/40 dark:bg-orange-500/10'
                  : 'border-slate-200 bg-white hover:border-orange-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-orange-500/50'
              }`}
              aria-label="Öppna väntande lärare"
            >
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                    <Users className="h-5 w-5 text-orange-600" />
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">Lärare</span>
                </div>
                {hasPendingTeachers && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200 dark:bg-orange-500/20 dark:text-orange-200 dark:ring-orange-500/40">
                    Kräver åtgärd
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{typeof stats.totalTeachers === 'number' ? stats.totalTeachers : '—'}</div>
              <p className={`mt-2 text-xs ${hasPendingTeachers ? 'font-medium text-orange-800 dark:text-orange-200' : 'text-slate-600 dark:text-slate-400'}`}>
                Väntande: {stats.pendingTeachers}
              </p>
              {hasPendingTeachers && (
                <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">Tryck för att hantera väntande lärarregistreringar.</p>
              )}
            </button>
          ) : (
            <StatCard icon={School} label="Klasser" value={stats.totalClasses} />
          )}

          {userRole === 'teacher' && (
            <StatCard
              icon={Briefcase}
              label="Yrkesutgångar"
              value={stats.totalSpecializations}
              className="sm:col-span-2 lg:col-span-1"
            />
          )}

          {userRole === 'admin' && (
            <StatCard
              icon={School}
              label="Skolor"
              value={stats.totalSchools ?? 0}
              className="sm:col-span-2 lg:col-span-1"
            />
          )}
        </div>
      </section>
    </main>
  );
}
