const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();

const db = admin.firestore();

// Gmail SMTP transporter for sending notification emails
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().gmail?.email || 'support@aplappen.com',
    pass: functions.config().gmail?.password || ''
  }
});

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

function timestampToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function normalizePhoneNumber(value) {
  const raw = toSafeString(value).replace(/[\s()-]/g, '');
  if (!raw) return '';

  let normalized = raw;
  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  } else if (normalized.startsWith('0')) {
    normalized = `+46${normalized.slice(1)}`;
  } else if (normalized.startsWith('46')) {
    normalized = `+${normalized}`;
  }

  if (!normalized.startsWith('+')) {
    normalized = `+${normalized}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return '';
  }

  return normalized;
}

function maskPhoneNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized || normalized.length < 6) return 'okant nummer';
  const suffix = normalized.slice(-2);
  return `${normalized.slice(0, 4)}******${suffix}`;
}

function hashOtpCode(code) {
  const pepper = toSafeString(functions.config().otp?.pepper) || 'apl-otp-default-pepper-change-me';
  return crypto
    .createHash('sha256')
    .update(`${code}:${pepper}`)
    .digest('hex');
}

function generateOtpCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function buildOtpMessage(code) {
  return `Din verifieringskod for APL-appen ar: ${code}. Koden ar giltig i 5 minuter.`;
}

async function sendOtpViaTwilio(phoneNumber, message) {
  const accountSid = toSafeString(functions.config().twilio?.account_sid);
  const authToken = toSafeString(functions.config().twilio?.auth_token);
  const fromNumber = toSafeString(functions.config().twilio?.from_number);

  if (!accountSid || !authToken || !fromNumber) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Twilio-konfiguration saknas (twilio.account_sid, twilio.auth_token, twilio.from_number).',
    );
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const body = new URLSearchParams({
    To: phoneNumber,
    From: fromNumber,
    Body: message,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    console.error('Twilio send failed:', response.status, responseText);
    throw new functions.https.HttpsError('internal', 'Kunde inte skicka SMS-kod just nu. Forsok igen om en stund.');
  }
}

async function sendOtpVia46Elks(phoneNumber, message) {
  const username = toSafeString(functions.config().elks46?.username);
  const password = toSafeString(functions.config().elks46?.password);
  const fromNumber = toSafeString(functions.config().elks46?.from_number);

  if (!username || !password || !fromNumber) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      '46elks-konfiguration saknas (elks46.username, elks46.password, elks46.from_number).',
    );
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const body = new URLSearchParams({
    from: fromNumber,
    to: phoneNumber,
    message,
  });

  const response = await fetch('https://api.46elks.com/a1/sms', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error('46elks send failed:', response.status, responseText);
    throw new functions.https.HttpsError('internal', 'Kunde inte skicka SMS-kod just nu. Forsok igen om en stund.');
  }
}

async function sendOtpViaSinch(phoneNumber, message) {
  const servicePlanId = toSafeString(functions.config().sinch?.service_plan_id);
  const apiToken = toSafeString(functions.config().sinch?.api_token);
  const fromNumber = toSafeString(functions.config().sinch?.from_number);
  const baseUrl = toSafeString(functions.config().sinch?.base_url) || 'https://us.sms.api.sinch.com';

  if (!servicePlanId || !apiToken || !fromNumber) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Sinch-konfiguration saknas (sinch.service_plan_id, sinch.api_token, sinch.from_number).',
    );
  }

  const response = await fetch(`${baseUrl}/xms/v1/${servicePlanId}/batches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromNumber,
      to: [phoneNumber],
      body: message,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error('Sinch send failed:', response.status, responseText);
    throw new functions.https.HttpsError('internal', 'Kunde inte skicka SMS-kod just nu. Forsok igen om en stund.');
  }
}

