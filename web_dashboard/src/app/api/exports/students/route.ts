import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import {
  collectStudentExportDataset,
  type ExportRequestPayload,
  type ExportRole,
} from '@/server/exports/studentExportData';
import { createStudentExportWorkbook } from '@/server/exports/studentExportWorkbook';

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim();
}

async function resolveRequesterRole(uid: string): Promise<ExportRole | null> {
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return null;
  }

  const role = String(userDoc.data()?.role || '').toLowerCase();
  if (role === 'teacher' || role === 'admin') {
    return role;
  }

  return null;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 90);
}

function isMissingAdminCredentialsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('Could not load the default credentials') ||
    message.includes('Failed to determine service account') ||
    message.includes('credential implementation provided to initializeApp()')
  );
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Saknar giltig autentiseringstoken.' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const role = await resolveRequesterRole(decodedToken.uid);
    if (!role) {
      return NextResponse.json({ error: 'Endast larare eller admin kan exportera elevdata.' }, { status: 403 });
    }

    const payload = (await request.json()) as ExportRequestPayload;
    const dataset = await collectStudentExportDataset(
      {
        uid: decodedToken.uid,
        role,
      },
      payload,
    );

    const workbookBuffer = await createStudentExportWorkbook(dataset);
    const filename = sanitizeFileName(`apl_elevexport_${new Date().toISOString().slice(0, 10)}.xlsx`);

    const responseBody = new Uint8Array(workbookBuffer);

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Student export failed:', error);

    if (isMissingAdminCredentialsError(error)) {
      return NextResponse.json(
        {
          error:
            'Exporten ar aktiverad, men servercredentials for Firebase Admin saknas lokalt. Losning: 1) satt FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL och FIREBASE_PRIVATE_KEY i web_dashboard/.env.local, eller 2) konfigurera Application Default Credentials med gcloud auth application-default login och starta om dev-servern.',
        },
        { status: 500 },
      );
    }

    const message = error instanceof Error ? error.message : 'Okant fel vid export.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
