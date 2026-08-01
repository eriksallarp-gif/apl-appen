'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type Assignment = {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  assignedTo: string[];
  assignmentStatus?: 'active' | 'archived';
  dueDate?: Timestamp | null;
};

type Submission = {
  id: string;
  studentId: string;
  studentName?: string;
  textAnswer?: string;
  mediaUrls?: string[];
  submittedAt?: Timestamp;
  status?: 'submitted' | 'reviewed' | 'approved';
  teacherComment?: string | null;
};

function isApprovedSubmission(status?: string): boolean {
  const normalized = (status ?? '').toLowerCase();
  return normalized === 'approved' || normalized === 'reviewed';
}

type StudentMeta = {
  id: string;
  name: string;
  email: string;
};

function formatDate(value?: Timestamp | null): string {
  if (!value) return 'Ingen deadline';
  return value.toDate().toLocaleString('sv-SE');
}

export default function AssignmentDetailPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params?.assignmentId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, StudentMeta>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [savingApprovalFor, setSavingApprovalFor] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!assignmentId) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.exists() ? (userDoc.data().role ?? '').toString() : '';
      if (role !== 'teacher') {
        router.push('/dashboard');
        return;
      }

      const assignmentRef = doc(db, 'assignments', assignmentId);
      const assignmentSnap = await getDoc(assignmentRef);
      if (!assignmentSnap.exists()) {
        setError('Uppgiften hittades inte.');
        setLoading(false);
        return;
      }

      const assignmentData = assignmentSnap.data() as Omit<Assignment, 'id'>;
      if ((assignmentData.createdBy ?? '') !== user.uid) {
        setError('Du har inte behörighet till denna uppgift.');
        setLoading(false);
        return;
      }

      const parsedAssignment: Assignment = {
        id: assignmentSnap.id,
        ...assignmentData,
      };
      setAssignment(parsedAssignment);

      const studentEntries = await Promise.all(
        (parsedAssignment.assignedTo ?? []).map(async (studentId) => {
          const snap = await getDoc(doc(db, 'users', studentId));
          const data = snap.data() ?? {};
          const name = (data.displayName ?? data.name ?? data.email ?? 'Okänd elev').toString();
          const email = (data.email ?? '').toString();
          return [studentId, { id: studentId, name, email }] as const;
        }),
      );
      setStudentMap(Object.fromEntries(studentEntries));

      const submissionsQuery = query(collection(db, 'assignments', assignmentId, 'submissions'), orderBy('submittedAt', 'desc'));
      const submissionsSnap = await getDocs(submissionsQuery);
      const parsedSubmissions = submissionsSnap.docs.map((submissionDoc) => ({
        id: submissionDoc.id,
        ...(submissionDoc.data() as Omit<Submission, 'id'>),
      }));
      setSubmissions(parsedSubmissions);
      setCommentDrafts(
        Object.fromEntries(parsedSubmissions.map((submission) => [submission.id, submission.teacherComment ?? ''])),
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [assignmentId, router]);

  const submissionByStudentId = useMemo(
    () => Object.fromEntries(submissions.map((submission) => [submission.studentId, submission])),
    [submissions],
  );

  const saveApproval = async (submission: Submission) => {
    if (!assignmentId) return;
    setSavingApprovalFor(submission.id);

    try {
      await updateDoc(doc(db, 'assignments', assignmentId, 'submissions', submission.id), {
        status: 'approved',
        teacherComment: (commentDrafts[submission.id] ?? '').trim() || null,
        approvedAt: Timestamp.now(),
        approvedBy: auth.currentUser?.uid ?? '',
        reviewedAt: Timestamp.now(),
        reviewedBy: auth.currentUser?.uid ?? '',
        updatedAt: Timestamp.now(),
      });

      await setDoc(
        doc(db, 'assignments', assignmentId, 'assignees', submission.studentId),
        {
          studentId: submission.studentId,
          status: 'approved',
          teacherComment: (commentDrafts[submission.id] ?? '').trim() || null,
          approvedAt: Timestamp.now(),
          approvedBy: auth.currentUser?.uid ?? '',
          reviewedAt: Timestamp.now(),
          reviewedBy: auth.currentUser?.uid ?? '',
        },
        { merge: true },
      );

      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                status: 'approved',
                teacherComment: (commentDrafts[submission.id] ?? '').trim() || null,
              }
            : item,
        ),
      );
    } catch (reviewError) {
      console.error('Save approval error:', reviewError);
      alert('Kunde inte spara godkännande. Försök igen.');
    } finally {
      setSavingApprovalFor(null);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-slate-600">Laddar uppgift...</div>;
  }

  if (error || !assignment) {
    return <div className="py-10 text-center text-red-600">{error || 'Uppgiften kunde inte laddas.'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{assignment.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{assignment.description}</p>
        </div>
        <Link href="/dashboard/assignments" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Tillbaka till uppgifter
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>{assignment.assignedTo.length} tilldelade elever</span>
          <span>•</span>
          <span>{submissions.length} inlämningar</span>
          <span>•</span>
          <span>{formatDate(assignment.dueDate)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Status per elev</h2>
        <div className="space-y-2">
          {assignment.assignedTo.map((studentId) => {
            const student = studentMap[studentId];
            const submission = submissionByStudentId[studentId];
            return (
              <div key={studentId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{student?.name ?? 'Okänd elev'}</p>
                  <p className="text-slate-500">{student?.email || ''}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    submission
                      ? isApprovedSubmission(submission.status)
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {submission ? (isApprovedSubmission(submission.status) ? 'Godkänd' : 'Inlämnad') : 'Ej inlämnad'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Inlämningar</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-slate-500">Inga inlämningar ännu.</p>
        ) : (
          submissions.map((submission) => {
            const student = studentMap[submission.studentId];
            return (
              <div key={submission.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{student?.name ?? submission.studentName ?? submission.studentId}</p>
                    <p className="text-xs text-slate-500">{formatDate(submission.submittedAt ?? null)}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        isApprovedSubmission(submission.status) ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                      {isApprovedSubmission(submission.status) ? 'Godkänd' : 'Inlämnad'}
                  </span>
                </div>

                <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700">{submission.textAnswer || 'Ingen text angiven.'}</p>

                {submission.mediaUrls && submission.mediaUrls.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {submission.mediaUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                      >
                        Öppna media
                      </a>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-600">Lärarkommentar</label>
                  <textarea
                    rows={3}
                    value={commentDrafts[submission.id] ?? ''}
                    onChange={(event) =>
                      setCommentDrafts((prev) => ({
                        ...prev,
                        [submission.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Skriv feedback till eleven"
                  />
                  <button
                    type="button"
                    onClick={() => saveApproval(submission)}
                    disabled={savingApprovalFor === submission.id}
                    className="inline-flex rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                  >
                    {savingApprovalFor === submission.id ? 'Sparar...' : 'Markera som godkänd'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
