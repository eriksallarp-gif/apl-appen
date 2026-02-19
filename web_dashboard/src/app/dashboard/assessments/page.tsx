'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

interface Assessment {
  id: string;
  studentName: string;
  weeks: string[];
  totalHours: number;
  status: string;
  createdAt?: any;
  submittedAt?: any;
  averageRating?: string;
  supervisorCompany?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  lunchCount?: number;
  lunchApproved?: number;
  travelCount?: number;
  travelApproved?: number;
  assessmentData?: any;
  images?: Array<{ url: string; fileName: string; uploadedAt: any }>;
  imageComments?: { [key: number]: string };
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted'>('submitted');
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.data()?.role || null;
      await fetchAssessments(user.uid, role);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchAssessments = async (currentUserId: string, role?: string) => {
    try {
      const assessmentsSnapshot = await getDocs(collection(db, 'assessmentRequests'));
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

      const assessmentsData = assessmentsSnapshot.docs
        .filter(doc => {
          if (!isTeacher) return true;
          const studentUid = (doc.data().studentUid || '').toString();
          return studentIds.has(studentUid);
        })
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Assessment[];

      // Sortera: inskickade först, sedan efter datum
      assessmentsData.sort((a, b) => {
        if (a.status === b.status) {
          const aDate = a.submittedAt?.toDate() || a.createdAt?.toDate() || new Date(0);
          const bDate = b.submittedAt?.toDate() || b.createdAt?.toDate() || new Date(0);
          return bDate.getTime() - aDate.getTime();
        }
        return a.status === 'submitted' ? -1 : 1;
      });

      setAssessments(assessmentsData);
    } catch (error) {
      console.error('Error fetching assessments:', error);
    }
  };

  const filteredAssessments = assessments.filter(a => {
    if (filter === 'pending') return a.status === 'pending';
    if (filter === 'submitted') return a.status === 'submitted';
    return true;
  });

  const getRatingColor = (rating?: string) => {
    if (!rating) return 'text-gray-500';
    const num = parseFloat(rating);
    if (num >= 4.5) return 'text-green-600';
    if (num >= 3.5) return 'text-green-400';
    if (num >= 2.5) return 'text-orange-500';
    return 'text-red-500';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString('sv-SE', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p>Laddar bedömningar...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Bedömningar</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all' ? 'bg-orange-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Alla ({assessments.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Väntande ({assessments.filter(a => a.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('submitted')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'submitted' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Inskickade ({assessments.filter(a => a.status === 'submitted').length})
          </button>
        </div>

        {/* Assessments Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAssessments.map(assessment => (
            <div
              key={assessment.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer"
              onClick={() => setSelectedAssessment(assessment)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{assessment.studentName}</h3>
                  <p className="text-sm text-gray-600">{assessment.weeks.join(', ')}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {assessment.totalHours} timmar
                  </p>
                </div>
                {assessment.status === 'submitted' && assessment.averageRating && (
                  <div className="text-right ml-4">
                    <div className={`text-3xl font-bold ${getRatingColor(assessment.averageRating)}`}>
                      {assessment.averageRating}
                    </div>
                    <div className="text-xs text-gray-500">Snittbetyg</div>
                  </div>
                )}
              </div>

              {assessment.status === 'submitted' ? (
                <div className="space-y-2 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="font-medium">{assessment.supervisorCompany}</p>
                    <p className="text-gray-600">{assessment.supervisorName}</p>
                    <p className="text-gray-500 text-xs">{assessment.supervisorPhone}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                      🍽️ Luncher: {assessment.lunchApproved}/{assessment.lunchCount}
                    </span>
                    <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                      🚗 Km: {assessment.travelApproved}/{assessment.travelCount}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Inskickad: {formatDate(assessment.submittedAt)}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                    Väntande på handledare
                  </span>
                  <p className="text-xs text-gray-500 mt-2">
                    Skapad: {formatDate(assessment.createdAt)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredAssessments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500">Inga bedömningar att visa</p>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedAssessment && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedAssessment(null)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-2">{selectedAssessment.studentName}</h2>
            <p className="text-gray-600 mb-6">
              {selectedAssessment.weeks.join(', ')} • {selectedAssessment.totalHours} timmar
            </p>
            
            {selectedAssessment.status === 'submitted' && selectedAssessment.assessmentData && (
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Företag</p>
                      <p className="font-semibold">{selectedAssessment.supervisorCompany}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Handledare</p>
                      <p className="font-semibold">{selectedAssessment.supervisorName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Telefon</p>
                      <p className="font-semibold">{selectedAssessment.supervisorPhone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Snittbetyg</p>
                      <p className={`text-2xl font-bold ${getRatingColor(selectedAssessment.averageRating)}`}>
                        {selectedAssessment.averageRating}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bifogade bilder */}
                {(selectedAssessment as any).images && (selectedAssessment as any).images.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Bifogade bilder</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {(selectedAssessment as any).images.map((image: any, index: number) => (
                        <div key={index} className="relative group">
                          <img
                            src={image.url}
                            alt={`Bild ${index + 1}`}
                            className="w-full aspect-square object-cover rounded-lg"
                          />
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/0 hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-lg"
                          >
                            <span className="bg-white text-gray-900 px-3 py-1 rounded text-sm font-medium">
                              🔍 Visa
                            </span>
                          </a>
                        </div>
                      ))}
                    </div>
                    {/* Visa bildkommentarer om de finns */}
                    {(selectedAssessment as any).imageComments && Object.keys((selectedAssessment as any).imageComments).length > 0 && (
                      <div className="mt-4 bg-gray-50 p-3 rounded">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Handledarens kommentarer:</p>
                        {Object.entries((selectedAssessment as any).imageComments).map(([index, comment]: [string, any]) => (
                          comment && (
                            <p key={index} className="text-sm text-gray-600 mb-1">
                              • Bild {parseInt(index) + 1}: {comment}
                            </p>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-lg mb-3">Bedömning per kriterium</h3>
                  {Object.entries(selectedAssessment.assessmentData).map(([criterion, data]: [string, any]) => (
                    <div key={criterion} className="border-b py-3 last:border-0">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-gray-900">{criterion}</strong>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div
                                key={i}
                                className={`w-2 h-6 rounded ${
                                  i <= data.rating ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-blue-600 font-bold text-lg w-8">{data.rating}</span>
                        </div>
                      </div>
                      {data.comment && (
                        <p className="text-sm text-gray-600 italic mt-1 bg-gray-50 p-2 rounded">
                          "{data.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Luncher</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedAssessment.lunchApproved}
                      <span className="text-sm text-gray-500">/{selectedAssessment.lunchCount}</span>
                    </p>
                    <p className="text-xs text-gray-500">godkända</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Kilometer</p>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedAssessment.travelApproved}
                      <span className="text-sm text-gray-500">/{selectedAssessment.travelCount}</span>
                    </p>
                    <p className="text-xs text-gray-500">godkända km</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500 pt-4 border-t">
                  Inskickad: {formatDate(selectedAssessment.submittedAt)}
                </div>
              </div>
            )}

            {selectedAssessment.status === 'pending' && (
              <div className="bg-yellow-50 p-6 rounded-lg text-center">
                <p className="text-yellow-800 font-medium mb-2">
                  Denna bedömning väntar på att fyllas i av handledaren
                </p>
                <p className="text-sm text-yellow-700">
                  Skapad: {formatDate(selectedAssessment.createdAt)}
                </p>
              </div>
            )}

            <button
              onClick={() => setSelectedAssessment(null)}
              className="mt-6 w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 font-medium transition"
            >
              Stäng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
