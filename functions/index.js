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

function asNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function toSafeString(value) {
  return (value || '').toString().trim();
}

const DEFAULT_ASSESSMENT_TEMPLATES = {
  selfAssessmentFields: [
    {
      key: 'whatDidYouDo',
      label: 'Vad har du fått göra?',
      placeholder: 'Beskriv de arbetsuppgifter du utförde...',
      inputType: 'text',
    },
    {
      key: 'whatWasPositive',
      label: 'Vad har varit positivt med APLen?',
      placeholder: 'Vad har varit bra? Vad har du lärt dig?',
      inputType: 'text',
    },
    {
      key: 'whatCouldBeBetter',
      label: 'Vad skulle kunnat vara bättre?',
      placeholder: 'Vad var utmanande? Vad skulle kunna förbättras?',
      inputType: 'text',
    },
    {
      key: 'whatCouldYouDoDifferently',
      label: 'Vad kunde du som elev gjort annorlunda?',
      placeholder: 'Hur kunde du bidragit mer? Vad kan du förbättra till nästa gång?',
      inputType: 'text',
    },
    {
      key: 'overallRating',
      label: 'Vilket betyg för din APL-period? (1-10)',
      placeholder: '1=mindre bra, 10=fantastiskt',
      inputType: 'number',
    },
  ],
  supervisorCriteria: [
    { key: 'engagement', label: 'Engagemang' },
    { key: 'initiative', label: 'Initiativtagande' },
    { key: 'collaboration', label: 'Samarbetsförmåga' },
    { key: 'problemSolving', label: 'Problemlösning' },
    { key: 'workQuality', label: 'Kvalitet på arbete' },
  ],
};

function sanitizeTemplateKey(value, fallback) {
  const normalized = toSafeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function ensureUniqueTemplateKey(baseKey, usedKeys, fallback) {
  let nextKey = baseKey || fallback;
  let suffix = 2;
  while (usedKeys.has(nextKey)) {
    nextKey = `${baseKey || fallback}_${suffix}`;
    suffix += 1;
  }
  usedKeys.add(nextKey);
  return nextKey;
}

function sanitizeAssessmentTemplateSnapshot(raw) {
  const usedSelfKeys = new Set();
  const selfAssessmentFields = Array.isArray(raw && raw.selfAssessmentFields)
    ? raw.selfAssessmentFields
      .filter((field) => field && typeof field === 'object')
      .map((field) => {
        const label = toSafeString(field.label);
        if (!label) return null;
        const requestedKey = sanitizeTemplateKey(field.key, sanitizeTemplateKey(label, 'field'));
        const key = ensureUniqueTemplateKey(requestedKey, usedSelfKeys, 'field');
        return {
          key,
          label,
          placeholder: toSafeString(field.placeholder),
          inputType: toSafeString(field.inputType) === 'number' ? 'number' : 'text',
        };
      })
      .filter(Boolean)
    : [];

  const usedCriteriaKeys = new Set();
  const supervisorCriteria = Array.isArray(raw && raw.supervisorCriteria)
    ? raw.supervisorCriteria
      .filter((criterion) => criterion && typeof criterion === 'object')
      .map((criterion) => {
        const label = toSafeString(criterion.label);
        if (!label) return null;
        const requestedKey = sanitizeTemplateKey(criterion.key, sanitizeTemplateKey(label, 'criterion'));
        const key = ensureUniqueTemplateKey(requestedKey, usedCriteriaKeys, 'criterion');
        return { key, label };
      })
      .filter(Boolean)
    : [];

  return {
    selfAssessmentFields: selfAssessmentFields.length > 0
      ? selfAssessmentFields
      : DEFAULT_ASSESSMENT_TEMPLATES.selfAssessmentFields,
    supervisorCriteria: supervisorCriteria.length > 0
      ? supervisorCriteria
      : DEFAULT_ASSESSMENT_TEMPLATES.supervisorCriteria,
  };
}

exports.getSupervisorAssessmentRequest = functions.https.onCall(async (data) => {
  const requestId = toSafeString(data && data.requestId);
  const token = toSafeString(data && data.token);

  if (!requestId || !token) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId or token.');
  }

  const doc = await db.collection('assessmentRequests').doc(requestId).get();
  if (!doc.exists) {
    throw new functions.https.HttpsError('not-found', 'Bedomningsforfragan hittades inte.');
  }

  const requestData = doc.data() || {};
  if (toSafeString(requestData.token) !== token) {
    throw new functions.https.HttpsError('permission-denied', 'Ogiltig eller utgangen lank.');
  }

  if ((requestData.status || 'pending') === 'submitted') {
    throw new functions.https.HttpsError('failed-precondition', 'Denna bedomning har redan skickats in och kan inte andras.');
  }

  const expiresAt = requestData.expiresAt && requestData.expiresAt.toDate
    ? requestData.expiresAt.toDate()
    : null;
  if (expiresAt && expiresAt < new Date()) {
    throw new functions.https.HttpsError('failed-precondition', 'Denna lank har utgatt.');
  }

  const images = Array.isArray(requestData.images)
    ? requestData.images.map((img) => ({
      url: toSafeString(img && img.url),
      fileName: toSafeString(img && img.fileName),
      uploadedAt: img && img.uploadedAt ? img.uploadedAt : null,
    }))
    : [];

  const assessmentTemplateSnapshot = sanitizeAssessmentTemplateSnapshot(
    requestData.assessmentTemplateSnapshot,
  );

  return {
    request: {
      studentName: toSafeString(requestData.studentName) || 'Elev',
      weeks: Array.isArray(requestData.weeks) ? requestData.weeks : [],
      totalHours: asNonNegativeInt(requestData.totalHours),
      lunchCount: asNonNegativeInt(requestData.lunchCount),
      travelCount: asNonNegativeInt(requestData.travelCount),
      images,
      studentSelfAssessment:
        requestData.studentSelfAssessment && typeof requestData.studentSelfAssessment === 'object'
          ? requestData.studentSelfAssessment
          : {},
      assessmentTemplateSnapshot,
      linkedCompanyName: toSafeString(requestData.linkedCompanyName),
      studentCompanyName: toSafeString(requestData.studentCompanyName),
    },
  };
});

