'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

interface Assessment {
  id: string;
  status: string;
  submittedAt?: any;
  supervisorName?: string;
  supervisorCompany?: string;
  averageRating?: string;
  assessmentData?: any;
  totalHours?: number;
  attachments?: string[];
  weekStart?: string;
  lunchApproved?: number;
  travelApproved?: number;
}

interface Timesheet {
  id: string;
  weekStart: string;
  approved: boolean;
  totalHours: number;
  entries: any;
}

interface Compensation {
  id: string;
  type: string;
  amount: number;
  approved: boolean;
  description?: string;
  weekStart?: string;
}

// Helper function to get week number from date string

// Korrekt ISO 8601-vecko-funktion (svensk standard)
function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  // Torsdag i denna vecka
  const thursday = new Date(date.getTime());
  thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  // Första torsdagen på året
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  firstThursday.setDate(4 + 3 - ((firstThursday.getDay() + 6) % 7));
  // Veckonummer
  const weekNumber = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86400000) / 7);
  return weekNumber;
}

// Helper function to translate day names to Swedish
function translateDayToSwedish(dayName: string): string {
  const dayMap: { [key: string]: string } = {
    'monday': 'Måndag',
    'tuesday': 'Tisdag',
    'wednesday': 'Onsdag',
    'thursday': 'Torsdag',
    'friday': 'Fredag',
    'saturday': 'Lördag',
    'sunday': 'Söndag',
    'Monday': 'Måndag',
    'Tuesday': 'Tisdag',
    'Wednesday': 'Onsdag',
    'Thursday': 'Torsdag',
    'Friday': 'Fredag',
    'Saturday': 'Lördag',
    'Sunday': 'Söndag',
  };
  return dayMap[dayName] || dayName;
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<any>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'hours' | 'timesheets' | 'assessments' | 'compensations' | null>(null);
  const [expandedTimesheetId, setExpandedTimesheetId] = useState<string | null>(null);
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      await fetchStudentData();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, studentId]);

  const fetchStudentData = async () => {
    try {
      // Hämta studentdata
      const studentDoc = await getDoc(doc(db, 'users', studentId));
      if (!studentDoc.exists()) {
        alert('Elev hittades inte');
        router.push('/dashboard/students');
        return;
      }

      const studentData = studentDoc.data();
      
      // Hämta klass
      let className = 'Ingen klass';
      if (studentData.classId) {
        const classDoc = await getDoc(doc(db, 'classes', studentData.classId));
        if (classDoc.exists()) {
          className = classDoc.data().name;
        }
      }

      setStudent({
        id: studentDoc.id,
        name: studentData.displayName || studentData.email || 'Okänd',
        email: studentData.email,
        className,
        specialization: studentData.specialization || '-',
      });

      // Hämta tidkort FÖRST så vi kan använda det för bedömningar
      const timesheetsSnapshot = await getDocs(
        query(collection(db, 'timesheets'), where('studentUid', '==', studentId))
      );
      const timesheetsData = timesheetsSnapshot.docs.map(doc => {
        const data = doc.data();
        let totalHours = 0;
        const entries = data.entries || {};
        Object.values(entries).forEach((dayEntries: any) => {
          if (dayEntries && typeof dayEntries === 'object') {
            Object.values(dayEntries).forEach((hours: any) => {
              totalHours += Number(hours) || 0;
            });
          }
        });

        return {
          id: doc.id,
          weekStart: data.weekStart,
          approved: data.approved || false,
          totalHours,
          entries: data.entries,
        };
      });
      setTimesheets(timesheetsData);

      // Hämta bedömningar och länka dem till motsvarande vecka i tidkorten
      const assessmentsSnapshot = await getDocs(
        query(collection(db, 'assessmentRequests'), where('studentUid', '==', studentId))
      );
      const assessmentsData = assessmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Försök hitta motsvarande vecka i tidkorten baserat på veckonummer
        const assessmentWeekStart = data.weekStart || (data.submittedAt ? new Date(data.submittedAt.seconds * 1000).toISOString().split('T')[0] : null);
        
        let totalHours = 0;
        if (assessmentWeekStart) {
          const assessmentWeekNum = getWeekNumber(assessmentWeekStart);
          // Hitta tidkort med samma veckonummer
          const matchingTimesheet = timesheetsData.find(ts => getWeekNumber(ts.weekStart) === assessmentWeekNum);
          totalHours = matchingTimesheet?.totalHours || 0;
        }
        
        return {
          id: doc.id,
          status: data.status,
          submittedAt: data.submittedAt,
          supervisorName: data.supervisorName,
          supervisorCompany: data.supervisorCompany,
          averageRating: data.averageRating,
          assessmentData: data.assessmentData,
          attachments: data.attachments || [],
          weekStart: assessmentWeekStart,
          totalHours,
          lunchApproved: data.lunchApproved || (data.assessmentData?.lunchApproved ?? 0) || 0,
          travelApproved: data.travelApproved || (data.assessmentData?.travelApproved ?? 0) || 0,
        };
      });
      setAssessments(assessmentsData);

      // Hämta ersättningar
      const compensationsSnapshot = await getDocs(
        query(collection(db, 'compensation'), where('studentUid', '==', studentId))
      );
      const compensationsData = compensationsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          amount: data.amount || 0,
          approved: data.approved || false,
          description: data.description,
          weekStart: data.weekStart,
        };
      });
      setCompensations(compensationsData);
    } catch (error) {
      console.error('Error fetching student data:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p>Laddar elevdata...</p>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  // Beräkna totala timmar från GODKÄNDA tidkort
  const approvedTimesheetsOnly = timesheets.filter(ts => ts.approved);
  const totalHours = approvedTimesheetsOnly.reduce((sum, ts) => sum + ts.totalHours, 0);
  const approvedTimesheets = approvedTimesheetsOnly.length;
  const submittedAssessments = assessments.filter(a => a.status === 'submitted').length;
  
  // Godkända handledarbedömningar
  const approvedAssessments = assessments.filter(a => a.status === 'submitted');

  // Summera timmar per arbetsmoment från tidkort som har handledargodkänd bedömning
  const taskHours: { [key: string]: number } = {};
  const dayNames = [
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'
  ];
  // Hitta veckor med godkänd assessment
  const approvedWeeks = new Set(
    assessments
      .filter(a => a.status === 'submitted' && a.weekStart)
      .map(a => a.weekStart ? getWeekNumber(a.weekStart) : null)
  );
  // Endast tidkort med godkänd handledarbedömning
  const approvedTimesheetsForDiagram = approvedTimesheetsOnly.filter(ts => approvedWeeks.has(getWeekNumber(ts.weekStart)));
  // Summera timmar per arbetsmoment (nivå 1 i entries) över alla dagar och veckor
  approvedTimesheetsForDiagram.forEach(timesheet => {
    const entries = timesheet.entries || {};
    Object.entries(entries).forEach(([moment, dayMap]: [string, any]) => {
      if (dayMap && typeof dayMap === 'object') {
        Object.values(dayMap).forEach((hours: any) => {
          const numHours = Number(hours) || 0;
          if (numHours > 0) {
            taskHours[moment] = (taskHours[moment] || 0) + numHours;
          }
        });
      }
    });
  });

  // Summera totalHours för cirkeldiagrammet
  const totalHoursForDiagram = approvedTimesheetsForDiagram.reduce((sum, ts) => sum + ts.totalHours, 0);

  // OBS! Lunch och resa visas nu endast i Compensations View och baseras på handledarens bedömning (lunchApproved, travelApproved)

  // För aktiv markering
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
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
          <button
            onClick={async () => { const { signOut } = await import('firebase/auth'); signOut(auth); window.location.href = '/login'; }}
            className="w-full bg-orange-600 text-white rounded-lg py-2 font-semibold hover:bg-orange-700 transition"
          >
            Logga ut
          </button>
        </div>
      </aside>
      <main className="ml-56 max-w-7xl mx-auto px-8 py-12">
        {/* Student Info Card */}
        <div className="bg-white/70 backdrop-blur rounded-3xl shadow-lg shadow-blue-100/30 p-8 mb-8 border border-blue-100/50">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">{student.name}</h1>
              <div className="space-y-2 text-slate-600">
                <p className="text-sm">📧 {student.email}</p>
                <p className="text-sm">🎓 {student.className}</p>
                <p className="text-sm">🔨 Yrkesutgång: {student.specialization}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Now Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <button
            onClick={() => setSelectedView(selectedView === 'hours' ? null : 'hours')}
            className={`bg-gradient-to-br from-green-50 to-emerald-50/30 border-2 p-8 rounded-2xl transition-all duration-300 text-left hover:shadow-lg hover:shadow-green-100/40 hover:scale-105 ${
              selectedView === 'hours' ? 'ring-2 ring-green-400 border-green-300' : 'border-green-200/50'
            }`}
          >
            <p className="text-sm text-slate-600 font-medium">Totala arbetstimmar</p>
            <p className="text-4xl font-bold text-green-600 mt-3">{totalHours}h</p>
            <p className="text-xs text-slate-500 mt-3">Klicka för cirkeldiagram</p>
          </button>

          <button
            onClick={() => setSelectedView(selectedView === 'timesheets' ? null : 'timesheets')}
            className={`bg-gradient-to-br from-blue-50 to-sky-50/30 border-2 p-8 rounded-2xl transition-all duration-300 text-left hover:shadow-lg hover:shadow-blue-100/40 hover:scale-105 ${
              selectedView === 'timesheets' ? 'ring-2 ring-blue-400 border-blue-300' : 'border-blue-200/50'
            }`}
          >
            <p className="text-sm text-slate-600 font-medium">Godkända tidkort</p>
            <p className="text-4xl font-bold text-blue-600 mt-3">{approvedTimesheets}/{timesheets.length}</p>
            <p className="text-xs text-slate-500 mt-3">Klicka för detaljer</p>
          </button>

          <button
            onClick={() => setSelectedView(selectedView === 'assessments' ? null : 'assessments')}
            className={`bg-gradient-to-br from-purple-50 to-violet-50/30 border-2 p-8 rounded-2xl transition-all duration-300 text-left hover:shadow-lg hover:shadow-purple-100/40 hover:scale-105 ${
              selectedView === 'assessments' ? 'ring-2 ring-purple-400 border-purple-300' : 'border-purple-200/50'
            }`}
          >
            <p className="text-sm text-slate-600 font-medium">Bedömningar</p>
            <p className="text-4xl font-bold text-purple-600 mt-3">{submittedAssessments}</p>
            <p className="text-xs text-slate-500 mt-3">Klicka för detaljer</p>
          </button>

          <button
            onClick={() => setSelectedView(selectedView === 'compensations' ? null : 'compensations')}
            className={`bg-gradient-to-br from-amber-50 to-orange-50/30 border-2 p-8 rounded-2xl transition-all duration-300 text-left hover:shadow-lg hover:shadow-amber-100/40 hover:scale-105 ${
              selectedView === 'compensations' ? 'ring-2 ring-amber-400 border-amber-300' : 'border-amber-200/50'
            }`}
          >
            <p className="text-sm text-slate-600 font-medium">Ersättningar</p>
            <p className="text-2xl font-bold text-amber-600 mt-3">
              {approvedAssessments.reduce((sum, a) => sum + (a.lunchApproved || 0), 0)} luncher • {approvedAssessments.reduce((sum, a) => sum + (a.travelApproved || 0), 0)} km
            </p>
            <p className="text-xs text-slate-500 mt-3">Klicka för detaljer</p>
          </button>
        </div>

        {/* Content Area Based on Selected Card */}
        {selectedView && (
          <div className="bg-white/70 backdrop-blur rounded-3xl shadow-lg shadow-blue-100/30 p-8 mb-8 border border-blue-100/50">
            {/* Hours View - Cirkeldiagram */}
            {selectedView === 'hours' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-slate-900">Arbetstimmar per moment</h3>
                {Object.keys(taskHours).length === 0 ? (
                  <p className="text-slate-500 text-center py-12">Inga timmar registrerade ännu</p>
                ) : (
                  (() => {
                    // Lista arbetsmoment och totalt antal timmar, sorterat fallande
                    const filteredTasks = Object.entries(taskHours)
                      .filter(([_, hours]) => hours > 0)
                      .sort((a, b) => b[1] - a[1]);
                    const total = filteredTasks.reduce((sum, [, h]) => sum + h, 0);
                    const pieColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f472b6', '#facc15', '#6366f1', '#14b8a6'];
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-w-4xl">
                        {/* Pie Chart */}
                        <div className="flex items-center justify-start mt-8 mb-4 ml-32">
                          <div className="relative w-96 h-96">
                            <svg viewBox="0 0 100 100" className="transform -rotate-90 drop-shadow-lg">
                              {(() => {
                                let currentAngle = 0;
                                const slices = filteredTasks.map(([task, hours], index) => {
                                  const percentage = (hours / total) * 100;
                                  const angle = (percentage / 100) * 360;
                                  const largeArc = angle > 180 ? 1 : 0;
                                  const startX = 50 + 40 * Math.cos((currentAngle * Math.PI) / 180);
                                  const startY = 50 + 40 * Math.sin((currentAngle * Math.PI) / 180);
                                  const endX = 50 + 40 * Math.cos(((currentAngle + angle) * Math.PI) / 180);
                                  const endY = 50 + 40 * Math.sin(((currentAngle + angle) * Math.PI) / 180);
                                  // Placera text i mitten av slice
                                  const midAngle = currentAngle + angle / 2;
                                  const textX = 50 + 28 * Math.cos((midAngle * Math.PI) / 180);
                                  const textY = 50 + 28 * Math.sin((midAngle * Math.PI) / 180);
                                  const path = (
                                    <g key={task}>
                                      <path
                                        d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
                                        fill={pieColors[index % pieColors.length]}
                                        stroke="white"
                                        strokeWidth="0.5"
                                      />
                                      {percentage > 7 && (
                                        <text
                                          x={textX}
                                          y={textY}
                                          textAnchor="middle"
                                          dominantBaseline="middle"
                                          fontSize="6"
                                          fill="#222"
                                          style={{ fontWeight: 600 }}
                                          transform={`rotate(90, ${textX}, ${textY})`}
                                        >
                                          {percentage.toFixed(0)}%
                                        </text>
                                      )}
                                    </g>
                                  );
                                  currentAngle += angle;
                                  return path;
                                });
                                return slices;
                              })()}
                            </svg>
                          </div>
                        </div>
                        {/* Listan */}
                        <div className="space-y-4">
                          <h3 className="text-xl font-bold mb-4 text-slate-900 text-center md:text-left">Totala arbetstimmar per arbetsmoment</h3>
                          {filteredTasks.map(([task, hours], index) => (
                            <div key={task} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 border border-slate-200/50 hover:border-slate-300/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }}></div>
                                <span className="text-base font-medium text-slate-700">{task}</span>
                              </div>
                              <span className="text-base font-bold text-slate-900">{hours}h</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* Timesheets View */}
            {selectedView === 'timesheets' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-slate-900">Tidkort</h3>
                <div className="space-y-4">
                  {timesheets.length === 0 ? (
                    <p className="text-slate-500 text-center py-12">Inga tidkort ännu</p>
                  ) : (
                    timesheets.map(timesheet => {
                      const weekNum = getWeekNumber(timesheet.weekStart);
                      const isExpanded = expandedTimesheetId === timesheet.id;
                      
                      return (
                        <div key={timesheet.id} className="border-2 border-slate-200/50 rounded-2xl overflow-hidden hover:border-blue-300/50 transition-colors bg-slate-50/30">
                          <button
                            onClick={() => setExpandedTimesheetId(isExpanded ? null : timesheet.id)}
                            className="w-full p-6 hover:bg-slate-100/40 transition text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  Vecka {weekNum}
                                </p>
                                <p className="text-sm text-slate-600 mt-2">
                                  {timesheet.totalHours} timmar
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                  timesheet.approved
                                    ? 'bg-green-100/70 text-green-800'
                                    : 'bg-amber-100/70 text-amber-800'
                                }`}>
                                  {timesheet.approved ? '✓ Godkänt' : 'Väntande'}
                                </span>
                                <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                              </div>
                            </div>
                          </button>
                          
                          {isExpanded && timesheet.entries && (
                            <div className="border-t border-slate-200 p-6 bg-gradient-to-br from-slate-50/50 to-blue-50/30">
                              <h4 className="font-semibold mb-4 text-sm text-slate-700">Arbetsmoment:</h4>
                              <div className="space-y-3">
                                {Object.entries(timesheet.entries).map(([day, tasks]: [string, any]) => {
                                  // Filtrera bort tasks med 0 eller 0.0 timmar
                                  const filteredTasks = Object.entries(tasks || {}).filter(([_, hours]: [string, any]) => Number(hours) > 0);
                                  
                                  return filteredTasks.length > 0 ? (
                                    <div key={day} className="">
                                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">{translateDayToSwedish(day)}</p>
                                      <div className="ml-4 space-y-1">
                                        {filteredTasks.map(([task, hours]: [string, any]) => (
                                          <div key={task} className="flex justify-between text-sm">
                                            <span className="text-slate-700">{task}</span>
                                            <span className="font-semibold text-slate-900">{hours}h</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Assessments View */}
            {selectedView === 'assessments' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-slate-900">Bedömningar</h3>
                <div className="space-y-4">
                  {assessments.filter(a => a.status === 'submitted').length === 0 ? (
                    <p className="text-slate-500 text-center py-12">Inga bedömningar ännu</p>
                  ) : (
                    assessments.filter(a => a.status === 'submitted').map(assessment => {
                      const isExpanded = expandedAssessmentId === assessment.id;
                      const weekNum = assessment.submittedAt 
                        ? getWeekNumber(new Date(assessment.submittedAt.seconds * 1000).toISOString().split('T')[0])
                        : '?';
                      
                      return (
                        <div key={assessment.id} className="border-2 border-slate-200/50 rounded-2xl overflow-hidden hover:border-purple-300/50 transition-colors bg-slate-50/30">
                          <button
                            onClick={() => setExpandedAssessmentId(isExpanded ? null : assessment.id)}
                            className="w-full p-6 hover:bg-slate-100/40 transition text-left"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-4">
                                <p className="font-semibold text-slate-900 text-lg">
                                  v.{weekNum}
                                </p>
                                <span className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                  assessment.status === 'submitted'
                                    ? 'bg-green-100/70 text-green-800'
                                    : 'bg-amber-100/70 text-amber-800'
                                }`}>
                                  {assessment.status === 'submitted' ? '✓ Inskickad' : 'Väntande'}
                                </span>
                                <span className="text-sm text-slate-600">
                                  {assessment.totalHours || 0}h
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                {assessment.averageRating && (
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-purple-600">{assessment.averageRating}</p>
                                    <p className="text-xs text-slate-500">av 5</p>
                                  </div>
                                )}
                                <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                              </div>
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="border-t border-slate-200 p-6 bg-gradient-to-br from-slate-50/50 to-purple-50/30">
                              {assessment.submittedAt && (
                                <p className="text-sm text-slate-600 mb-4">
                                  <strong>Datum:</strong> {new Date(assessment.submittedAt.seconds * 1000).toLocaleDateString('sv-SE')}
                                </p>
                              )}
                              {assessment.supervisorName && (
                                <div className="mb-4 text-sm text-slate-600">
                                  <p><strong>Handledare:</strong> {assessment.supervisorName}</p>
                                  {assessment.supervisorCompany && (
                                    <p><strong>Företag:</strong> {assessment.supervisorCompany}</p>
                                  )}
                                </div>
                              )}
                              {assessment.assessmentData && (
                                <div className="text-sm mb-6">
                                  <p className="font-semibold mb-3 text-slate-700">Bedömningskriterier:</p>
                                  <div className="space-y-2">
                                    {Object.entries(assessment.assessmentData).map(([key, value]: [string, any]) => (
                                      <div key={key} className="flex justify-between py-2 px-3 rounded-lg bg-white/50 border border-slate-200/50">
                                        <span className="text-slate-700">{key}</span>
                                        <span className="font-semibold text-purple-600">{value.rating}/5</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {assessment.attachments && assessment.attachments.length > 0 && (
                                <div className="text-sm mt-6">
                                  <p className="font-semibold mb-3 text-slate-700">Bifogade bilder ({assessment.attachments.length}):</p>
                                  <div className="grid grid-cols-2 gap-3">
                                    {assessment.attachments.map((url, idx) => (
                                      <a 
                                        key={idx} 
                                        href={url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="border-2 border-slate-200/50 rounded-2xl overflow-hidden bg-white hover:border-purple-300/50 transition-colors shadow-md shadow-slate-100/50"
                                      >
                                        <img 
                                          src={url} 
                                          alt={`Bedömning bild ${idx + 1}`}
                                          className="w-full h-40 object-cover"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(!assessment.attachments || assessment.attachments.length === 0) && (
                                <p className="text-sm text-slate-500 mt-4">Inga bilder bifogade</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Compensations View */}
            {selectedView === 'compensations' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-slate-900">Ersättningar per vecka</h3>
                {(() => {
                  // Gruppera godkända bedömningar per vecka för ersättningsstatistik
                  const compsByWeek: { [week: string]: Assessment[] } = {};
                  approvedAssessments.forEach(assessment => {
                    if (assessment.weekStart) {
                      const weekNum = getWeekNumber(assessment.weekStart);
                      const weekKey = `Vecka ${weekNum}`;
                      if (!compsByWeek[weekKey]) compsByWeek[weekKey] = [];
                      compsByWeek[weekKey].push(assessment);
                    }
                  });

                  // Visa endast veckor där handledaren har fyllt i lunch eller resa (även om det är 0)
                  const filteredCompsByWeek = Object.fromEntries(
                    Object.entries(compsByWeek).filter(([, weekAssessments]) =>
                      weekAssessments.some(a => a.lunchApproved !== undefined || a.travelApproved !== undefined)
                    )
                  );

                  return Object.keys(filteredCompsByWeek).length === 0 ? (
                    <p className="text-slate-500 text-center py-12">Inga godkända bedömningar ännu</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(filteredCompsByWeek).sort().reverse().map(([week, weekAssessments]) => {
                        // Summera lunch och resa från handledarens bedömning (lunchApproved, travelApproved)
                        const lunchCount = weekAssessments.reduce((sum, a) => sum + (a.lunchApproved || 0), 0);
                        const travelKm = weekAssessments.reduce((sum, a) => sum + (a.travelApproved || 0), 0);
                        return (
                          <div key={week} className="border-2 border-slate-200/50 rounded-2xl p-6 bg-gradient-to-br from-amber-50/30 to-orange-50/20 hover:border-amber-300/50 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold text-slate-900 text-lg">{week}</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gradient-to-br from-blue-100/50 to-blue-50/30 p-4 rounded-2xl border border-blue-200/50">
                                <p className="text-xs text-slate-600 mb-2 font-medium">Luncher</p>
                                <p className="text-3xl font-bold text-blue-600">{lunchCount}</p>
                                <p className="text-xs text-slate-500 mt-1">st</p>
                              </div>
                              <div className="bg-gradient-to-br from-green-100/50 to-green-50/30 p-4 rounded-2xl border border-green-200/50">
                                <p className="text-xs text-slate-600 mb-2 font-medium">Resa</p>
                                <p className="text-3xl font-bold text-green-600">{Math.round(travelKm)}</p>
                                <p className="text-xs text-slate-500 mt-1">km</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
