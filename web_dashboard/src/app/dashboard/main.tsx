'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { usePathname } from 'next/navigation';

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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-white">Laddar...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-gradient-to-br from-[#FF6A00] to-[#FF8533] text-white rounded-xl shadow-2xl p-6 flex flex-col items-start hover:shadow-[0_0_30px_rgba(255,106,0,0.3)] transition">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-white/20 rounded-full p-2 text-xl">🎓</span>
            <span className="text-base font-semibold">Elever</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalStudents}</div>
        </div>
        {/* Visa "Lärare" istället för "Bedömningar" för admin */}
        {userRole === 'admin' ? (
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl shadow-2xl p-6 flex flex-col items-start hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-white/20 rounded-full p-2 text-xl">👨‍🏫</span>
              <span className="text-base font-semibold">Lärare</span>
            </div>
            <div className="text-3xl font-bold">{typeof stats.totalTeachers === 'number' ? stats.totalTeachers : '—'}</div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-2xl p-6 flex flex-col items-start hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] transition">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-white/20 rounded-full p-2 text-xl">👨‍🏫</span>
              <span className="text-base font-semibold">Bedömningar</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalAssessments}</div>
          </div>
        )}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-2xl p-6 flex flex-col items-start hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-white/20 rounded-full p-2 text-xl">🏢</span>
            <span className="text-base font-semibold">Företag</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalCompanies}</div>
        </div>
        {/* Skolor endast för admin */}
        {userRole === 'admin' && (
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-xl shadow-2xl p-6 flex flex-col items-start hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-white/20 rounded-full p-2 text-xl">🏫</span>
              <span className="text-base font-semibold">Skolor</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalSchools ?? 0}</div>
          </div>
        )}
      </div>
    </div>
  );
}
