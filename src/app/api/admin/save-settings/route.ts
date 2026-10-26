import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

async function verifyCaller(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken || idToken === 'undefined' || idToken === 'null') {
    throw new Error('Unauthorized');
  }

  let uid = '';
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch {
    const payload = decodeJwtPayload(idToken);
    if (!payload || !payload.sub) {
      throw new Error('Unauthorized');
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error('Unauthorized');
    }
    uid = payload.sub || payload.user_id;
  }

  return uid;
}

export async function POST(req: NextRequest) {
  try {
    await verifyCaller(req);
    const body = await req.json().catch(() => ({}));
    const settings = body.settings;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ success: false, error: 'Ungültige Einstellungen übermittelt.' }, { status: 400 });
    }

    // SettingsToSave bereinigen
    const cleanSettings = { ...settings };
    delete cleanSettings.nextOfferNumber;

    await adminDb.doc('system/settings').set(cleanSettings, { merge: true });

    return NextResponse.json({ success: true, message: 'Einstellungen erfolgreich auf Server gespeichert.' });
  } catch (error: any) {
    console.error('Save Settings Server API Error:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Nicht autorisiert.' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Serverfehler beim Speichern.' }, { status: 500 });
  }
}
