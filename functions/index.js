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

/**
 * Callable: deleteClass
 * Payload: { classId: string, confirm: string, hardDeleteTimesheets?: boolean }
 * - Only callable by teacher (owner) or admin.
 * - Teacher can only delete their own classes.
 * - Requires typing the class id/name/code in `confirm` which is validated server-side.
 * - Performs recursive delete of the class document (and its subcollections) using Admin SDK
 *   then updates user profiles (removes classId & teacherUid) and handles timesheets.
 * NOTE: For safety we do NOT hard-delete timesheets by default. Set `hardDeleteTimesheets: true`
 * if you really want that behavior. Default is to mark timesheets as orphaned (classId set to
 * empty string and `orphanedClass: true`).
 */
exports.deleteClass = functions.https.onCall(async (data, context) => {
  const role = await assertTeacherOrAdmin(context);

  const classId = (data.classId || '').toString().trim();
  const confirm = (data.confirm || '').toString().trim();
  const hardDeleteTimesheets = data.hardDeleteTimesheets === true;

  if (!classId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing classId');
  }

  const classRef = db.collection('classes').doc(classId);
  const classSnap = await classRef.get();
  if (!classSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Class not found');
  }

  const classData = classSnap.data() || {};
  const className = (classData.name || '').toString();
  const classCode = (classData.classCode || '').toString();
  const teacherUid = (classData.teacherUid || '').toString();

  // Confirm string must match id, code or name
  if (!confirm || (confirm !== classId && confirm !== classCode && confirm !== className)) {
    throw new functions.https.HttpsError('invalid-argument', 'Confirmation mismatch. Provide the class id, code or name to confirm deletion.');
  }

  // If caller is a teacher, verify ownership
  if (role === 'teacher' && context.auth) {
    if (teacherUid !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'You can only delete classes you own.');
    }
  }

  try {
    // 1) Update users that reference this class: remove classId and teacherUid
    const usersSnap = await db.collection('users').where('classId', '==', classId).get();
    let batch = db.batch();
    let ops = 0;
    for (const udoc of usersSnap.docs) {
      batch.update(udoc.ref, {
        classId: admin.firestore.FieldValue.delete(),
        teacherUid: admin.firestore.FieldValue.delete(),
      });
      ops++;
      if (ops >= 450) { // keep below 500
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    // 2) Handle timesheets linked to this class
    const timesheetsSnap = await db.collection('timesheets').where('classId', '==', classId).get();
    batch = db.batch();
    ops = 0;
    if (hardDeleteTimesheets) {
      // Hard delete (dangerous) - delete docs
      for (const t of timesheetsSnap.docs) {
        batch.delete(t.ref);
        ops++;
        if (ops >= 450) { await batch.commit(); batch = db.batch(); ops = 0; }
      }
      if (ops > 0) await batch.commit();
    } else {
      // Mark orphaned (safer default): remove link and set flag
      for (const t of timesheetsSnap.docs) {
        batch.update(t.ref, {
          classId: '',
          orphanedClass: true,
          classDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        ops++;
        if (ops >= 450) { await batch.commit(); batch = db.batch(); ops = 0; }
      }
      if (ops > 0) await batch.commit();
    }

    // 3) Perform recursive delete of the class document and its subcollections
    // Uses Admin SDK recursiveDelete (available in firebase-admin >= v11).
    try {
      await admin.firestore().recursiveDelete(classRef);
    } catch (e) {
      // If recursiveDelete isn't available or fails, attempt manual subcollection cleanup
      console.warn('recursiveDelete failed, attempting manual cleanup:', e);
      // Delete students and studentWeekOverrides subcollections manually
      const studentsSnap = await classRef.collection('students').get();
      for (const s of studentsSnap.docs) { await s.ref.delete(); }
      const overridesSnap = await classRef.collection('studentWeekOverrides').get();
      for (const o of overridesSnap.docs) { await o.ref.delete(); }
      // Finally delete the class doc itself
      await classRef.delete();
    }

    return { ok: true };
  } catch (e) {
    console.error('deleteClass failed', e);
    throw new functions.https.HttpsError('internal', 'Failed to delete class');
  }
});