async function sendOtpSms(phoneNumber, code) {
  const provider = toSafeString(functions.config().sms?.provider).toLowerCase() || 'twilio';
  const message = buildOtpMessage(code);

  if (provider === 'twilio') {
    await sendOtpViaTwilio(phoneNumber, message);
    return;
  }

  if (provider === '46elks' || provider === 'elks' || provider === '46') {
    await sendOtpVia46Elks(phoneNumber, message);
    return;
  }

  if (provider === 'sinch') {
    await sendOtpViaSinch(phoneNumber, message);
    return;
  }

  throw new functions.https.HttpsError(
    'failed-precondition',
    'Okand SMS-provider. Ange sms.provider som twilio, 46elks eller sinch.',
  );
}

function sanitizeVerificationDraftPayload(data) {
  const supervisorCompany = toSafeString(data && data.supervisorCompany);
  const supervisorName = toSafeString(data && data.supervisorName);
  const supervisorPhone = normalizePhoneNumber(data && data.supervisorPhone);
  const supervisorOtherInfo = toSafeString(data && data.supervisorOtherInfo);
  const lunchApproved = asNonNegativeInt(data && data.lunchApproved);
  const travelApproved = asNonNegativeInt(data && data.travelApproved);
  const assessmentData = data && typeof data.assessmentData === 'object' && data.assessmentData !== null
    ? data.assessmentData
    : {};
  const imageComments = data && typeof data.imageComments === 'object' && data.imageComments !== null
    ? data.imageComments
    : {};
  const averageRating = toSafeString(data && data.averageRating);

  if (!supervisorCompany || !supervisorName || !supervisorPhone) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required supervisor fields.');
  }

  return {
    supervisorCompany,
    supervisorName,
    supervisorPhone,
    supervisorOtherInfo,
    lunchApproved,
    travelApproved,
    assessmentData,
    imageComments,
    averageRating,
  };
}

