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
function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
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
  
  // Räkna luncher och km från godkända bedömningar (med attachments/bilder)
  const approvedAssessments = assessments.filter(a => a.status === 'submitted');
  const totalLunches = approvedAssessments.filter(a => a.attachments && a.attachments.length > 0).length;
  const totalKm = approvedAssessments.reduce((sum, a) => {
    // Antag 10km per bedömning för resa
    return sum + (a.attachments && a.attachments.length > 0 ? 10 : 0);
  }, 0);

  // Beräkna arbetsmoment från GODKÄNDA tidkort - bara de med > 0 timmar
  const taskHours: { [key: string]: number } = {};
  approvedTimesheetsOnly.forEach(timesheet => {
    const entries = timesheet.entries || {};
    Object.values(entries).forEach((dayEntries: any) => {
      if (dayEntries && typeof dayEntries === 'object') {
        Object.entries(dayEntries).forEach(([task, hours]: [string, any]) => {
          const numHours = Number(hours) || 0;
          if (numHours > 0) { // Bara inkludera moment med > 0 timmar
            const taskName = task || 'Övrigt';
            taskHours[taskName] = (taskHours[taskName] || 0) + numHours;
          }
        });
      }
    });
  });

  // Beräkna lunch och resa
  const lunchDays = compensations.filter(c => c.type === 'lunch').reduce((sum, c) => sum + (c.amount / 100), 0); // Assuming 100kr per lunch
  const travelKm = compensations.filter(c => c.type === 'travel').reduce((sum, c) => sum + (c.amount / 18.5), 0); // Assuming 18.5kr per km

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/students')}
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            ← Tillbaka till elever
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Student Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{student.name}</h1>
              <div className="space-y-1 text-gray-600">
                <p>📧 {student.email}</p>
                <p>🎓 {student.className}</p>
                <p>🔨 Yrkesutgång: {student.specialization}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Now Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => setSelectedView(selectedView === 'hours' ? null : 'hours')}
            className={`bg-white p-6 rounded-lg shadow hover:shadow-lg transition text-left ${
              selectedView === 'hours' ? 'ring-2 ring-green-600' : ''
            }`}
          >
            <p className="text-sm text-gray-600">Totala arbetstimmar</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{totalHours}h</p>
            <p className="text-xs text-gray-500 mt-2">Klicka för cirkeldiagram</p>
          </button>

          <button
            onClick={() => setSelectedView(selectedView === 'timesheets' ? null : 'timesheets')}
            className={`bg-white p-6 rounded-lg shadow hover:shadow-lg transition text-left ${
              selectedView === 'timesheets' ? 'ring-2 ring-blue-600' : ''
            }`}
          >
            <p className="text-sm text-gray-600">Godkända tidkort</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{approvedTimesheets}/{timesheets.length}</p>
            <p className="text-xs text-gray-500 mt-2">Klicka för detaljer</p>
          </button>

          <button
            onClick={() => setSelectedView(selectedView === 'assessments' ? null : 'assessments')}
            className={`bg-white p-6 rounded-lg shadow hover:shadow-lg transition text-left ${
              selectedView === 'assessments' ? 'ring-2 ring-purple-600' : ''
            }`}
          >
            <p className="text-sm text-gray-600">Bedömningar</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{submittedAssessments}</p>
            <p className="text-xs text-gray-500 mt-2">Klicka för detaljer</p>
          </button>

          <button
            onClick={() => setSelectedView(selectedView === 'compensations' ? null : 'compensations')}
            className={`bg-white p-6 rounded-lg shadow hover:shadow-lg transition text-left ${
              selectedView === 'compensations' ? 'ring-2 ring-yellow-600' : ''
            }`}
          >
            <p className="text-sm text-gray-600">Ersättningar</p>
            <p className="text-xl font-bold text-yellow-600 mt-2">
              {totalLunches} luncher • {Math.round(totalKm)} km
            </p>
            <p className="text-xs text-gray-500 mt-2">Klicka för detaljer</p>
          </button>
        </div>

        {/* Content Area Based on Selected Card */}
        {selectedView && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            {/* Hours View - Cirkeldiagram */}
            {selectedView === 'hours' && (
              <div>
                <h3 className="text-xl font-bold mb-4">Arbetstimmar per moment</h3>
                {Object.keys(taskHours).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Inga timmar registrerade ännu</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Simple Pie Chart with CSS */}
                    <div className="flex items-center justify-center">
                      <div className="relative w-64 h-64">
                        <svg viewBox="0 0 100 100" className="transform -rotate-90">
                          {(() => {
                            let currentAngle = 0;
                            const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                            return Object.entries(taskHours).map(([task, hours], index) => {
                              const percentage = (hours / totalHours) * 100;
                              const angle = (percentage / 100) * 360;
                              const largeArc = angle > 180 ? 1 : 0;
                              
                              const startX = 50 + 40 * Math.cos((currentAngle * Math.PI) / 180);
                              const startY = 50 + 40 * Math.sin((currentAngle * Math.PI) / 180);
                              const endX = 50 + 40 * Math.cos(((currentAngle + angle) * Math.PI) / 180);
                              const endY = 50 + 40 * Math.sin(((currentAngle + angle) * Math.PI) / 180);
                              
                              currentAngle += angle;
                              
                              return (
                                <path
                                  key={task}
                                  d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
                                  fill={colors[index % colors.length]}
                                  stroke="white"
                                  strokeWidth="0.5"
                                />
                              );
                            });
                          })()}
                        </svg>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-3">
                      {Object.entries(taskHours).map(([task, hours], index) => {
                        const percentage = ((hours / totalHours) * 100).toFixed(1);
                        const colors = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500'];
                        return (
                          <div key={task} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded ${colors[index % colors.length]}`}></div>
                              <span className="text-sm font-medium">{task}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold">{hours}h</p>
                              <p className="text-xs text-gray-500">{percentage}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timesheets View */}
            {selectedView === 'timesheets' && (
              <div>
                <h3 className="text-xl font-bold mb-4">Tidkort</h3>
                <div className="space-y-4">
                  {timesheets.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Inga tidkort ännu</p>
                  ) : (
                    timesheets.map(timesheet => {
                      const weekNum = getWeekNumber(timesheet.weekStart);
                      const isExpanded = expandedTimesheetId === timesheet.id;
                      
                      return (
                        <div key={timesheet.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedTimesheetId(isExpanded ? null : timesheet.id)}
                            className="w-full p-4 hover:bg-gray-50 transition text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Vecka {weekNum}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {timesheet.totalHours} timmar
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  timesheet.approved
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {timesheet.approved ? 'Godkänt' : 'Väntande'}
                                </span>
                                <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                              </div>
                            </div>
                          </button>
                          
                          {isExpanded && timesheet.entries && (
                            <div className="border-t border-gray-200 p-4 bg-gray-50">
                              <h4 className="font-semibold mb-3 text-sm text-gray-700">Arbetsmoment:</h4>
                              <div className="space-y-2">
                                {Object.entries(timesheet.entries).map(([day, tasks]: [string, any]) => {
                                  // Filtrera bort tasks med 0 eller 0.0 timmar
                                  const filteredTasks = Object.entries(tasks || {}).filter(([_, hours]: [string, any]) => Number(hours) > 0);
                                  
                                  return filteredTasks.length > 0 ? (
                                    <div key={day} className="">
                                      <p className="text-xs font-medium text-gray-500 mb-1">{translateDayToSwedish(day)}</p>
                                      <div className="ml-4 space-y-1">
                                        {filteredTasks.map(([task, hours]: [string, any]) => (
                                          <div key={task} className="flex justify-between text-sm">
                                            <span className="text-gray-700">{task}</span>
                                            <span className="font-medium text-gray-900">{hours}h</span>
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
                <h3 className="text-xl font-bold mb-4">Bedömningar</h3>
                <div className="space-y-4">
                  {assessments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Inga bedömningar ännu</p>
                  ) : (
                    assessments.map(assessment => {
                      const isExpanded = expandedAssessmentId === assessment.id;
                      const weekNum = assessment.submittedAt 
                        ? getWeekNumber(new Date(assessment.submittedAt.seconds * 1000).toISOString().split('T')[0])
                        : '?';
                      
                      return (
                        <div key={assessment.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedAssessmentId(isExpanded ? null : assessment.id)}
                            className="w-full p-4 hover:bg-gray-50 transition text-left"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <p className="font-semibold text-gray-900 text-lg">
                                  v.{weekNum}
                                </p>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  assessment.status === 'submitted'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {assessment.status === 'submitted' ? 'Inskickad' : 'Väntande'}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {assessment.totalHours || 0}h
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                {assessment.averageRating && (
                                  <div className="text-right">
                                    <p className="text-2xl font-bold text-orange-600">{assessment.averageRating}</p>
                                    <p className="text-xs text-gray-500">av 5</p>
                                  </div>
                                )}
                                <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                              </div>
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="border-t border-gray-200 p-4 bg-gray-50">
                              {assessment.submittedAt && (
                                <p className="text-sm text-gray-600 mb-3">
                                  <strong>Datum:</strong> {new Date(assessment.submittedAt.seconds * 1000).toLocaleDateString('sv-SE')}
                                </p>
                              )}
                              {assessment.supervisorName && (
                                <div className="mb-3 text-sm text-gray-600">
                                  <p><strong>Handledare:</strong> {assessment.supervisorName}</p>
                                  {assessment.supervisorCompany && (
                                    <p><strong>Företag:</strong> {assessment.supervisorCompany}</p>
                                  )}
                                </div>
                              )}
                              {assessment.assessmentData && (
                                <div className="text-sm mb-4">
                                  <p className="font-semibold mb-2">Bedömningskriterier:</p>
                                  <div className="space-y-1">
                                    {Object.entries(assessment.assessmentData).map(([key, value]: [string, any]) => (
                                      <div key={key} className="flex justify-between py-2 border-b border-gray-200">
                                        <span className="text-gray-700">{key}</span>
                                        <span className="font-medium text-orange-600">{value.rating}/5</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {assessment.attachments && assessment.attachments.length > 0 && (
                                <div className="text-sm mt-4">
                                  <p className="font-semibold mb-2">Bifogade bilder ({assessment.attachments.length}):</p>
                                  <div className="grid grid-cols-2 gap-3">
                                    {assessment.attachments.map((url, idx) => (
                                      <a 
                                        key={idx} 
                                        href={url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="border border-gray-300 rounded overflow-hidden bg-white hover:border-orange-500 transition"
                                      >
                                        <img 
                                          src={url} 
                                          alt={`Bedömning bild ${idx + 1}`}
                                          className="w-full h-32 object-cover"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(!assessment.attachments || assessment.attachments.length === 0) && (
                                <p className="text-sm text-gray-500 mt-4">Inga bilder bifogade</p>
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
                <h3 className="text-xl font-bold mb-4">Ersättningar per vecka</h3>
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

                  return Object.keys(compsByWeek).length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Inga godkända bedömningar ännu</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(compsByWeek).sort().reverse().map(([week, weekAssessments]) => {
                        // Räkna luncher och km från handledargodkända bedömningar
                        const lunchCount = weekAssessments.filter(a => a.attachments && a.attachments.length > 0).length;
                        const travelKm = weekAssessments.length * 10; // 10km per bedömning
                        
                        return (
                          <div key={week} className="border border-gray-200 rounded-lg p-4 bg-white">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-900 text-lg">{week}</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Luncher</p>
                                <p className="text-xl font-bold text-blue-600">{lunchCount} st</p>
                              </div>
                              <div className="bg-green-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Resa</p>
                                <p className="text-xl font-bold text-green-600">{Math.round(travelKm)} km</p>
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
