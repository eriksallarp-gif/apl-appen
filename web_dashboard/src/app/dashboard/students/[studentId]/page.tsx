"use client";
import Link from "next/link";
// ...existing code...

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  AssessmentTemplateSnapshot,
  getAssessmentCriterionLabel,
  getSelfAssessmentLabel,
  sanitizeAssessmentTemplateSnapshot,
} from '@/lib/assessmentTemplates';
import { translateDayToSwedish } from '@/lib/dayTranslations';
import { getActivityDisplayLabel, getActivityGroupForItem, getActivityItemName, getActivityTemplateBySpecialization } from '@/lib/activityTemplates';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where, deleteDoc } from 'firebase/firestore';

interface Assessment {
  id: string;
  weeks?: string[];
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
  imageComments?: string[];
  images?: Array<{
    fileName: string;
    uploadedAt?: any;
    url: string;
  }>;
  studentSelfAssessment?: Record<string, string>;
  assessmentTemplateSnapshot?: AssessmentTemplateSnapshot;
}

interface Timesheet {
  id: string;
  weekStart: string;
  approved: boolean;
  totalHours: number;
  entries: any;
  comments?: { [key: string]: string };
}

interface Compensation {
  id: string;
  type: string;
  amount: number;
  approved: boolean;
  description?: string;
  weekStart?: string;
}

interface ApprovedAssignment {
  id: string;
  title: string;
  teacherComment?: string | null;
  approvedAt?: any;
  submittedAt?: any;
  textAnswer?: string | null;
  mediaUrls?: string[];
}

// Helper function to get week number from date string

function getMediaType(url: string): 'image' | 'video' | 'other' {
  try {
    const match = url.match(/\/o\/([^?]+)/);
    if (match) {
      const decoded = decodeURIComponent(match[1]).toLowerCase();
      if (/\.(jpg|jpeg|png|gif|webp|heic)$/.test(decoded)) return 'image';
      if (/\.(mp4|mov|avi|mkv|webm)$/.test(decoded)) return 'video';
    }
  } catch {}
  return 'other';
}

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

