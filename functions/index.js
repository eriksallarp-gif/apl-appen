const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

async function getUserRole(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data().role : null;
}

async function assertAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const role = await getUserRole(context.auth.uid);
  if (role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
}

async function assertTeacherOrAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const role = await getUserRole(context.auth.uid);
  if (role !== 'teacher' && role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Teacher or admin only.');
  }
  return role;
}

exports.createUser = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const role = (data.role || '').toString().trim().toLowerCase();
  const email = (data.email || '').toString().trim().toLowerCase();
  const password = (data.password || '').toString();
  const firstName = (data.firstName || '').toString().trim();
  const lastName = (data.lastName || '').toString().trim();
  const school = (data.school || '').toString().trim();
  const classId = (data.classId || '').toString().trim();
  const teacherUidInput = (data.teacherUid || '').toString().trim();
  const approved = data.approved === true;

  if (!role || !email || !password || !firstName || !lastName) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
  }

  if (role !== 'student' && role !== 'teacher') {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
  }

  if (role === 'teacher' && !school) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing school.');
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const userRecord = await admin.auth().createUser({
    email,
    password,
    displayName: fullName,
  });

  let teacherUid = teacherUidInput;
  if (role === 'student' && classId && !teacherUid) {
    const classDoc = await db.collection('classes').doc(classId).get();
    if (classDoc.exists) {
      teacherUid = (classDoc.data().teacherUid || '').toString().trim();
    }
  }

  const userDoc = {
    name: fullName,
    displayName: fullName,
    firstName,
    lastName,
    email,
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (role === 'teacher') {
    userDoc.school = school;
    userDoc.approved = approved;
  }

  if (role === 'student') {
    if (classId) userDoc.classId = classId;
    if (teacherUid) userDoc.teacherUid = teacherUid;
  }

  await db.collection('users').doc(userRecord.uid).set(userDoc);

  if (role === 'student' && classId) {
    await db.collection('classes').doc(classId).collection('students').doc(userRecord.uid).set({
      name: fullName,
      email,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  if (role === 'teacher' && !approved) {
    await db.collection('adminNotifications').add({
      type: 'newTeacher',
      teacherId: userRecord.uid,
      teacherName: fullName,
      teacherEmail: email,
      school,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      resolved: false,
    });
  }

  return { uid: userRecord.uid };
});

exports.deleteUser = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const uid = (data.uid || '').toString().trim();
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing uid.');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists) {
    const userData = userSnap.data();
    const classId = (userData.classId || '').toString().trim();
    if (classId) {
      await db.collection('classes').doc(classId).collection('students').doc(uid).delete();
    }
  }

  // Ta bort elevens tidkort
  const timesheetsSnap = await db.collection('timesheets').where('studentUid', '==', uid).get();
  for (const doc of timesheetsSnap.docs) {
    await doc.ref.delete();
  }

  // Ta bort elevens bedömningar
  const assessmentsSnap = await db.collection('assessments').where('studentUid', '==', uid).get();
  for (const doc of assessmentsSnap.docs) {
    await doc.ref.delete();
  }

  // Ta bort elevens bedömningsförfrågningar
  const requestsSnap = await db.collection('assessmentRequests').where('studentUid', '==', uid).get();
  for (const doc of requestsSnap.docs) {
    await doc.ref.delete();
  }

  await admin.auth().deleteUser(uid);
  await db.collection('users').doc(uid).delete();

  return { ok: true };
});

exports.updateStudentSpecialization = functions.https.onCall(async (data, context) => {
  const role = await assertTeacherOrAdmin(context);

  const uid = (data.uid || '').toString().trim();
  const specialization = (data.specialization || '').toString().trim();

  if (!uid || !specialization) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing fields.');
  }

  if (role === 'teacher') {
    const studentSnap = await db.collection('users').doc(uid).get();
    if (!studentSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Student not found.');
    }

    const studentData = studentSnap.data();
    const classId = (studentData.classId || '').toString().trim();
    const teacherUid = (studentData.teacherUid || '').toString().trim();

    const classesSnap = await db.collection('classes').where('teacherUid', '==', context.auth.uid).get();
    const classIds = new Set(classesSnap.docs.map(doc => doc.id));

    if (teacherUid !== context.auth.uid && (!classId || !classIds.has(classId))) {
      throw new functions.https.HttpsError('permission-denied', 'Not your student.');
    }
  }

  await db.collection('users').doc(uid).set({
    specialization,
  }, { merge: true });

  return { ok: true };
});
