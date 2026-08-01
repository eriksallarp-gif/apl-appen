const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} = require('firebase/firestore');

const projectId = 'demo-apl-appen';
const rules = readFileSync(
  path.resolve(__dirname, '..', '..', 'firestore.rules'),
  'utf8',
);

let testEnv;

function docRef(db, docPath) {
  return doc(db, ...docPath.split('/'));
}

async function seedDocuments(documents) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const { path: docPath, data } of documents) {
      await setDoc(docRef(db, docPath), data);
    }
  });
}

async function clearFirestore() {
  await testEnv.clearFirestore();
}

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test('student cannot promote own role', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/student-1',
      data: {
        role: 'student',
        status: 'active',
        displayName: 'Elev Ett',
      },
    },
  ]);

  const db = testEnv.authenticatedContext('student-1').firestore();

  await assertFails(
    updateDoc(docRef(db, 'users/student-1'), {
      role: 'teacher',
    }),
  );
});

test('teacher can create own pending profile with web registration fields', async () => {
  await clearFirestore();

  const db = testEnv.authenticatedContext('teacher-1').firestore();

  await assertSucceeds(
    setDoc(docRef(db, 'users/teacher-1'), {
      name: 'Ada Lovelace',
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      emailVerified: false,
      mobileNumber: '0701234567',
      role: 'teacher',
      school: 'Yrkesgymnasiet',
      assignedPrograms: ['El- och energiprogrammet'],
      approved: false,
      createdAt: new Date('2026-08-01T09:00:00Z'),
    }),
  );
});

test('teacher can mark own email as verified but cannot self-approve', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: {
        name: 'Ada Lovelace',
        displayName: 'Ada Lovelace',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        emailVerified: false,
        role: 'teacher',
        school: 'Yrkesgymnasiet',
        assignedPrograms: ['El- och energiprogrammet'],
        approved: false,
        createdAt: new Date('2026-08-01T09:00:00Z'),
      },
    },
  ]);

  const db = testEnv.authenticatedContext('teacher-1').firestore();

  await assertSucceeds(
    updateDoc(docRef(db, 'users/teacher-1'), {
      emailVerified: true,
      emailVerifiedAt: new Date('2026-08-01T09:05:00Z'),
    }),
  );

  await assertFails(
    updateDoc(docRef(db, 'users/teacher-1'), {
      approved: true,
    }),
  );
});

test('admin notification create requires verified teacher or admin', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: {
        role: 'teacher',
        status: 'active',
      },
    },
  ]);

  const unverifiedTeacherDb = testEnv
    .authenticatedContext('teacher-1', { email_verified: false })
    .firestore();
  const verifiedTeacherDb = testEnv
    .authenticatedContext('teacher-1', { email_verified: true })
    .firestore();

  await assertFails(
    setDoc(docRef(unverifiedTeacherDb, 'adminNotifications/new-teacher-1'), {
      type: 'newTeacher',
      teacherId: 'teacher-1',
      createdAt: new Date('2026-08-01T09:05:00Z'),
      resolved: false,
    }),
  );

  await assertSucceeds(
    setDoc(docRef(verifiedTeacherDb, 'adminNotifications/new-teacher-2'), {
      type: 'newTeacher',
      teacherId: 'teacher-1',
      createdAt: new Date('2026-08-01T09:06:00Z'),
      resolved: false,
    }),
  );
});

test('student can join a real class but cannot forge teacher linkage', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: {
        role: 'teacher',
        status: 'active',
        school: 'Yrkesgymnasiet',
      },
    },
    {
      path: 'users/teacher-2',
      data: {
        role: 'teacher',
        status: 'active',
        school: 'Annan skola',
      },
    },
    {
      path: 'users/student-1',
      data: {
        role: 'student',
        status: 'active',
        displayName: 'Elev Ett',
      },
    },
    {
      path: 'classes/teacher-1_class-a',
      data: {
        teacherUid: 'teacher-1',
        name: 'Klass A',
      },
    },
  ]);

  const db = testEnv.authenticatedContext('student-1').firestore();

  await assertSucceeds(
    updateDoc(docRef(db, 'users/student-1'), {
      classId: 'teacher-1_class-a',
      teacherUid: 'teacher-1',
      teacherId: 'teacher-1',
      school: 'Yrkesgymnasiet',
    }),
  );

  await assertFails(
    updateDoc(docRef(db, 'users/student-1'), {
      teacherUid: 'teacher-2',
      teacherId: 'teacher-2',
    }),
  );
});

test('teacher can modify own class but not another teachers class', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'users/teacher-2',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'classes/teacher-1_class-a',
      data: { teacherUid: 'teacher-1', name: 'Klass A' },
    },
    {
      path: 'classes/teacher-2_class-b',
      data: { teacherUid: 'teacher-2', name: 'Klass B' },
    },
  ]);

  const db = testEnv.authenticatedContext('teacher-1').firestore();

  await assertSucceeds(
    updateDoc(docRef(db, 'classes/teacher-1_class-a'), {
      name: 'Klass A uppdaterad',
    }),
  );

  await assertFails(
    updateDoc(docRef(db, 'classes/teacher-2_class-b'), {
      name: 'Kapad klass',
    }),
  );
});

test('teacher can delete own timesheet but not another teachers timesheet', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'users/teacher-2',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'timesheets/t1-sheet',
      data: {
        studentUid: 'student-1',
        teacherUid: 'teacher-1',
        classId: 'teacher-1_class-a',
      },
    },
    {
      path: 'timesheets/t2-sheet',
      data: {
        studentUid: 'student-2',
        teacherUid: 'teacher-2',
        classId: 'teacher-2_class-b',
      },
    },
  ]);

  const teacherOneDb = testEnv.authenticatedContext('teacher-1').firestore();

  await assertSucceeds(deleteDoc(docRef(teacherOneDb, 'timesheets/t1-sheet')));
  await assertFails(deleteDoc(docRef(teacherOneDb, 'timesheets/t2-sheet')));
});

