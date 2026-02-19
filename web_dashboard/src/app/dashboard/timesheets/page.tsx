'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

interface Timesheet {
  id: string;
  studentUid: string;
  studentName: string;
  weekStart: string;
  approved: boolean;
  totalHours: number;
  entries: any;
}

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [loading, setLoading] = useState(true);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.data()?.role || null;
      setCurrentUserId(user.uid);
      setUserRole(role);
      await fetchTimesheets(user.uid, role);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchTimesheets = async (currentUserId: string, role?: string) => {
    try {
      const timesheetsSnapshot = await getDocs(collection(db, 'timesheets'));
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const isTeacher = role === 'teacher';
      const classIds = isTeacher
        ? new Set(classesSnapshot.docs
            .filter(doc => doc.data().teacherUid === currentUserId)
            .map(doc => doc.id))
        : new Set(classesSnapshot.docs.map(doc => doc.id));

      const studentIds = isTeacher
        ? new Set(usersSnapshot.docs
            .filter(doc => doc.data().role === 'student')
            .filter(doc => {
              const data = doc.data();
              const classId = (data.classId || '').toString();
              const teacherUid = (data.teacherUid || '').toString();
              return teacherUid === currentUserId || (classId && classIds.has(classId));
            })
            .map(doc => doc.id))
        : new Set();

      const rawTimesheets = isTeacher
        ? timesheetsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const classId = (data.classId || '').toString();
            const teacherUid = (data.teacherUid || '').toString();
            const studentUid = (data.studentUid || '').toString();
            return teacherUid === currentUserId || (classId && classIds.has(classId)) || studentIds.has(studentUid);
          })
        : timesheetsSnapshot.docs;

      const timesheetsData = rawTimesheets.map(doc => {
        const data = doc.data();
        const user = usersSnapshot.docs.find(u => u.id === data.studentUid);
        
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
          studentUid: data.studentUid,
          studentName: user?.data().displayName || user?.data().email || 'Okänd',
          weekStart: data.weekStart,
          approved: data.approved || false,
          totalHours,
          entries: data.entries,
        };
      });

      // Sortera: väntande först, sedan efter datum
      timesheetsData.sort((a, b) => {
        if (a.approved === b.approved) {
          return new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime();
        }
        return a.approved ? 1 : -1;
      });

      setTimesheets(timesheetsData);
    } catch (error) {
      console.error('Error fetching timesheets:', error);
    }
  };

  const handleApprove = async (timesheetId: string) => {
    try {
      await updateDoc(doc(db, 'timesheets', timesheetId), {
        approved: true,
      });
      await fetchTimesheets(currentUserId, userRole || undefined);
    } catch (error) {
      console.error('Error approving timesheet:', error);
    }
  };

  const handleReject = async (timesheetId: string) => {
    if (!confirm('Är du säker på att du vill neka detta tidkort?')) return;
    
    try {
      await updateDoc(doc(db, 'timesheets', timesheetId), {
        approved: false,
      });
      await fetchTimesheets(currentUserId, userRole || undefined);
    } catch (error) {
      console.error('Error rejecting timesheet:', error);
    }
  };

  const formatWeek = (weekStart: string) => {
    try {
      const date = new Date(weekStart);
      const weekNumber = getWeekNumber(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 4);
      
      return `V. ${weekNumber} (${date.getDate()}/${date.getMonth() + 1} - ${endDate.getDate()}/${endDate.getMonth() + 1})`;
    } catch {
      return weekStart;
    }
  };

  const getWeekNumber = (date: Date) => {
    const jan4 = new Date(date.getFullYear(), 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4.getDay() - 1));
    const weekNum = Math.floor((date.getTime() - monday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return weekNum;
  };

  const filteredTimesheets = timesheets.filter(t => {
    if (filter === 'pending') return !t.approved;
    if (filter === 'approved') return t.approved;
    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p>Laddar tidkort...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            ← Tillbaka
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Tidkort</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all' 
                ? 'bg-orange-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Alla ({timesheets.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'pending' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Väntande ({timesheets.filter(t => !t.approved).length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'approved' 
                ? 'bg-green-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Godkända ({timesheets.filter(t => t.approved).length})
          </button>
        </div>

        {/* Timesheets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTimesheets.map(timesheet => (
            <div
              key={timesheet.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{timesheet.studentName}</h3>
                  <p className="text-sm text-gray-600">{formatWeek(timesheet.weekStart)}</p>
                </div>
                {timesheet.approved ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                    Godkänd
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                    Väntande
                  </span>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total arbetstid:</span>
                  <span className="font-semibold text-lg">{timesheet.totalHours}h</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTimesheet(timesheet)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  Visa detaljer
                </button>
                {!timesheet.approved && (
                  <button
                    onClick={() => handleApprove(timesheet.id)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                  >
                    Godkänn
                  </button>
                )}
                {timesheet.approved && (
                  <button
                    onClick={() => handleReject(timesheet.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                  >
                    Neka
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredTimesheets.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">Inga tidkort att visa</p>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedTimesheet && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedTimesheet(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4">{selectedTimesheet.studentName}</h2>
            <p className="text-gray-600 mb-6">{formatWeek(selectedTimesheet.weekStart)}</p>

            <div className="space-y-4 mb-6">
              <h3 className="font-semibold">Arbetad tid per dag:</h3>
              {Object.entries(selectedTimesheet.entries || {}).map(([day, entries]: [string, any]) => {
                const dayTotal = Object.values(entries || {}).reduce((sum: number, hours: any) => 
                  sum + (Number(hours) || 0), 0
                );
                return (
                  <div key={day} className="border-b pb-2">
                    <div className="flex justify-between font-medium">
                      <span className="capitalize">{day}</span>
                      <span>{dayTotal}h</span>
                    </div>
                    {entries && Object.entries(entries).map(([time, hours]: [string, any]) => (
                      <div key={time} className="text-sm text-gray-600 ml-4 flex justify-between">
                        <span>{time}</span>
                        <span>{hours}h</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total arbetstid:</span>
                <span className="text-2xl font-bold text-blue-600">{selectedTimesheet.totalHours}h</span>
              </div>
            </div>

            <div className="flex gap-2">
              {!selectedTimesheet.approved && (
                <button
                  onClick={() => {
                    handleApprove(selectedTimesheet.id);
                    setSelectedTimesheet(null);
                  }}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium"
                >
                  Godkänn tidkort
                </button>
              )}
              <button
                onClick={() => setSelectedTimesheet(null)}
                className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 font-medium"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
