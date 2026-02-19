'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, functions } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

interface Student {
  id: string;
  email: string;
  name: string;
  classId?: string;
  className?: string;
  timesheetCount: number;
  totalHours: number;
  approvedTimesheets: number;
  assessmentCount: number;
  specialization?: string;
}

interface ClassData {
  id: string;
  name: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('');
  const [savingSpecialization, setSavingSpecialization] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const router = useRouter();

  const specializationOptions = [
    'Träarbetare',
    'Murare',
    'Målare',
    'Plåtslagare',
    'Elektriker',
    'VVS',
    'Anläggare',
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.data()?.role || null;
      setUserRole(role);
      await fetchClasses(user.uid, role);
      await fetchStudents(user.uid, role);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const fetchClasses = async (currentUserId: string, role?: string) => {
    try {
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const filteredClasses = role === 'teacher'
        ? classesSnapshot.docs.filter(doc => doc.data().teacherUid === currentUserId)
        : classesSnapshot.docs;
      const classesData = filteredClasses.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Okänd klass',
      }));
      setClasses(classesData);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchStudents = async (currentUserId: string, role?: string) => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      const isTeacher = role === 'teacher';
      const classIds = isTeacher
        ? new Set(classesSnapshot.docs
            .filter(doc => doc.data().teacherUid === currentUserId)
            .map(doc => doc.id))
        : new Set(classesSnapshot.docs.map(doc => doc.id));
      
      const studentUsers = usersSnapshot.docs
        .filter(doc => doc.data().role === 'student')
        .filter(doc => {
          if (!isTeacher) return true;
          const data = doc.data();
          const classId = (data.classId || '').toString();
          const teacherUid = (data.teacherUid || '').toString();
          return teacherUid === currentUserId || (classId && classIds.has(classId));
        })
        .map(doc => {
          const classId = doc.data().classId;
          const classDoc = classesSnapshot.docs.find(c => c.id === classId);
          return {
            id: doc.id,
            email: doc.data().email || '',
            name: doc.data().displayName || doc.data().email || 'Okänd',
            classId: classId,
            className: classDoc ? classDoc.data().name : 'Ingen klass',
            specialization: doc.data().specialization || '',
          };
        });

      const timesheetsSnapshot = await getDocs(collection(db, 'timesheets'));
      const assessmentsSnapshot = await getDocs(collection(db, 'assessmentRequests'));
      const studentIds = new Set(studentUsers.map(student => student.id));
      const filteredTimesheets = isTeacher
        ? timesheetsSnapshot.docs.filter(doc => {
            const data = doc.data();
            const classId = (data.classId || '').toString();
            const teacherUid = (data.teacherUid || '').toString();
            const studentUid = (data.studentUid || '').toString();
            return teacherUid === currentUserId || (classId && classIds.has(classId)) || studentIds.has(studentUid);
          })
        : timesheetsSnapshot.docs;
      const filteredAssessments = isTeacher
        ? assessmentsSnapshot.docs.filter(doc => {
            const studentUid = (doc.data().studentUid || '').toString();
            return studentIds.has(studentUid);
          })
        : assessmentsSnapshot.docs;
      
      const studentsWithStats = studentUsers.map(student => {
        const studentTimesheets = filteredTimesheets.filter(
          doc => doc.data().studentUid === student.id
        );

        const approvedTimesheets = studentTimesheets.filter(
          doc => doc.data().approved === true
        );

        let totalHours = 0;
        studentTimesheets.forEach(timesheet => {
          const entries = timesheet.data().entries || {};
          Object.values(entries).forEach((dayEntries: any) => {
            if (dayEntries && typeof dayEntries === 'object') {
              Object.values(dayEntries).forEach((hours: any) => {
                totalHours += Number(hours) || 0;
              });
            }
          });
        });

        const assessmentCount = filteredAssessments.filter(
          doc => doc.data().studentUid === student.id
        ).length;

        return {
          ...student,
          timesheetCount: studentTimesheets.length,
          approvedTimesheets: approvedTimesheets.length,
          totalHours,
          assessmentCount,
        };
      });

