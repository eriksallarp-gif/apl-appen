import React, { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, where, updateDoc, doc, getDoc, deleteField, setDoc, deleteDoc } from 'firebase/firestore';

interface Student {
  id: string;
  name: string;
  email: string;
  weeks: any[];
  weekEnabled?: Record<string, boolean>;
  timesheetCount?: number;
  approvedTimesheets?: number;
  totalHours?: number;
  assessmentCount?: number;
  compensation?: number;
}

interface Class {
  id: string;
  name: string;
}

// Helpers: normalize week formats to match Flutter app (store weeks as strings like 'V. 12')
const weekString = (n: number) => `V. ${n}`;

const normalizeWeeksForFirestore = (arr: any[]): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map(w => {
    if (typeof w === 'number') return weekString(w);
    if (typeof w === 'string') {
      const trimmed = w.trim();
      if (/^V\.\s*\d+$/i.test(trimmed)) return trimmed;
      const digits = trimmed.match(/\d+/);
      if (digits) return weekString(parseInt(digits[0], 10));
      return trimmed;
    }
    return String(w);
  });
};

const parseWeekStringsToNumbers = (arr: any[]): number[] => {
  if (!Array.isArray(arr)) return [];
  const s = new Set<number>();
  arr.forEach(w => {
    if (typeof w === 'number') s.add(w);
    else if (typeof w === 'string') {
      const m = w.match(/(\d+)/);
      if (m) s.add(parseInt(m[1], 10));
    }
  });
  return Array.from(s).sort((a, b) => a - b);
};

// Convert selected week numbers to a weekEnabled map { "17": true, ... }
const weeksToWeekEnabled = (weeks: number[]) => {
  const out: Record<string, boolean> = {};
  (weeks || []).forEach(w => { out[String(w)] = true; });
  return out;
};