const DEFAULT_ASSESSMENT_TEMPLATES = {
  selfAssessmentFields: [
    {
      key: 'whatDidYouDo',
      label: 'Vad har du f├Ñtt g├Âra?',
      placeholder: 'Beskriv de arbetsuppgifter du utf├Ârde...',
      inputType: 'text',
    },
    {
      key: 'whatWasPositive',
      label: 'Vad har varit positivt med APLen?',
      placeholder: 'Vad har varit bra? Vad har du l├ñrt dig?',
      inputType: 'text',
    },
    {
      key: 'whatCouldBeBetter',
      label: 'Vad skulle kunnat vara b├ñttre?',
      placeholder: 'Vad var utmanande? Vad skulle kunna f├Ârb├ñttras?',
      inputType: 'text',
    },
    {
      key: 'whatCouldYouDoDifferently',
      label: 'Vad kunde du som elev gjort annorlunda?',
      placeholder: 'Hur kunde du bidragit mer? Vad kan du f├Ârb├ñttra till n├ñsta g├Ñng?',
      inputType: 'text',
    },
    {
      key: 'overallRating',
      label: 'Vilket betyg f├Âr din APL-period? (1-10)',
      placeholder: '1=mindre bra, 10=fantastiskt',
      inputType: 'number',
    },
  ],
  supervisorCriteria: [
    { key: 'engagement', label: 'Engagemang' },
    { key: 'initiative', label: 'Initiativtagande' },
    { key: 'collaboration', label: 'Samarbetsf├Ârm├Ñga' },
    { key: 'problemSolving', label: 'Probleml├Âsning' },
    { key: 'workQuality', label: 'Kvalitet p├Ñ arbete' },
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

function sanitizeTimesheetSummaries(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const activities = Array.isArray(item.activities)
        ? item.activities
            .filter((activity) => activity && typeof activity === 'object')
            .map((activity) => ({
              name: toSafeString(activity.name),
              hours: asNonNegativeInt(activity.hours),
            }))
            .filter((activity) => activity.name && activity.hours > 0)
        : [];

      return {
        timesheetId: toSafeString(item.timesheetId),
        weekLabel: toSafeString(item.weekLabel),
        totalHours: asNonNegativeInt(item.totalHours),
        activities,
      };
    })
    .filter((summary) => summary.activities.length > 0);
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

  if ((requestData.status || 'pending') === 'pending_verification') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Bedomningen vantar pa SMS-verifiering och kan inte andras.',
    );
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
  const timesheetSummaries = sanitizeTimesheetSummaries(
    requestData.timesheetSummaries,
  );

  return {
    request: {
      studentName: toSafeString(requestData.studentName) || 'Elev',
      weeks: Array.isArray(requestData.weeks) ? requestData.weeks : [],
      totalHours: asNonNegativeInt(requestData.totalHours),
      lunchCount: asNonNegativeInt(requestData.lunchCount),
      travelCount: asNonNegativeInt(requestData.travelCount),
      images,
      timesheetSummaries,
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

exports.startSupervisorAssessmentVerification = functions.https.onCall(async (data) => {
  const requestId = toSafeString(data && data.requestId);
  const token = toSafeString(data && data.token);
  if (!requestId || !token) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId or token.');
  }

  const draftPayload = sanitizeVerificationDraftPayload(data);
  const now = new Date();
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const otpExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const phoneMasked = maskPhoneNumber(draftPayload.supervisorPhone);

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

    const currentStatus = toSafeString(requestData.status) || 'pending';
    if (currentStatus === 'submitted') {
      throw new functions.https.HttpsError('failed-precondition', 'Denna bedomning har redan skickats in.');
    }
    if (currentStatus === 'pending_verification') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'SMS-verifiering pagar redan. Avbryt verifieringen forst om du vill byta nummer.',
      );
    }

    const expiresAt = timestampToDate(requestData.expiresAt);
    if (expiresAt && expiresAt < now) {
      throw new functions.https.HttpsError('failed-precondition', 'Denna lank har utgatt.');
    }

    tx.update(ref, {
      status: 'pending_verification',
      pendingVerification: {
        lockedPhone: draftPayload.supervisorPhone,
        phoneMasked,
        draft: draftPayload,
        otpCodeHash: codeHash,
        otpExpiresAt: admin.firestore.Timestamp.fromDate(otpExpiresAt),
        otpAttemptsLeft: 5,
        otpResendCount: 1,
        otpResendWindowStart: admin.firestore.Timestamp.fromDate(now),
        lastOtpSentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await sendOtpSms(draftPayload.supervisorPhone, code);

  return {
    ok: true,
    requestId,
    phoneMasked,
    expiresInSeconds: 300,
  };
});

exports.getSupervisorVerificationState = functions.https.onCall(async (data) => {
  const requestId = toSafeString(data && data.requestId);
  const token = toSafeString(data && data.token);
  if (!requestId || !token) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId or token.');
  }

  const ref = db.collection('assessmentRequests').doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Bedomningsforfragan hittades inte.');
  }

  const requestData = snap.data() || {};
  if (toSafeString(requestData.token) !== token) {
    throw new functions.https.HttpsError('permission-denied', 'Ogiltig eller utgangen lank.');
  }

  const currentStatus = toSafeString(requestData.status) || 'pending';
  if (currentStatus !== 'pending_verification') {
    throw new functions.https.HttpsError('failed-precondition', 'Ingen aktiv SMS-verifiering hittades.');
  }

  const pendingVerification = requestData.pendingVerification || {};
  const otpExpiresAt = timestampToDate(pendingVerification.otpExpiresAt);

  return {
    ok: true,
    status: currentStatus,
    phoneMasked: toSafeString(pendingVerification.phoneMasked),
    otpAttemptsLeft: asNonNegativeInt(pendingVerification.otpAttemptsLeft),
    otpResendCount: asNonNegativeInt(pendingVerification.otpResendCount),
    otpExpiresAtMillis: otpExpiresAt ? otpExpiresAt.getTime() : null,
  };
});

