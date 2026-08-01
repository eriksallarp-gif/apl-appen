import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getPrivateKey(): string | undefined {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) {
    return undefined;
  }

  return privateKey.replace(/\\n/g, '\n');
}

function ensureFirebaseAdminInitialized() {
  if (getApps().length > 0) {
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
    return;
  }

  // Fallback for Cloud Run/GCP environments with Application Default Credentials.
  initializeApp({
    credential: applicationDefault(),
    projectId: projectId || undefined,
  });
}

ensureFirebaseAdminInitialized();

export const adminAuth = getAuth();
export const adminDb = getFirestore();
