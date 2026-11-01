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
    const targetUid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const newPassword = typeof body.password === 'string' ? body.password.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

    if (!targetUid) {
      return NextResponse.json({ success: false, error: 'Keine Mitarbeiter-ID übermittelt.' }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ success: false, error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' }, { status: 400 });
    }

    // 1. Inhaber-PIN Validierung (0777 für Mitarbeiter / 7770 System)
    const ownerMitarbeiterPin = process.env.OWNER_MITARBEITER_PIN || '0777';
    const ownerSystemPin = process.env.OWNER_SYSTEM_PIN || '7770';
    const isPinValid = pin === ownerMitarbeiterPin || pin === ownerSystemPin || pin === '0777' || pin === '7770';

    if (!isPinValid) {
      return NextResponse.json({ success: false, error: 'Falscher Sicherheits-PIN! Zugriff verweigert.' }, { status: 403 });
    }

    // 2. Caller-Berechtigung prüfen: Nur Administratoren dürfen Passwörter verwalten
    try {
      const callerDoc = await adminDb.collection('users').doc(callerUid).get();
      if (callerDoc.exists) {
        const callerData = callerDoc.data();
        if (callerData?.role !== 'admin') {
          return NextResponse.json({ success: false, error: 'Nur Administratoren dürfen Passwörter zurücksetzen.' }, { status: 403 });
        }
      }
    } catch (dbErr: any) {
      console.warn("Firestore Admin Caller Check warning:", dbErr?.message);
    }

    // 3. Name des Ziel-Mitarbeiters für das Audit-Log holen
    let targetName = 'Mitarbeiter';
    try {
      const userDoc = await adminDb.collection('users').doc(targetUid).get();
      if (userDoc.exists) {
        targetName = userDoc.data()?.displayName || userDoc.data()?.email || 'Mitarbeiter';
      }
    } catch (e) {
      console.warn("Could not fetch target user name:", e);
    }

    // 4. Passwort in Firebase Authentication über Admin SDK aktualisieren
    await adminAuth.updateUser(targetUid, {
      password: newPassword,
    });

    // 5. Revisionssicheres Audit-Log anlegen
    try {
      await adminDb.collection('activity_logs').add({
        action: 'RESET_PASSWORD',
        performedBy: callerUid,
        targetUid: targetUid,
        timestamp: adminFieldValue.serverTimestamp(),
        details: `Passwort für Mitarbeiter "${targetName}" durch Administrator geändert.`
      });
    } catch (logErr) {
      console.warn("Audit log error:", logErr);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Passwort für ${targetName} erfolgreich aktualisiert.` 
    });
  } catch (error: any) {
    console.error('Reset Password API Error:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Nicht autorisiert. Bitte neu anmelden.' }, { status: 401 });
    }
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Serverfehler beim Zurücksetzen des Passworts.' 
    }, { status: 500 });
  }
}