exports.resendSupervisorAssessmentOtp = functions.https.onCall(async (data) => {
  const requestId = toSafeString(data && data.requestId);
  const token = toSafeString(data && data.token);
  if (!requestId || !token) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId or token.');
  }

  const now = new Date();
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const otpExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  let lockedPhone = '';
  let phoneMasked = '';

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

    const currentStatus = toSafeString(requestData.status) || 'pending';
    if (currentStatus !== 'pending_verification') {
      throw new functions.https.HttpsError('failed-precondition', 'Ingen aktiv SMS-verifiering hittades.');
    }

    const pendingVerification = requestData.pendingVerification || {};
    lockedPhone = toSafeString(pendingVerification.lockedPhone);
    phoneMasked = toSafeString(pendingVerification.phoneMasked);
    if (!lockedPhone) {
      throw new functions.https.HttpsError('failed-precondition', 'Saknar last nummer for verifiering.');
    }

    const windowStartDate = timestampToDate(pendingVerification.otpResendWindowStart);
    let resendWindowStart = windowStartDate || now;
    let resendCount = asNonNegativeInt(pendingVerification.otpResendCount);

    if ((now.getTime() - resendWindowStart.getTime()) > (15 * 60 * 1000)) {
      resendWindowStart = now;
      resendCount = 0;
    }

    if (resendCount >= 3) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'For manga SMS-utskick. Forsok igen om 15 minuter.',
      );
    }

    tx.update(ref, {
      pendingVerification: {
        ...pendingVerification,
        otpCodeHash: codeHash,
        otpExpiresAt: admin.firestore.Timestamp.fromDate(otpExpiresAt),
        otpAttemptsLeft: 5,
        otpResendCount: resendCount + 1,
        otpResendWindowStart: admin.firestore.Timestamp.fromDate(resendWindowStart),
        lastOtpSentAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await sendOtpSms(lockedPhone, code);

  return {
    ok: true,
    requestId,
    phoneMasked,
    expiresInSeconds: 300,
  };
});

exports.cancelSupervisorAssessmentVerification = functions.https.onCall(async (data) => {
  const requestId = toSafeString(data && data.requestId);
  const token = toSafeString(data && data.token);
  if (!requestId || !token) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId or token.');
  }

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

    const currentStatus = toSafeString(requestData.status) || 'pending';
    if (currentStatus !== 'pending_verification') {
      return;
    }

    tx.update(ref, {
      status: 'pending',
      pendingVerification: admin.firestore.FieldValue.delete(),
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

exports.verifySupervisorAssessmentOtp = functions.https.onCall(async (data) => {
  const requestId = toSafeString(data && data.requestId);
  const token = toSafeString(data && data.token);
  const code = toSafeString(data && data.code).replace(/\D/g, '');

  if (!requestId || !token || !code) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId, token or code.');
  }

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

    const currentStatus = toSafeString(requestData.status) || 'pending';
    if (currentStatus !== 'pending_verification') {
      throw new functions.https.HttpsError('failed-precondition', 'Ingen aktiv SMS-verifiering hittades.');
    }

    const pendingVerification = requestData.pendingVerification || {};
    const draft = pendingVerification.draft || {};
    const lockedPhone = toSafeString(pendingVerification.lockedPhone);
    const otpCodeHash = toSafeString(pendingVerification.otpCodeHash);
    const otpAttemptsLeft = asNonNegativeInt(pendingVerification.otpAttemptsLeft);
    const otpExpiresAt = timestampToDate(pendingVerification.otpExpiresAt);
    const now = new Date();

    if (!lockedPhone || !otpCodeHash || !draft || typeof draft !== 'object') {
      throw new functions.https.HttpsError('failed-precondition', 'Verifieringssessionen ar ogiltig.');
    }

    if (!otpExpiresAt || otpExpiresAt < now) {
      throw new functions.https.HttpsError('deadline-exceeded', 'SMS-koden har gatt ut. Begar en ny kod.');
    }

    if (otpAttemptsLeft <= 0) {
      throw new functions.https.HttpsError('resource-exhausted', 'For manga felaktiga forsok. Begar en ny kod.');
    }

    const hashedInputCode = hashOtpCode(code);
    if (hashedInputCode !== otpCodeHash) {
      tx.update(ref, {
        'pendingVerification.otpAttemptsLeft': Math.max(0, otpAttemptsLeft - 1),
      });
      throw new functions.https.HttpsError('permission-denied', 'Fel kod. Forsok igen.');
    }

    tx.update(ref, {
      status: 'submitted',
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      supervisorCompany: toSafeString(draft.supervisorCompany),
      supervisorName: toSafeString(draft.supervisorName),
      supervisorPhone: lockedPhone,
      supervisorOtherInfo: toSafeString(draft.supervisorOtherInfo),
      lunchApproved: asNonNegativeInt(draft.lunchApproved),
      travelApproved: asNonNegativeInt(draft.travelApproved),
      assessmentData:
        draft.assessmentData && typeof draft.assessmentData === 'object'
          ? draft.assessmentData
          : {},
      imageComments:
        draft.imageComments && typeof draft.imageComments === 'object'
          ? draft.imageComments
          : {},
      averageRating: toSafeString(draft.averageRating),
      smsVerification: {
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verifiedPhone: lockedPhone,
      },
      pendingVerification: admin.firestore.FieldValue.delete(),
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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

exports.submitSupervisorAssessment = functions.https.onCall(async () => {
  throw new functions.https.HttpsError(
    'failed-precondition',
    'Direkt inskickning är avstängd. Använd SMS-verifieringsflödet.',
  );
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

  // Ta bort elevens bed├Âmningar
  const assessmentsSnap = await db.collection('assessments').where('studentUid', '==', uid).get();
  for (const doc of assessmentsSnap.docs) {
    await doc.ref.delete();
  }

  // Ta bort elevens bed├Âmningsf├Ârfr├Ñgningar
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
// Account deletion (GDPR Article 17 ÔÇô Right to erasure)
// ---------------------------------------------------------------------------

/**
 * requestAccountDeletion ÔÇö callable by authenticated student.
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
 * cancelAccountDeletion ÔÇö callable by authenticated student.
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
 * processScheduledDeletions ÔÇö runs every 24 hours.
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

/**
 * Send notification email when a new teacher registers and needs approval.
 * Triggers when a new user document is created in Firestore.
 */
exports.onNewTeacherCreated = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data();
    const userId = context.params.userId;
    
    // Only send email for new teachers waiting for approval
    if (userData.role !== 'teacher' || userData.approved === true) {
      return null;
    }

    const mailOptions = {
      from: '"APL-appen" <support@aplappen.com>',
      to: 'support@aplappen.com',
      subject: `Ny l├ñrare v├ñntar p├Ñ godk├ñnnande: ${userData.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff7a00;">Ny l├ñrare har registrerat sig</h2>
          <p>En ny l├ñrare har skapat ett konto och v├ñntar p├Ñ godk├ñnnande.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Namn:</strong> ${userData.name}</p>
            <p><strong>E-post:</strong> ${userData.email}</p>
            <p><strong>Skola:</strong> ${userData.school}</p>
            <p><strong>Registrerad:</strong> ${new Date().toLocaleString('sv-SE')}</p>
          </div>
          
          <p><strong>N├ñsta steg:</strong></p>
          <ol>
            <li>Logga in p├Ñ admin-panelen p├Ñ <a href="https://www.apl-appen.com/dashboard/admin" style="color: #ff7a00;">www.apl-appen.com/dashboard/admin</a></li>
            <li>Verifiera l├ñrarens uppgifter</li>
            <li>Godk├ñnn l├ñraren f├Âr att ge ├Ñtkomst till systemet</li>
          </ol>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            Detta ├ñr ett automatiskt meddelande fr├Ñn APL-appen.
          </p>
        </div>
      `
    };

    try {
      await gmailTransporter.sendMail(mailOptions);
      console.log(`Notification email sent for new teacher: ${userData.email}`);
      return null;
    } catch (error) {
      console.error('Error sending notification email:', error);
      return null;
    }
  });
