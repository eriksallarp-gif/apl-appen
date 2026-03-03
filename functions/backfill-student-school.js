const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function initializeAdmin() {
  const credPathArg = process.argv.find((arg) => arg.startsWith('--cred='));
  const credPathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credPath = credPathArg
    ? credPathArg.replace('--cred=', '').trim()
    : (credPathEnv || '').trim();

  if (credPath) {
    const resolvedPath = path.resolve(credPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Credential file not found: ${resolvedPath}`);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  admin.initializeApp();
}

initializeAdmin();
const db = admin.firestore();

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  const usersSnap = await db.collection('users').where('role', '==', 'student').get();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let missingTeacher = 0;
  let missingTeacherSchool = 0;

  let batch = db.batch();
  let batchOps = 0;

  for (const doc of usersSnap.docs) {
    scanned++;
    const data = doc.data() || {};

    const school = (data.school || '').toString().trim();
    const schoolId = (data.schoolId || '').toString().trim();
    const teacherId = (data.teacherId || '').toString().trim();
    const teacherUid = (data.teacherUid || '').toString().trim();

    const resolvedSchool = school || schoolId;
    const resolvedTeacher = teacherId || teacherUid;

    if (resolvedSchool && teacherId) {
      skipped++;
      continue;
    }

    if (!resolvedTeacher) {
      missingTeacher++;
      skipped++;
      continue;
    }

    const teacherSnap = await db.collection('users').doc(resolvedTeacher).get();
    const teacherData = teacherSnap.exists ? teacherSnap.data() || {} : {};
    const teacherSchool = (teacherData.school || '').toString().trim();

    if (!teacherSchool && !resolvedSchool) {
      missingTeacherSchool++;
      skipped++;
      continue;
    }

    const updateData = {};

    if (!school && !schoolId && teacherSchool) {
      updateData.school = teacherSchool;
    } else if (!school && schoolId) {
      updateData.school = schoolId;
    }

    if (!teacherId && teacherUid) {
      updateData.teacherId = teacherUid;
    }

    if (Object.keys(updateData).length === 0) {
      skipped++;
      continue;
    }

    if (!dryRun) {
      batch.set(doc.ref, updateData, { merge: true });
      batchOps++;
      if (batchOps >= 450) {
        await batch.commit();
        batch = db.batch();
        batchOps = 0;
      }
    }

    updated++;
  }

  if (!dryRun && batchOps > 0) {
    await batch.commit();
  }

  console.log('Backfill student school summary:');
  console.log(`- dryRun: ${dryRun}`);
  console.log(`- scanned: ${scanned}`);
  console.log(`- updated: ${updated}`);
  console.log(`- skipped: ${skipped}`);
  console.log(`- missingTeacher: ${missingTeacher}`);
  console.log(`- missingTeacherSchool: ${missingTeacherSchool}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