test('teacher assessment request access is scoped by teacherUid', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'users/teacher-2',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'users/student-1',
      data: { role: 'student', status: 'active', teacherUid: 'teacher-1' },
    },
    {
      path: 'assessmentRequests/request-1',
      data: {
        studentUid: 'student-1',
        studentName: 'Elev Ett',
        teacherUid: 'teacher-1',
        status: 'pending',
      },
    },
    {
      path: 'assessmentRequests/request-2',
      data: {
        studentUid: 'student-2',
        studentName: 'Elev Tva',
        teacherUid: 'teacher-2',
        status: 'pending',
      },
    },
  ]);

  const teacherOneDb = testEnv.authenticatedContext('teacher-1').firestore();

  const ownQuerySnapshot = await assertSucceeds(
    getDocs(
      query(
        collection(teacherOneDb, 'assessmentRequests'),
        where('teacherUid', '==', 'teacher-1'),
      ),
    ),
  );

  assert.equal(ownQuerySnapshot.size, 1);
  await assertFails(getDoc(docRef(teacherOneDb, 'assessmentRequests/request-2')));
});

test('student can create assessment request with timesheet summaries', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: {
        role: 'teacher',
        status: 'active',
      },
    },
    {
      path: 'users/student-1',
      data: {
        role: 'student',
        status: 'active',
        teacherUid: 'teacher-1',
        gdprConsentVersion: '2026-03-25',
      },
    },
  ]);

  const studentDb = testEnv.authenticatedContext('student-1').firestore();

  await assertSucceeds(
    setDoc(docRef(studentDb, 'assessmentRequests/request-new'), {
      studentUid: 'student-1',
      studentName: 'Elev Ett',
      teacherUid: 'teacher-1',
      timesheetIds: ['sheet-1'],
      weeks: ['V. 12'],
      timesheetSummaries: [
        {
          timesheetId: 'sheet-1',
          weekLabel: 'V. 12',
          totalHours: 24,
          activities: [
            { name: 'Montering', hours: 16 },
            { name: 'Kundservice', hours: 8 },
          ],
        },
      ],
      totalHours: 24,
      lunchCount: 2,
      travelCount: 0,
      status: 'pending',
      createdAt: new Date('2026-04-04T09:00:00Z'),
      token: 'token-123',
      expiresAt: new Date('2026-04-05T09:00:00Z'),
      images: [],
      linkedCompanyName: 'APL AB',
      studentCompanyName: 'APL AB',
      studentSelfAssessment: {
        whatDidYouDo: 'Jag arbetade med montering och kundservice.',
      },
      assessmentTemplateSnapshot: {
        selfAssessmentFields: [],
        supervisorCriteria: [],
      },
    }),
  );
});

test('teacher can only write own assessment template override document', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'users/teacher-2',
      data: { role: 'teacher', status: 'active' },
    },
  ]);

  const teacherOneDb = testEnv.authenticatedContext('teacher-1').firestore();

  await assertSucceeds(
    setDoc(docRef(teacherOneDb, 'teacherAssessmentTemplates/teacher-1'), {
      teacherUid: 'teacher-1',
      hiddenSelfAssessmentFieldKeys: ['attendance'],
      hiddenSupervisorCriteriaKeys: [],
      additionalSelfAssessmentFields: [],
      additionalSupervisorCriteria: [],
    }),
  );

  await assertFails(
    setDoc(docRef(teacherOneDb, 'teacherAssessmentTemplates/teacher-2'), {
      teacherUid: 'teacher-1',
      hiddenSelfAssessmentFieldKeys: [],
      hiddenSupervisorCriteriaKeys: [],
      additionalSelfAssessmentFields: [],
      additionalSupervisorCriteria: [],
    }),
  );
});

test('legacy assessments remain scoped to owning teacher and student', async () => {
  await clearFirestore();
  await seedDocuments([
    {
      path: 'users/teacher-1',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'users/teacher-2',
      data: { role: 'teacher', status: 'active' },
    },
    {
      path: 'users/student-1',
      data: { role: 'student', status: 'active', teacherUid: 'teacher-1' },
    },
    {
      path: 'users/student-2',
      data: { role: 'student', status: 'active', teacherUid: 'teacher-2' },
    },
    {
      path: 'assessments/assessment-1',
      data: {
        studentUid: 'student-1',
        teacherUid: 'teacher-1',
        timesheetId: 'sheet-1',
        submittedAt: new Date('2026-04-03T00:00:00Z'),
      },
    },
  ]);

  const teacherOneDb = testEnv.authenticatedContext('teacher-1').firestore();
  const studentOneDb = testEnv.authenticatedContext('student-1').firestore();
  const teacherTwoDb = testEnv.authenticatedContext('teacher-2').firestore();

  await assertSucceeds(
    getDocs(
      query(
        collection(teacherOneDb, 'assessments'),
        where('studentUid', '==', 'student-1'),
        where('teacherUid', '==', 'teacher-1'),
      ),
    ),
  );

  await assertSucceeds(getDoc(docRef(studentOneDb, 'assessments/assessment-1')));

  await assertFails(getDoc(docRef(teacherTwoDb, 'assessments/assessment-1')));
  await assertFails(
    setDoc(docRef(studentOneDb, 'assessments/assessment-2'), {
      studentUid: 'student-1',
      teacherUid: 'teacher-1',
      timesheetId: 'sheet-2',
      createdAt: new Date('2026-04-03T00:00:00Z'),
      status: 'completed',
    }),
  );
});