exports.submitSupervisorAssessment = functions.https.onCall(async (data) => {
  const requestId = toSafeString(data && data.requestId);
  const token = toSafeString(data && data.token);

  if (!requestId || !token) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId or token.');
  }

  const supervisorCompany = toSafeString(data && data.supervisorCompany);
  const supervisorName = toSafeString(data && data.supervisorName);
  const supervisorPhone = toSafeString(data && data.supervisorPhone);
  const supervisorOtherInfo = toSafeString(data && data.supervisorOtherInfo);
  if (!supervisorCompany || !supervisorName || !supervisorPhone) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required supervisor fields.');
  }

  const lunchApproved = asNonNegativeInt(data && data.lunchApproved);
  const travelApproved = asNonNegativeInt(data && data.travelApproved);
  const assessmentData = data && typeof data.assessmentData === 'object' && data.assessmentData !== null
    ? data.assessmentData
    : {};
  const imageComments = data && typeof data.imageComments === 'object' && data.imageComments !== null
    ? data.imageComments
    : {};
  const averageRating = toSafeString(data && data.averageRating);

  await db.runTransaction(async (tx) => {
    const ref = db.collection('assessmentRequests').doc(requestId);
    const snap = await tx.get(ref);

    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Bedomningsforfragan hittades inte.');
    }

    const requestData = snap.data() || {};
    if (toSafeString(requestData.token) !== token) {
      throw new functions.https.HttpsError('permission-denied', 'Ogiltig eller utgangen lank.');
    }

    if ((requestData.status || 'pending') === 'submitted') {
      throw new functions.https.HttpsError('failed-precondition', 'Denna bedomning har redan skickats in och kan inte andras.');
    }

    const expiresAt = requestData.expiresAt && requestData.expiresAt.toDate
      ? requestData.expiresAt.toDate()
      : null;
    if (expiresAt && expiresAt < new Date()) {
      throw new functions.https.HttpsError('failed-precondition', 'Denna lank har utgatt.');
    }

    tx.update(ref, {
      status: 'submitted',
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      supervisorCompany,
      supervisorName,
      supervisorPhone,
      supervisorOtherInfo,
      lunchApproved,
      travelApproved,
      assessmentData,
      imageComments,
      averageRating,
    });

    // Behall befintligt beteende fran web-flow: godkann och las kopplade tidkort.
    const timesheetIds = Array.isArray(requestData.timesheetIds)
      ? requestData.timesheetIds.map((id) => toSafeString(id)).filter(Boolean)
      : [];

    for (const timesheetId of timesheetIds) {
      const timesheetRef = db.collection('timesheets').doc(timesheetId);
      tx.set(timesheetRef, {
        approved: true,
        locked: true,
      }, { merge: true });
    }
  });

  return { ok: true };
});

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

  let teacherSchool = '';
  if (role === 'student' && teacherUid) {
    const teacherDoc = await db.collection('users').doc(teacherUid).get();
    if (teacherDoc.exists) {
      teacherSchool = (teacherDoc.data().school || '').toString().trim();
    }
  }

  const userDoc = {
    name: fullName,
    displayName: fullName,
    firstName,
    lastName,
    email,
    role,
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (role === 'teacher') {
    userDoc.school = school;
    userDoc.approved = approved;
  }

  if (role === 'student') {
    if (classId) userDoc.classId = classId;
    if (teacherUid) {
      userDoc.teacherUid = teacherUid;
      userDoc.teacherId = teacherUid;
    }
    if (teacherSchool) {
      userDoc.school = teacherSchool;
    }
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

exports.setUserStatus = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const uid = (data.uid || '').toString().trim();
  const status = (data.status || '').toString().trim().toLowerCase();

  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing uid.');
  }

  if (status !== 'active' && status !== 'frozen') {
    throw new functions.https.HttpsError('invalid-argument', "Status must be 'active' or 'frozen'.");
  }

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found.');
  }

  await db.collection('users').doc(uid).update({
    status,
    statusChangedAt: admin.firestore.FieldValue.serverTimestamp(),
    statusChangedBy: context.auth.uid,
  });

  return { ok: true, uid, status };
});