function normalizeActivityName(activity: string): string {
  return activity
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getTaskComment(
  comments: { [key: string]: string } | undefined,
  taskName: string
): string {
  if (!comments) return '';

  const directMatch = comments[taskName];
  if (typeof directMatch === 'string' && directMatch.trim().length > 0) {
    return directMatch.trim();
  }

  const itemName = getActivityItemName(taskName);
  const directItemMatch = comments[itemName];
  if (typeof directItemMatch === 'string' && directItemMatch.trim().length > 0) {
    return directItemMatch.trim();
  }

  const normalizedTask = normalizeActivityName(taskName);
  for (const [key, value] of Object.entries(comments)) {
    if (normalizeActivityName(key) === normalizedTask && typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  const normalizedItemName = normalizeActivityName(itemName);
  for (const [key, value] of Object.entries(comments)) {
    if (normalizeActivityName(key) === normalizedItemName && typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

function isAssessmentApprovedForDisplay(assessment: Assessment): boolean {
  const status = (assessment.status || '').toLowerCase();

  return (
    status === 'approved' ||
    status === 'submitted' ||
    Boolean(assessment.averageRating)
  );
}

function isAssignmentApprovedStatus(status: unknown): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'approved' || normalized === 'reviewed' || normalized === 'godkand' || normalized === 'godkänd';
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<any>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [approvedAssignments, setApprovedAssignments] = useState<ApprovedAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'hours' | 'timesheets' | 'assessments' | 'compensations' | 'assignments' | null>(null);
  const [expandedTimesheetId, setExpandedTimesheetId] = useState<string | null>(null);
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(null);
  const [deletingAssessmentId, setDeletingAssessmentId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      await cleanupOldPendingAssessments();
      await fetchStudentData();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, studentId]);

  const cleanupOldPendingAssessments = async () => {
    try {
      const assessmentsSnapshot = await getDocs(
        query(
          collection(db, 'assessmentRequests'),
          where('studentUid', '==', studentId),
          where('status', '==', 'pending')
        )
      );

      const now = Date.now();
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

      for (const assessmentDoc of assessmentsSnapshot.docs) {
        const data = assessmentDoc.data();
        const submittedAt = data.submittedAt;
        
        if (submittedAt) {
          const submittedTime = submittedAt.seconds * 1000;
          const ageInMs = now - submittedTime;
          
          if (ageInMs > twentyFourHoursInMs) {
            await deleteDoc(doc(db, 'assessmentRequests', assessmentDoc.id));
            console.log(`Raderade gammal väntande bedömning: ${assessmentDoc.id}`);
          }
        }
      }
    } catch (error) {
      console.error('Fel vid rensning av gamla bedömningar:', error);
    }
  };

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna väntande bedömning?')) {
      return;
    }

    try {
      setDeletingAssessmentId(assessmentId);
      await deleteDoc(doc(db, 'assessmentRequests', assessmentId));
      await fetchStudentData();
    } catch (error) {
      console.error('Fel vid borttagning av bedömning:', error);
      alert('Kunde inte ta bort bedömningen.');
    } finally {
      setDeletingAssessmentId(null);
    }
  };

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

      // Hämta tidkort FÖRST så vi kan använda det för bedömningar.
      // For teachers we must scope by both studentUid + teacherUid to satisfy Firestore rules.
      const currentUser = auth.currentUser;
      const currentUserId = currentUser?.uid;
      let currentUserRole: string | null = null;
      if (currentUserId) {
        const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
        currentUserRole = currentUserDoc.exists() ? (currentUserDoc.data().role || null) : null;
      }

      let timesheetsSnapshot;
      if (currentUserRole === 'teacher' && currentUserId) {
        timesheetsSnapshot = await getDocs(
          query(
            collection(db, 'timesheets'),
            where('studentUid', '==', studentId),
            where('teacherUid', '==', currentUserId)
          )
        );
      } else {
        timesheetsSnapshot = await getDocs(
          query(collection(db, 'timesheets'), where('studentUid', '==', studentId))
        );
      }
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
          comments: data.comments || {},
        };
      });
      setTimesheets(timesheetsData);

      // Hämta bedömningar direkt från assessmentRequests (alla) — vi bestämmer godkända lokalt
      console.debug('QUERY: fetching assessmentRequests for studentUid=', studentId, 'teacherUid=', currentUserId);
      const assessmentConstraints = [where('studentUid', '==', studentId)];
      if (currentUserRole === 'teacher' && currentUserId) {
        assessmentConstraints.push(where('teacherUid', '==', currentUserId));
      }
      const assessmentsSnapshot = await getDocs(
        query(collection(db, 'assessmentRequests'), ...assessmentConstraints)
      );
      console.debug('DEBUG: assessmentRequests for', studentId, 'count=', assessmentsSnapshot.size);
      const assessmentsData = assessmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        const weeks = (data.weeks || []) as string[];

        return {
          id: doc.id,
          status: data.status,
          submittedAt: data.submittedAt,
          supervisorName: data.supervisorName,
          supervisorCompany: data.supervisorCompany,
          averageRating: data.averageRating,
          assessmentData: data.assessmentData,
          attachments: data.attachments || [],
          weeks,
          weekStart: data.weekStart || null,
          totalHours: data.totalHours || 0,
          lunchApproved: data.lunchApproved ?? data.lunchCount ?? data.assessmentData?.lunchApproved ?? 0,
          travelApproved: data.travelApproved ?? data.travelCount ?? data.assessmentData?.travelApproved ?? 0,
          imageComments: data.imageComments || [],
          images: data.images || [],
          studentSelfAssessment: data.studentSelfAssessment || undefined,
          assessmentTemplateSnapshot: sanitizeAssessmentTemplateSnapshot(data.assessmentTemplateSnapshot),
        } as Assessment;
      });
      const approvedAssessmentsData = assessmentsData.filter(isAssessmentApprovedForDisplay);
      // Debug each doc to help trace missing fields / casing
      for (const d of assessmentsSnapshot.docs) {
        const dt = d.data();
        console.debug('ASSESS_DOC:', { id: d.id, weeks: dt?.weeks || null, weekStart: dt?.weekStart || null, travelApproved: dt?.travelApproved || dt?.assessmentData?.travelApproved || null, lunchApproved: dt?.lunchApproved || dt?.assessmentData?.lunchApproved || null, status: dt?.status || null });
        console.debug('assessment full data (safe):', {
          id: d.id,
          keys: Object.keys(dt),
          sample: {
            status: dt?.status,
            weekStart: dt?.weekStart,
            weeks: dt?.weeks,
            lunchApproved: dt?.lunchApproved ?? dt?.assessmentData?.lunchApproved,
            travelApproved: dt?.travelApproved ?? dt?.assessmentData?.travelApproved,
          }
        });
      }
      console.debug('DEBUG: flattened weeks for', studentId, approvedAssessmentsData.flatMap(a => a.weeks));
      setAssessments(approvedAssessmentsData);

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

      const currentTeacherUid = auth.currentUser?.uid;
      if (currentTeacherUid) {
        const assignmentsSnapshot = await getDocs(
          query(collection(db, 'assignments'), where('createdBy', '==', currentTeacherUid))
        );

        const approvedItems: ApprovedAssignment[] = [];
        for (const assignmentDoc of assignmentsSnapshot.docs) {
          const assignmentData = assignmentDoc.data();
          const assignedTo = ((assignmentData.assignedTo ?? []) as string[]);
          if (!assignedTo.includes(studentId)) {
            continue;
          }

          const submissionSnap = await getDoc(doc(db, 'assignments', assignmentDoc.id, 'submissions', studentId));
          if (!submissionSnap.exists()) {
            continue;
          }

          const submissionData = submissionSnap.data();
          if (!isAssignmentApprovedStatus(submissionData.status)) {
            continue;
          }

          approvedItems.push({
            id: assignmentDoc.id,
            title: (assignmentData.title ?? 'Uppgift').toString(),
            teacherComment: (submissionData.teacherComment ?? null) as string | null,
            approvedAt: submissionData.approvedAt || submissionData.reviewedAt,
            submittedAt: submissionData.submittedAt,
            textAnswer: (submissionData.textAnswer ?? null) as string | null,
            mediaUrls: (submissionData.mediaUrls ?? []) as string[],
          });
        }

        approvedItems.sort((a, b) => {
          const aTime = a.approvedAt?.seconds ? a.approvedAt.seconds * 1000 : 0;
          const bTime = b.approvedAt?.seconds ? b.approvedAt.seconds * 1000 : 0;
          return bTime - aTime;
        });
        setApprovedAssignments(approvedItems);
      } else {
        setApprovedAssignments([]);
      }
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
  const submittedAssessments = assessments.length;

  // Godkända handledarbedömningar (we already fetched only approved assessments)
  const approvedAssessments = assessments;

  // Summera timmar per arbetsmoment från tidkort som har handledargodkänd bedömning
  const taskHours: { [key: string]: number } = {};
  const dayNames = [
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'
  ];
  // Hitta veckor med godkänd assessment direkt från assessments[].weeks (strings like "v.17")
  const approvedWeeks = new Set<string>(
    approvedAssessments.flatMap(a => (a.weeks || []) as string[])
  );

  // For diagrams we keep using approved timesheets, but do not derive assessment status from timesheets
  const approvedTimesheetsForDiagram = approvedTimesheetsOnly;
  // Summera timmar per arbetsmoment (nivå 1 i entries) över alla dagar och veckor
  approvedTimesheetsForDiagram.forEach(timesheet => {
    const entries = timesheet.entries || {};
    Object.entries(entries).forEach(([moment, dayMap]: [string, any]) => {
      const displayMoment = getActivityDisplayLabel(moment);
      if (dayMap && typeof dayMap === 'object') {
        Object.values(dayMap).forEach((hours: any) => {
          const numHours = Number(hours) || 0;
          if (numHours > 0) {
            taskHours[displayMoment] = (taskHours[displayMoment] || 0) + numHours;
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
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* Student Info Card */}
        <div className="bg-white/70 backdrop-blur rounded-3xl shadow-lg shadow-blue-100/30 p-8 mb-8 border border-blue-100/50">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">{student.name}</h1>
              <div className="hidden space-y-2 text-slate-600 sm:block">
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

          <button
            onClick={() => setSelectedView(selectedView === 'assignments' ? null : 'assignments')}
            className={`bg-gradient-to-br from-indigo-50 to-blue-50/30 border-2 p-8 rounded-2xl transition-all duration-300 text-left hover:shadow-lg hover:shadow-indigo-100/40 hover:scale-105 ${
              selectedView === 'assignments' ? 'ring-2 ring-indigo-400 border-indigo-300' : 'border-indigo-200/50'
            }`}
          >
            <p className="text-sm text-slate-600 font-medium">Godkända uppgifter</p>
            <p className="text-4xl font-bold text-indigo-600 mt-3">{approvedAssignments.length}</p>
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
                        <div className="mx-auto flex items-center justify-center mt-8 mb-4">
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
                                {(() => {
                                  const groupedEntries = new Map<string, Array<[string, any]>>();

                                  Object.entries(timesheet.entries).forEach(([activity, dayEntries]: [string, any]) => {
                                    const group = getActivityGroupForItem(student.specialization, activity) || 'Övriga arbetsmoment';
                                    const bucket = groupedEntries.get(group) || [];
                                    bucket.push([activity, dayEntries]);
                                    groupedEntries.set(group, bucket);
                                  });

                                  const templateGroupOrder = getActivityTemplateBySpecialization(student.specialization).map(g => g.group);
                                  const orderedGroups = [
                                    ...templateGroupOrder.filter(group => groupedEntries.has(group)),
                                    ...Array.from(groupedEntries.keys()).filter(group => !templateGroupOrder.includes(group)),
                                  ];

                                  return orderedGroups.map(group => {
                                    const activities = groupedEntries.get(group) || [];

                                    return (
                                      <div key={group} className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">{group}</p>
                                        {activities.map(([activity, dayEntries]: [string, any]) => {
                                  // Filtrera bort dagar med 0 eller 0.0 timmar
                                  const filteredTasks = Object.entries(dayEntries || {}).filter(([_, hours]: [string, any]) => Number(hours) > 0);
                                  const activityComment = getTaskComment(timesheet.comments, activity);
                                  const activityItemName = getActivityItemName(activity);
                                  
                                  return filteredTasks.length > 0 ? (
                                    <div key={activity} className="">
                                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">{activityItemName}</p>
                                      <div className="ml-4 space-y-1">
                                        {filteredTasks.map(([day, hours]: [string, any]) => {

                                          return (
                                            <div key={day} className="text-sm">
                                              <div className="flex justify-between">
                                                <div className="text-slate-700">
                                                  <span>{translateDayToSwedish(day)}</span>
                                                  {activityComment && (
                                                    <span className="ml-2 text-xs text-slate-500">
                                                      Kommentar: {activityComment}
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="font-semibold text-slate-900">{hours}h</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null;
                                        })}
                                      </div>
                                    );
                                  });
                                })()}
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
                  {assessments.length === 0 ? (
                    <p className="text-slate-500 text-center py-12">Inga bedömningar ännu</p>
                  ) : (
                    assessments.map(assessment => {
                      const isExpanded = expandedAssessmentId === assessment.id;
                      const weeksLabel = (assessment.weeks || []).join(', ') || '?';
                      const isApprovedStatus = isAssessmentApprovedForDisplay(assessment);

                      return (
                        <div key={assessment.id} className="border-2 border-slate-200/50 rounded-2xl overflow-hidden hover:border-purple-300/50 transition-colors bg-slate-50/30">
                          <button
                            onClick={() => setExpandedAssessmentId(isExpanded ? null : assessment.id)}
                            className="w-full p-6 hover:bg-slate-100/40 transition text-left"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-4">
                                <p className="font-semibold text-slate-900 text-lg">{weeksLabel}</p>
                                <span className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                  isApprovedStatus
                                    ? 'bg-green-100/70 text-green-800'
                                    : 'bg-amber-100/70 text-amber-800'
                                }`}>
                                  {isApprovedStatus ? '✓ Godkänd' : 'Väntande'}
                                </span>
                                <span className="text-sm text-slate-600">
                                  {assessment.totalHours || 0}h
                                </span>
                                {!isApprovedStatus && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAssessment(assessment.id);
                                    }}
                                    disabled={deletingAssessmentId === assessment.id}
                                    className="ml-2 rounded-lg bg-red-100 px-3 py-1 text-sm font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                                  >
                                    {deletingAssessmentId === assessment.id ? 'Tar bort...' : '🗑 Ta bort'}
                                  </button>
                                )}
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
                              {console.debug && isExpanded && console.debug('assessment data:', assessment)}
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
                                        <span className="text-slate-700">
                                          {getAssessmentCriterionLabel(assessment.assessmentTemplateSnapshot, key, value)}
                                        </span>
                                        <span className="font-semibold text-purple-600">{value.rating}/5</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {assessment.images && assessment.images.length > 0 && (
                                <div className="text-sm mt-6">
                                  <p className="font-semibold mb-3 text-slate-700">Bilder ({assessment.images.length}):</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    {assessment.images.map((img, idx) => (
                                      <div key={idx} className="mb-4">
                                        <a
                                          href={img.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="border-2 border-slate-200/50 rounded-2xl overflow-hidden bg-white hover:border-purple-300/50 transition-colors shadow-md shadow-slate-100/50"
                                        >
                                          <img
                                            src={img.url}
                                            alt={img.fileName || `Bild ${idx + 1}`}
                                            className="rounded-md w-40 h-40 object-cover"
                                          />
                                        </a>
                                        {assessment.imageComments && assessment.imageComments[idx] && (
                                          <p className="text-sm mt-2 text-gray-600">{assessment.imageComments[idx]}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {assessment.studentSelfAssessment && (
                                <div className="mt-6 space-y-2">
                                  <h3 className="font-semibold text-lg">Elevens självskattning</h3>
                                  {Object.entries(assessment.studentSelfAssessment)
                                    .filter(([, value]) => (value || '').toString().trim().length > 0)
                                    .map(([key, value]) => (
                                      <p key={key}>
                                        <strong>{getSelfAssessmentLabel(assessment.assessmentTemplateSnapshot, key)}:</strong> {value}
                                      </p>
                                    ))}
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
                  // Debug
                  console.debug('COMPENSATIONS VIEW: total assessments for student=', approvedAssessments.length);
                  // Filtrera till endast de bedömningar som innehåller ersättning (handledarens godkännande)
                  const compAssessments = approvedAssessments.filter(a => {
                    const lunch = a.lunchApproved ?? (a as any).assessmentData?.lunchApproved;
                    const travel = a.travelApproved ?? (a as any).assessmentData?.travelApproved;
                    // Om något av lunch/travel är satt (inkl 0) eller om status indikerar submitted/approved
                    return (lunch !== undefined && lunch !== null) || (travel !== undefined && travel !== null) || (a.status === 'submitted' || a.status === 'approved');
                  });
                  console.debug('COMPENSATIONS VIEW: compAssessments count=', compAssessments.length);
                  if (compAssessments.length === 0) {
                    return <p className="text-slate-500 text-center py-12">Inga godkända bedömningar ännu</p>;
                  }

                  // Hjälp-funktion: bygg en array av week-nycklar (standardiserad) från en assessment
                  const getWeekKeys = (a: Assessment): string[] => {
                    const keys: string[] = [];
                    // 1) weekStart (datum)
                    if (a.weekStart) {
                      try {
                        const d = new Date(a.weekStart);
                        if (!isNaN(d.getTime())) {
                          const y = d.getFullYear();
                          const w = getWeekNumber(a.weekStart);
                          keys.push(`${y}-W${w}`);
                        }
                      } catch (e) {}
                    }
                    // 2) weeks[] (kan innehålla "v.17" eller "17" eller "2024-W17")
                    if (a.weeks && Array.isArray(a.weeks) && a.weeks.length > 0) {
                      a.weeks.forEach(w => {
                        if (typeof w === 'string') {
                          const m = w.match(/(\d{4})[-_ ]?W?(\d{1,2})/);
                          if (m) {
                            keys.push(`${m[1]}-W${Number(m[2])}`);
                            return;
                          }
                          const m2 = w.match(/v\.?\s*(\d{1,2})/i);
                          if (m2) {
                            // fallback to current year if year not present
                            const year = new Date().getFullYear();
                            keys.push(`${year}-W${Number(m2[1])}`);
                            return;
                          }
                          const m3 = w.match(/^(\d{1,2})$/);
                          if (m3) {
                            const year = new Date().getFullYear();
                            keys.push(`${year}-W${Number(m3[1])}`);
                            return;
                          }
                          // otherwise push raw
                          keys.push(w);
                        }
                      });
                    }
                    // 3) andra fält (weekNumber, week, aplWeek)
                    const any = (a as any);
                    if (any.weekNumber || any.week || any.aplWeek) {
                      const wn = any.weekNumber || any.week || any.aplWeek;
                      const year = any.year || new Date().getFullYear();
                      if (wn) keys.push(`${year}-W${Number(wn)}`);
                    }

                    return keys.length > 0 ? keys : ['unknown'];
                  };

                  // Gruppera per week-nyckel
                  const compsByWeek: { [weekKey: string]: { lunch: number; travel: number; display: string } } = {};
                  compAssessments.forEach(a => {
                    const weekKeys = getWeekKeys(a);
                    weekKeys.forEach(k => {
                      if (!compsByWeek[k]) compsByWeek[k] = { lunch: 0, travel: 0, display: k };
                      const lunch = a.lunchApproved ?? (a as any).assessmentData?.lunchApproved ?? 0;
                      const travel = a.travelApproved ?? (a as any).assessmentData?.travelApproved ?? 0;
                      compsByWeek[k].lunch += Number(lunch) || 0;
                      compsByWeek[k].travel += Number(travel) || 0;
                    });
                  });

                  // Sortera veckonycklar stigande (baserat på year-Wnum om möjligt)
                  const sortedKeys = Object.keys(compsByWeek).sort((A, B) => {
                    const pa = A.match(/(\d{4})-W(\d{1,2})/);
                    const pb = B.match(/(\d{4})-W(\d{1,2})/);
                    if (pa && pb) {
                      const ay = Number(pa[1]), aw = Number(pa[2]);
                      const by = Number(pb[1]), bw = Number(pb[2]);
                      if (ay !== by) return ay - by;
                      return aw - bw;
                    }
                    return A.localeCompare(B);
                  });

                  return (
                    <div className="space-y-4">
                      {sortedKeys.map(weekKey => {
                        const { lunch, travel } = compsByWeek[weekKey];
                        // Visningsetikett: försök formatera till "v.X (YYYY)"
                        const m = weekKey.match(/(\d{4})-W(\d{1,2})/);
                        const display = m ? `v.${Number(m[2])} (${m[1]})` : weekKey;
                        return (
                          <div key={weekKey} className="border-2 border-slate-200/50 rounded-2xl p-6 bg-gradient-to-br from-amber-50/30 to-orange-50/20 hover:border-amber-300/50 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold text-slate-900 text-lg">{display}</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gradient-to-br from-blue-100/50 to-blue-50/30 p-4 rounded-2xl border border-blue-200/50">
                                <p className="text-xs text-slate-600 mb-2 font-medium">Luncher</p>
                                <p className="text-3xl font-bold text-blue-600">{lunch}</p>
                                <p className="text-xs text-slate-500 mt-1">st</p>
                              </div>
                              <div className="bg-gradient-to-br from-green-100/50 to-green-50/30 p-4 rounded-2xl border border-green-200/50">
                                <p className="text-xs text-slate-600 mb-2 font-medium">Resa</p>
                                <p className="text-3xl font-bold text-green-600">{Math.round(travel)}</p>
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

            {selectedView === 'assignments' && (
              <div>
                <h3 className="text-2xl font-bold mb-6 text-slate-900">Godkända uppgifter</h3>
                <div className="space-y-4">
                  {approvedAssignments.length === 0 ? (
                    <p className="text-slate-500 text-center py-12">Inga godkända uppgifter ännu</p>
                  ) : (
                    approvedAssignments.map((assignment) => (
                      <div key={assignment.id} className="border-2 border-slate-200/50 rounded-2xl overflow-hidden bg-slate-50/30 p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 text-lg">{assignment.title}</p>
                            <p className="text-sm text-slate-600 mt-2">
                              Godkänd {assignment.approvedAt?.seconds ? new Date(assignment.approvedAt.seconds * 1000).toLocaleDateString('sv-SE') : '-'}
                            </p>
                            <p className="text-sm text-slate-600">
                              Inlämnad {assignment.submittedAt?.seconds ? new Date(assignment.submittedAt.seconds * 1000).toLocaleDateString('sv-SE') : '-'}
                            </p>
                          </div>
                          <span className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-100/70 text-indigo-800">
                            ✓ Godkänd
                          </span>
                        </div>

                        {(assignment.textAnswer ?? '').trim().length > 0 && (
                          <p className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">{assignment.textAnswer}</p>
                        )}

                        {(assignment.mediaUrls ?? []).length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Bilder / Media</p>
                            <div className="flex flex-wrap gap-3">
                              {(assignment.mediaUrls ?? []).map((url, idx) => {
                                const type = getMediaType(url);
                                if (type === 'image') {
                                  return (
                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
                                      <img
                                        src={url}
                                        alt={`Bild ${idx + 1}`}
                                        className="w-36 h-36 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity shadow-sm"
                                      />
                                    </a>
                                  );
                                }
                                return (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                                  >
                                    {type === 'video' ? '▶ Öppna video' : 'Öppna media'}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {(assignment.teacherComment ?? '').trim().length > 0 && (
                          <div className="mt-4 rounded-2xl bg-white/70 border border-slate-200/60 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Lärarkommentar</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{assignment.teacherComment}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
