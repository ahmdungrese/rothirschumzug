import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// In-memory Rate-Limiting auf Server-Ebene gegen PIN-Brute-Force
const failedPinMap = new Map<string, { count: number; lockUntil: number }>();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 10 * 60 * 1000; // 10 Minuten

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ valid: false, error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Rate-Limit prüfen
    const now = Date.now();
    const record = failedPinMap.get(uid);
    if (record && record.lockUntil > now) {
      const waitSeconds = Math.ceil((record.lockUntil - now) / 1000);
      return NextResponse.json(
        {
          valid: false,
          error: `Zu viele falsche PIN-Versuche. Bitte warten Sie ${waitSeconds} Sekunden.`,
        },
        { status: 429 }
      );
    }

    // Nutzerrolle in Firestore prüfen
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (!userData || !['admin', 'office'].includes(userData.role)) {
      return NextResponse.json({ valid: false, error: 'Keine Berechtigung.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    const scope = typeof body.scope === 'string' ? body.scope : 'mitarbeiter';

    // Geheime PINs liegen ausschließlich auf dem Server (niemals im Browser-JS-Bundle!)
    const ownerMitarbeiterPin = process.env.OWNER_MITARBEITER_PIN || '0777';
    const ownerSystemPin = process.env.OWNER_SYSTEM_PIN || '7770';

    let isValid = false;
    if (scope === 'mitarbeiter') {
      isValid = pin === ownerMitarbeiterPin;
    } else if (scope === 'system') {
      isValid = pin === ownerSystemPin || pin === ownerMitarbeiterPin;
    }

    if (!isValid) {
      const nextCount = (record?.count || 0) + 1;
      const lockUntil = nextCount >= MAX_PIN_ATTEMPTS ? now + PIN_LOCKOUT_MS : 0;
      failedPinMap.set(uid, { count: nextCount, lockUntil });

      return NextResponse.json(
        {
          valid: false,
          error:
            nextCount >= MAX_PIN_ATTEMPTS
              ? 'Zu viele Fehlversuche! PIN-Eingabe für 10 Minuten gesperrt.'
              : 'Falscher Sicherheits-PIN!',
        },
        { status: 403 }
      );
    }

    // Bei Erfolg Zähler zurücksetzen
    failedPinMap.delete(uid);
    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error('PIN Verification Error:', error);
    return NextResponse.json(
      { valid: false, error: 'Fehler bei der PIN-Überprüfung.' },
      { status: 500 }
    );
  }
}
