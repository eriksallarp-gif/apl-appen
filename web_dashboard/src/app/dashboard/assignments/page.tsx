'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type AssignmentDoc = {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  schoolId: string;
  assignedTo: string[];
  createdAt?: Timestamp;
  dueDate?: Timestamp | null;
  assignmentStatus?: 'active' | 'archived';
  totalAssigned?: number;
  totalSubmitted?: number;
};

type AssignmentListItem = AssignmentDoc & {
  computedSubmitted: number;
};

function toDateString(value?: Timestamp | null): string {
  if (!value) return 'Ingen deadline';
  const date = value.toDate();
  return date.toLocaleDateString('sv-SE');
}

export default function AssignmentsPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [items, setItems] = useState<AssignmentListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.exists() ? (userDoc.data().role ?? '').toString() : '';
      setUserRole(role || null);

      if (role !== 'teacher') {
        router.push('/dashboard');
        return;
      }

      const assignmentQuery = query(collection(db, 'assignments'), where('createdBy', '==', user.uid));
      const assignmentSnapshot = await getDocs(assignmentQuery);
      const assignments = assignmentSnapshot.docs.map((assignmentDoc) => ({
        id: assignmentDoc.id,
        ...(assignmentDoc.data() as Omit<AssignmentDoc, 'id'>),
      }));

      const withSubmissionCounts = await Promise.all(
        assignments.map(async (assignment) => {
          const submissionsSnap = await getDocs(collection(db, 'assignments', assignment.id, 'submissions'));
          return {
            ...assignment,
            computedSubmitted: submissionsSnap.size,
          };
        }),
      );

      withSubmissionCounts.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

      setItems(withSubmissionCounts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const status = item.assignmentStatus ?? 'active';
      const statusMatches = statusFilter === 'all' || status === statusFilter;
      const search = searchTerm.trim().toLowerCase();
      const searchMatches =
        search.length === 0 ||
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search);
      return statusMatches && searchMatches;
    });
  }, [items, searchTerm, statusFilter]);

  if (loading) {
    return <div className="py-10 text-center text-slate-600">Laddar uppgifter...</div>;
  }

  if (userRole !== 'teacher') {
    return <div className="py-10 text-center text-slate-600">Ingen behörighet.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Uppgifter</h1>
          <p className="mt-1 text-sm text-slate-600">Skapa uppgifter och följ elevinlämningar.</p>
        </div>
        <Link
          href="/dashboard/assignments/create"
          className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          + Skapa uppgift
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Sök titel eller beskrivning"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'archived')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Alla statusar</option>
            <option value="active">Aktiva</option>
            <option value="archived">Arkiverade</option>
          </select>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Inga uppgifter hittades.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredItems.map((item) => {
            const assignedCount = item.totalAssigned ?? item.assignedTo?.length ?? 0;
            const submittedCount = item.totalSubmitted ?? item.computedSubmitted;
            const status = item.assignmentStatus ?? 'active';

            return (
              <Link
                key={item.id}
                href={`/dashboard/assignments/${item.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {status === 'active' ? 'Aktiv' : 'Arkiverad'}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>{assignedCount} tilldelade</span>
                  <span>•</span>
                  <span>{submittedCount} inlämnade</span>
                  <span>•</span>
                  <span>{toDateString(item.dueDate)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
