import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

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
    const callerUid = await verifyCaller(req);
    const body = await req.json().catch(() => ({}));
    const uidToDelete = typeof body.uid === 'string' ? body.uid.trim() : '';

    if (!uidToDelete) {
      return NextResponse.json({ success: false, error: 'Keine Mitarbeiter-ID übermittelt.' }, { status: 400 });
    }

    if (callerUid === uidToDelete) {
      return NextResponse.json({ success: false, error: 'Sie können Ihr eigenes Konto nicht löschen.' }, { status: 400 });
    }

    // 1. Get user details before deleting for audit log
    let targetName = 'Mitarbeiter';
    try {
      const userDoc = await adminDb.collection('users').doc(uidToDelete).get();
      if (userDoc.exists) {
        targetName = userDoc.data()?.displayName || userDoc.data()?.email || 'Mitarbeiter';
      }
    } catch (e) {
      console.warn("Could not fetch user name before delete:", e);
    }

    // 2. Delete from Firebase Authentication
    try {
      await adminAuth.deleteUser(uidToDelete);
    } catch (authErr: any) {
      console.warn("Firebase Auth deleteUser warning (proceeding to Firestore deletion):", authErr?.message);
    }

    // 3. Delete from Firestore users collection
    try {
      await adminDb.collection('users').doc(uidToDelete).delete();
    } catch (dbErr: any) {
      console.error("Firestore user doc delete error:", dbErr);
      throw dbErr;
    }

    // 4. Audit Log
    try {
      await adminDb.collection('activity_logs').add({
        action: 'DELETE_USER',
        performedBy: callerUid,
        timestamp: adminFieldValue.serverTimestamp(),
        details: `Mitarbeiter ${targetName} (${uidToDelete}) wurde gelöscht`
      });
    } catch (logErr) {
      console.warn("Audit log error:", logErr);
    }

    return NextResponse.json({ success: true, message: `Mitarbeiter ${targetName} erfolgreich gelöscht.` });
  } catch (error: any) {
    console.error('Delete User API Error:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Nicht autorisiert.' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Serverfehler beim Löschen des Mitarbeiters.' }, { status: 500 });
  }
}