      setStudents(studentsWithStats);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!confirm(`Är du säker på att du vill ta bort ${student.name} helt från systemet? Detta kan inte ångras.`)) {
      return;
    }

    try {
      setDeletingStudent(student);
      
      // Anropa Cloud Function för att ta bort användaren
      const deleteUserCallable = httpsCallable(functions, 'deleteUser');
      await deleteUserCallable({ uid: student.id });

      // Uppdatera listan
      await fetchStudents(auth.currentUser?.uid || '', userRole || undefined);
      setDeletingStudent(null);
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Fel vid borttagning av elev');
      setDeletingStudent(null);
    }
  };

  const filteredStudents = students
    .filter(s => {
      // Klassfilter
      if (selectedClassId !== 'ALL' && s.classId !== selectedClassId) {
        return false;
      }
      // Sökfilter
      if (!searchTerm) return true;
      return (
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.className && s.className.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p>Laddar elever...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Elever</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Class Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Välj klass
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
          >
            <option value="ALL">Alla klasser</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Sök elev (namn, email, klass)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">
              {selectedClassId === 'ALL' ? 'Totalt antal elever' : 'Elever i vald klass'}
            </p>
            <p className="text-2xl font-bold text-blue-600">{filteredStudents.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total arbetstid</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredStudents.reduce((sum, s) => sum + s.totalHours, 0)}h
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Inskickade bedömningar</p>
            <p className="text-2xl font-bold text-purple-600">
              {filteredStudents.reduce((sum, s) => sum + s.assessmentCount, 0)}
            </p>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Namn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  E-post
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Klass
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tidkort
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timmar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bedömningar
                </th>
                {userRole === 'teacher' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Yrkesutgång
                  </th>
                )}
                {userRole === 'teacher' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Åtgärder
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map(student => (
                <tr 
                  key={student.id} 
                  onClick={() => router.push(`/dashboard/students/${student.id}`)}
                  className="hover:bg-orange-50 cursor-pointer transition"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{student.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{student.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{student.className || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {student.approvedTimesheets}/{student.timesheetCount}
                      <span className="text-xs text-gray-500 ml-1">godkända</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{student.totalHours}h</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{student.assessmentCount}</div>
                  </td>
                  {userRole === 'teacher' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">
                          {student.specialization || '-'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStudent(student);
                            setSelectedSpecialization(student.specialization || '');
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Ändra
                        </button>
                      </div>
                    </td>
                  )}
                  {userRole === 'teacher' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStudent(student);
                        }}
                        disabled={deletingStudent?.id === student.id}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-60"
                      >
                        {deletingStudent?.id === student.id ? 'Tar bort...' : 'Ta bort'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm ? 'Inga elever matchade sökningen' : 'Inga elever hittades'}
              </p>
            </div>
          )}
        </div>

        {editingStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ändra yrkesutgång</h2>
              <p className="text-sm text-gray-600 mb-4">{editingStudent.name}</p>
              <select
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
              >
                <option value="">Välj yrkesutgång</option>
                {specializationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Avbryt
                </button>
                <button
                  onClick={async () => {
                    if (!selectedSpecialization) return;
                    try {
                      setSavingSpecialization(true);
                      const updateSpecialization = httpsCallable(functions, 'updateStudentSpecialization');
                      await updateSpecialization({
                        uid: editingStudent.id,
                        specialization: selectedSpecialization,
                      });
                      setEditingStudent(null);
                      await fetchStudents(auth.currentUser?.uid || '', userRole || undefined);
                    } catch (error) {
                      console.error('Error updating specialization:', error);
                    } finally {
                      setSavingSpecialization(false);
                    }
                  }}
                  disabled={savingSpecialization}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                >
                  Spara
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