// Convert weekEnabled map to number array
const weekEnabledToNumbers = (m: Record<string, boolean> | undefined) => {
  if (!m) return [];
  return Object.keys(m)
    .map(k => parseInt(k, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
};

// Convert weekEnabled map to normalized display strings ['V. 17']
const weekEnabledToStrings = (m: Record<string, boolean> | undefined) => {
  return weekEnabledToNumbers(m).map(n => weekString(n));
};

const WeekAccessManager: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [classWeeks, setClassWeeks] = useState<string[]>([]); // stored as Flutter-style strings e.g. 'V. 12'
  const [classWeeksLoading, setClassWeeksLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentWeeksLoading, setStudentWeeksLoading] = useState(false);
  const [studentOverrideActive, setStudentOverrideActive] = useState(false);
  const [weeks, setWeeks] = useState<number[]>([]);
  // Temp selection state
  const [classSelectedWeeks, setClassSelectedWeeks] = useState<number[]>([]);
  const [studentSelectedWeeks, setStudentSelectedWeeks] = useState<number[]>([]);

  useEffect(() => {
    // Hämta klasser som läraren ansvarar för
    const fetchClasses = async () => {
      const q = query(collection(db, 'classes'), where('teacherUid', '==', auth.currentUser?.uid));
      const snapshot = await getDocs(q);
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    };
    fetchClasses();
    // Initiera veckolista 1..53
    const allWeeks = Array.from({ length: 53 }, (_, i) => i + 1);
    setWeeks(allWeeks);
  }, []);

  // When a class is selected: load class weeks and students
  useEffect(() => {
    if (!selectedClass) return;
    // load class weeks
    const fetchClassWeeks = async () => {
      setClassWeeksLoading(true);
      try {
        const cDoc = await getDoc(doc(db, 'classes', selectedClass));
        const data = cDoc.exists() ? cDoc.data() : {};
        const cwMap: Record<string, boolean> | undefined = data?.weekEnabled;
        const normStrings = weekEnabledToStrings(cwMap);
        const nums = weekEnabledToNumbers(cwMap);
        setClassWeeks(normStrings);
        setClassSelectedWeeks(nums);
      } catch (err) {
        console.error('Error fetching class weeks', err);
        setClassWeeks([]);
        setClassSelectedWeeks([]);
      } finally {
        setClassWeeksLoading(false);
      }
    };

    // load students
    const fetchStudents = async () => {
      setStudentsLoading(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('classId', '==', selectedClass),
          where('teacherUid', '==', auth.currentUser?.uid),
          where('role', '==', 'student')
        );
        const snapshot = await getDocs(q);
        const studentsData: Student[] = snapshot.docs.map(d => {
          const dd = d.data();
          const weekEnabled: Record<string, boolean> | undefined = dd.weekEnabled;
          const weeksArr = weekEnabled ? weekEnabledToStrings(weekEnabled) : (dd.weeks || []);
          return {
            id: d.id,
            name: dd.displayName || dd.name || dd.email || 'Okänd',
            email: dd.email,
            weeks: weeksArr,
            weekEnabled: weekEnabled,
            timesheetCount: dd.timesheetCount,
            approvedTimesheets: dd.approvedTimesheets,
            totalHours: dd.totalHours,
            assessmentCount: dd.assessmentCount,
            compensation: dd.compensation,
          } as Student;
        });
        setStudents(studentsData);
      } catch (err) {
        console.error('Error fetching students', err);
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchClassWeeks();
    fetchStudents();
    // reset student selection
    setSelectedStudentId('');
    setStudentSelectedWeeks([]);
  }, [selectedClass]);

  // UI handlers
  const handleClassWeekToggle = (week: number, checked: boolean) => {
    setClassSelectedWeeks(prev => checked ? Array.from(new Set([...prev, week])) : prev.filter(w => w !== week));
  };

  const saveClassWeeks = async () => {
    if (!selectedClass) return;
    const weekMap = weeksToWeekEnabled(classSelectedWeeks);
    // Write weekEnabled and ensure teacherUid exists on class doc for Flutter compatibility
    await updateDoc(doc(db, 'classes', selectedClass), { weekEnabled: weekMap, teacherUid: auth.currentUser?.uid });
    setClassWeeks(classSelectedWeeks.map(w => weekString(w)));

    // Read back and log saved weekEnabled map for verification
    try {
      const verifyClassSnap = await getDoc(doc(db, 'classes', selectedClass));
      if (process.env.NODE_ENV !== 'production') console.log('Class weekEnabled saved (verify):', verifyClassSnap.exists() ? verifyClassSnap.data().weekEnabled : null);
    } catch (e) {
      console.error('Error verifying class weekEnabled', e);
    }
  };

  const handleSelectStudent = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentOverrideActive(false);
    if (!studentId) {
      setStudentSelectedWeeks([]);
      return;
    }
    setStudentWeeksLoading(true);

    try {
      // Load override doc at classes/{classId}/studentWeekOverrides/{studentUid}
      const overrideRef = doc(db, 'classes', selectedClass, 'studentWeekOverrides', studentId);
      if (process.env.NODE_ENV !== 'production') console.log('DEBUG: Loading overrideRef', overrideRef.path);
      const overSnap = await getDoc(overrideRef);
      if (overSnap.exists()) {
        const overMap: Record<string, boolean> | undefined = overSnap.data().weekEnabled;
        if (process.env.NODE_ENV !== 'production') console.log('DEBUG: Loaded override weekEnabled', overMap);
        const nums = weekEnabledToNumbers(overMap);
        setStudentSelectedWeeks(nums);
        setStudentOverrideActive(Object.keys(overMap || {}).length > 0);
        // update local student cache
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, weekEnabled: overMap, weeks: weekEnabledToStrings(overMap) } : s));
      } else {
        // No override -> inherit class weeks
        const nums = parseWeekStringsToNumbers(classWeeks);
        setStudentSelectedWeeks(nums);
        setStudentOverrideActive(false);
      }
    } catch (e) {
      console.error('Error loading student override', e);
      // fallback
      setStudentSelectedWeeks(parseWeekStringsToNumbers(classWeeks));
      setStudentOverrideActive(false);
    } finally {
      setStudentWeeksLoading(false);
    }
  };

  const handleStudentWeekToggle = (week: number, checked: boolean) => {
    setStudentSelectedWeeks(prev => checked ? Array.from(new Set([...prev, week])) : prev.filter(w => w !== week));
  };

  const saveStudentWeeks = async (studentId: string) => {
    if (!selectedClass) {
      console.error('No class selected when saving student weeks');
      return;
    }
    const weekMap = weeksToWeekEnabled(studentSelectedWeeks);
    const overrideRef = doc(db, 'classes', selectedClass, 'studentWeekOverrides', studentId);
    if (process.env.NODE_ENV !== 'production') console.log('DEBUG: Saving overrideRef', overrideRef.path, weekMap);
    await setDoc(overrideRef, { weekEnabled: weekMap }, { merge: true });
    // update local student data
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, weeks: weekEnabledToStrings(weekMap), weekEnabled: weekMap } : s));
    setStudentOverrideActive(Object.keys(weekMap).length > 0);

    // Read back override to verify
    try {
      const verifyUser = await getDoc(overrideRef);
      if (process.env.NODE_ENV !== 'production') console.log('Student override saved (verify):', verifyUser.exists() ? verifyUser.data().weekEnabled : null);
    } catch (e) {
      console.error('Error verifying student override', e);
    }
  };

  // Helper: compute ISO weekStart (Monday) YYYY-MM-DD from year and ISO week number
  const weekNumberToWeekStart = (year: number, weekNumber: number) => {
    // Jan 4th is always in week 1
    const jan4 = new Date(year, 0, 4);
    // Calculate Monday of week 1
    const jan4WeekDay = (jan4.getDay() + 6) % 7; // 0=Mon, ... 6=Sun
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - jan4WeekDay);
    const target = new Date(mondayOfWeek1);
    target.setDate(mondayOfWeek1.getDate() + (weekNumber - 1) * 7);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const resetStudentWeeks = async (studentId: string) => {
    if (!selectedClass) return;
    // remove override doc
    const overrideRef = doc(db, 'classes', selectedClass, 'studentWeekOverrides', studentId);
    try {
      await deleteDoc(overrideRef);
      if (process.env.NODE_ENV !== 'production') console.log('DEBUG: Deleted overrideRef', overrideRef.path);
    } catch (e) {
      // fallback: delete field
      await updateDoc(overrideRef, { weekEnabled: deleteField() }).catch(() => {});
    }
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, weeks: [] as any[], weekEnabled: undefined } : s));
    // reset selection to class weeks
    setStudentSelectedWeeks(parseWeekStringsToNumbers(classWeeks));
    setStudentOverrideActive(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Veckohantering</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Välj klass</label>
          <select
            value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setSelectedStudentId(''); }}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="">-- Välj klass --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Section A: Class weeks */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-800 mb-2">Klassens veckor (standard)</h3>
          {classWeeksLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
            </div>
          ) : !selectedClass ? (
            <div className="text-sm text-gray-500">Välj en klass för att konfigurera klassens veckor.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {weeks.map(w => (
                  <label key={w} className={`inline-flex items-center px-2 py-1 border rounded text-sm ${classSelectedWeeks.includes(w) ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                    <input type="checkbox" checked={classSelectedWeeks.includes(w)} onChange={e => handleClassWeekToggle(w, e.target.checked)} className="mr-2" />
                    <span className="text-sm">{w}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveClassWeeks} className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">Spara klassens veckor</button>
                <div className="text-sm text-gray-500">{classWeeks.length ? `${classWeeks.length} veckor sparade` : 'Inga veckor valda'}</div>
              </div>
            </>
          )}
        </div>

        {/* Section B: Student overrides */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-800 mb-2">Elevens egna veckor (valfritt)</h3>
          <div className="mb-3 text-sm text-gray-600">
            {selectedStudentId
              ? (studentOverrideActive ? 'Eget schema aktivt' : 'Använder klassens veckor')
              : 'Alla elever använder klassens veckor som standard.'}
          </div>

          <div className="mb-4">
            <select
              value={selectedStudentId}
              onChange={e => handleSelectStudent(e.target.value)}
              disabled={!selectedClass || studentsLoading}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white disabled:opacity-60"
            >
              <option value="">-- Välj elev --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.email ? ` (${s.email})` : ''}</option>
              ))}
            </select>
          </div>

          {studentsLoading ? (
            <div className="text-sm text-gray-500">Laddar elever...</div>
          ) : !selectedClass ? null : students.length === 0 ? (
            <div className="text-sm text-gray-500">Inga elever i klassen.</div>
          ) : selectedStudentId ? (
            <div>
              {studentWeeksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {weeks.map(w => (
                      <label key={w} className={`inline-flex items-center px-2 py-1 border rounded text-sm ${studentSelectedWeeks.includes(w) ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                        <input type="checkbox" checked={studentSelectedWeeks.includes(w)} onChange={e => handleStudentWeekToggle(w, e.target.checked)} className="mr-2" />
                        <span className="text-sm">{w}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => saveStudentWeeks(selectedStudentId)} className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">Spara elevens veckor</button>
                    <button onClick={() => resetStudentWeeks(selectedStudentId)} className="bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg">Återställ till klassens veckor</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-600">Välj en elev för att redigera individuella veckor.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeekAccessManager;