// ---------------------------------------------------------------------------
// Account deletion (GDPR Article 17 – Right to erasure)
// ---------------------------------------------------------------------------

/**
 * requestAccountDeletion — callable by authenticated student.
 * Marks the user document for deletion after a 30-day grace period.
 * The student can cancel within those 30 days via cancelAccountDeletion.
 */
exports.requestAccountDeletion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const uid = context.auth.uid;

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found.');
  }
  const role = (userSnap.data().role || '').toString().trim();
  if (role !== 'student') {
    throw new functions.https.HttpsError('permission-denied', 'Only students can request self-deletion.');
  }

  await db.collection('users').doc(uid).set({
    deletionRequested: true,
    deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

/**
 * cancelAccountDeletion — callable by authenticated student.
 * Removes the deletion flag so the account is no longer scheduled for deletion.
 */
exports.cancelAccountDeletion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const uid = context.auth.uid;

  await db.collection('users').doc(uid).update({
    deletionRequested: admin.firestore.FieldValue.delete(),
    deletionRequestedAt: admin.firestore.FieldValue.delete(),
  });

  return { ok: true };
});

/**
 * processScheduledDeletions — runs every 24 hours.
 * Anonymizes and permanently deletes accounts where the 30-day grace period has passed.
 */
exports.processScheduledDeletions = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoff);

    const snap = await db.collection('users')
      .where('deletionRequested', '==', true)
      .where('deletionRequestedAt', '<=', cutoffTimestamp)
      .get();

    for (const userDoc of snap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data() || {};

      try {
        // 1. Anonymize related documents (keep records for school archives).
        const batch = db.batch();

        const timesheetsSnap = await db.collection('timesheets')
          .where('studentUid', '==', uid).get();
        for (const ts of timesheetsSnap.docs) {
          batch.update(ts.ref, { studentName: '[Raderad]' });
        }

        const requestsSnap = await db.collection('assessmentRequests')
          .where('studentUid', '==', uid).get();
        for (const req of requestsSnap.docs) {
          batch.update(req.ref, { studentName: '[Raderad]' });
        }

        const compSnap = await db.collection('compensation')
          .where('studentUid', '==', uid).get();
        for (const comp of compSnap.docs) {
          batch.update(comp.ref, { studentName: '[Raderad]' });
        }

        await batch.commit();

        // 2. Remove from class subcollection.
        const classId = (userData.classId || '').toString().trim();
        if (classId) {
          await db.collection('classes').doc(classId).collection('students').doc(uid).delete();
        }

        // 3. Delete user document.
        await db.collection('users').doc(uid).delete();

        // 4. Delete Firebase Auth account.
        await admin.auth().deleteUser(uid);

        console.log(`[processScheduledDeletions] Account ${uid} deleted.`);
      } catch (err) {
        console.error(`[processScheduledDeletions] Failed for ${uid}:`, err);
      }
    }

    return null;
  });
