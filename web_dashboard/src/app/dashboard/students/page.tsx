
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '../../../lib/firebase';

type Student = {
  id: string;
  email: string;
  name: string;
  classId: string;
  className: string;
  specialization: string;
  timesheetCount?: number;
  approvedTimesheets?: number;
  totalHours?: number;
  assessmentCount?: number;
};

export default function StudentsPage() {
    // --- Klasshantering för lärare ---
    const [newClassName, setNewClassName] = useState('');
    const [creatingClass, setCreatingClass] = useState(false);
    const [classError, setClassError] = useState<string | null>(null);
    const [classCodes, setClassCodes] = useState<{ classId: string; code: string }[]>([]);
    const [showClassMenu, setShowClassMenu] = useState(false);
    const [qrClass, setQrClass] = useState<{ name: string; code: string; id: string } | null>(null);
    const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

    // Skapa ny klass och generera kod
    const handleCreateClass = async () => {
      setClassError(null);
      if (!newClassName.trim()) {
        setClassError('Ange ett klassnamn.');
        return;
      }
      setCreatingClass(true);
      try {
        // Skapa klass i Firestore
        const { addDoc, collection } = await import('firebase/firestore');
        const classRef = await addDoc(collection(db, 'classes'), {
          name: newClassName.trim(),
          teacherUid: auth.currentUser?.uid,
          createdAt: new Date(),
        });
        // Generera klasskod (slumpmässig 6-siffrig kod)
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await addDoc(collection(db, 'classCodes'), {
          classId: classRef.id,
          code,
          createdAt: new Date(),
          teacherUid: auth.currentUser?.uid,
        });
        setNewClassName('');
        await fetchClasses(auth.currentUser?.uid || '', userRole || undefined);
        await fetchClassCodes();
      } catch (err) {
        setClassError('Kunde inte skapa klass.');
      } finally {
        setCreatingClass(false);
      }
    };

    // Hämta klasskoder för lärarens klasser
    const fetchClassCodes = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const codesSnapshot = await getDocs(collection(db, 'classCodes'));
        const teacherUid = auth.currentUser?.uid;
        const codes = codesSnapshot.docs
          .filter(doc => doc.data().teacherUid === teacherUid)
          .map(doc => ({ classId: doc.data().classId, code: doc.data().code }));
        setClassCodes(codes);
      } catch (err) {
        setClassCodes([]);
      }
    };

  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('');
  const [savingSpecialization, setSavingSpecialization] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

    // Hämta klasskoder när klasser laddas
    useEffect(() => {
      if (userRole === 'teacher') {
        fetchClassCodes();
      }
    }, [userRole, classes.length]);

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

  // Returnera endast innehållet för elever (utan sidomeny och main-wrapper)
  return (
    <>
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-orange-600 hover:text-orange-700 font-medium"
        >
          ← Tillbaka
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Elever</h1>
      </div>

      {/* Klasshantering för lärare */}
      {userRole === 'teacher' && (
        <div className="mb-8 bg-orange-50 border border-orange-200 rounded-lg p-6 flex flex-col md:flex-row md:items-start gap-8">
          {/* Vänster: Skapa klass */}
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-4 text-orange-700">Skapa klass</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nytt klassnamn</label>
              <input
                type="text"
                value={newClassName}
                onChange={e => setNewClassName(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: BA22A"
              />
            </div>
            <button
              type="button"
              onClick={handleCreateClass}
              disabled={creatingClass}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-60 mt-4"
            >
              {creatingClass ? 'Skapar...' : 'Skapa klass & kod'}
            </button>
            {classError && <div className="text-red-600 mt-2">{classError}</div>}
          </div>
          {/* Höger: Hantera klasser */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-orange-700">Hantera klasser</h3>
              <button onClick={() => setShowClassMenu(v => !v)} className="text-xs text-orange-600 underline">{showClassMenu ? 'Dölj' : 'Visa'}</button>
            </div>
            {showClassMenu && (
              <ul className="space-y-2">
                {classes.map(cls => {
                  const codeObj = classCodes.find(c => c.classId === cls.id);
                  return (
                    <li key={cls.id} className="flex items-center gap-2 bg-white rounded px-2 py-1 border border-orange-100">
                      <span className="font-semibold">{cls.name}</span>
                      <span className="text-xs bg-orange-100 text-orange-700 rounded px-2 py-1">{codeObj ? codeObj.code : 'Ingen kod'}</span>
                      <button
                        className="text-blue-600 text-xs underline"
                        onClick={() => setQrClass({ name: cls.name, code: codeObj?.code || '', id: cls.id })}
                        type="button"
                      >QR/länk</button>
                      <button
                        className="text-red-600 text-xs underline"
                        disabled={deletingClassId === cls.id}
                        onClick={async () => {
                          if (!confirm(`Ta bort klassen '${cls.name}'? Detta tar bort klassen och dess kod.`)) return;
                          setDeletingClassId(cls.id);
                          try {
                            const { deleteDoc, doc: docRef } = await import('firebase/firestore');
                            await deleteDoc(docRef(db, 'classes', cls.id));
                            const codeToDelete = classCodes.find(c => c.classId === cls.id);
                            if (codeToDelete) {
                              await deleteDoc(docRef(db, 'classCodes', codeToDelete.code));
                            }
                            await fetchClasses(auth.currentUser?.uid || '', userRole || undefined);
                            await fetchClassCodes();
                          } catch (err) {
                            alert('Kunde inte ta bort klass.');
                          } finally {
                            setDeletingClassId(null);
                          }
                        }}
                        type="button"
                      >{deletingClassId === cls.id ? 'Tar bort...' : 'Ta bort'}</button>
                    </li>
                  );
                })}
                {classes.length === 0 && <li className="text-gray-500">Inga klasser skapade än.</li>}
              </ul>
            )}
          </div>
        </div>
      )}
            {/* QR-kod/modal för klass */}
            {qrClass && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-xs w-full relative">
                  <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700" onClick={() => setQrClass(null)}>&times;</button>
                  <h4 className="text-lg font-semibold mb-2">{qrClass.name}</h4>
                  <div className="mb-2">
                    <span className="text-xs bg-orange-100 text-orange-700 rounded px-2 py-1">Kod: {qrClass.code}</span>
                  </div>
                  {/* QR-kod (använd extern tjänst, t.ex. goqr.me) */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.origin + '/join-class/' + qrClass.code)}`}
                    alt="QR-kod"
                    className="mx-auto mb-2"
                  />
                  <div className="text-xs break-all mb-2">Länk: <a href={`/join-class/${qrClass.code}`} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{window.location.origin + '/join-class/' + qrClass.code}</a></div>
                </div>
              </div>
            )}
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
            {filteredStudents.reduce((sum, s) => sum + (s.totalHours ?? 0), 0)}h
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
    </>
  );
}
