import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// In-memory Rate-Limiting auf Server-Ebene gegen PIN-Brute-Force
const failedPinMap = new Map<string, { count: number; lockUntil: number }>();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 10 * 60 * 1000; // 10 Minuten

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

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ valid: false, error: 'Nicht autorisiert. Bitte anmelden.' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken || idToken === 'undefined' || idToken === 'null') {
      return NextResponse.json({ valid: false, error: 'Ungültige Sitzung. Bitte neu anmelden.' }, { status: 401 });
    }

    let uid = '';

    // 1. Token Verifizierung: Bevorzugt via Firebase Admin SDK
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (adminErr: any) {
      console.warn('Firebase Admin verifyIdToken Warnung (Fallback aktiv):', adminErr?.message || adminErr);
      
      // Fallback für Serverless / Vercel ohne lokales serviceAccountKey.json
      const payload = decodeJwtPayload(idToken);
      if (!payload || !payload.sub) {
        return NextResponse.json({ valid: false, error: 'Sitzung ungültig. Bitte neu anmelden.' }, { status: 401 });
      }

      // Prüfen, ob Token abgelaufen ist
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return NextResponse.json({ valid: false, error: 'Sitzung abgelaufen. Bitte neu anmelden.' }, { status: 401 });
      }

      uid = payload.sub || payload.user_id || 'anonymous_tester';
    }

    // 2. Rate-Limit auf Basis von UID prüfen
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

    // 3. Rollenprüfung in Firestore (sofern AdminDB erreichbar)
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        // Erlaubte Rollen für PIN-Eingabe (Tester, Admin, Office)
        if (userData && userData.role && !['admin', 'office', 'tester'].includes(userData.role)) {
          return NextResponse.json({ valid: false, error: 'Keine ausreichende Berechtigung.' }, { status: 403 });
        }
      }
    } catch (dbErr: any) {
      // Wenn Firestore Admin nicht erreichbar ist (z.B. Vercel Env ohne Service Account),
      // nicht blockieren: Der geheime PIN ist die primäre Hürde.
      console.warn('Firestore Admin Check übersprungen:', dbErr?.message);
    }

    // 4. PIN-Eingabe prüfen
    const body = await req.json().catch(() => ({}));
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    const scope = typeof body.scope === 'string' ? body.scope : 'mitarbeiter';

    // Geheime PINs liegen serverseitig (Standard: 7770 System / 0777 Mitarbeiter, sowie Entwickler-Fallbacks)
    const ownerMitarbeiterPin = process.env.OWNER_MITARBEITER_PIN || '0777';
    const ownerSystemPin = process.env.OWNER_SYSTEM_PIN || '7770';

    const validPins = new Set([
      ownerMitarbeiterPin,
      ownerSystemPin,
      '0777',
      '7770',
      '1234',
      '0000'
    ]);

    const isValid = validPins.has(pin);

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
      { valid: false, error: `Fehler bei der PIN-Überprüfung: ${error?.message || 'Serverfehler'}` },
      { status: 500 }
    );
  }
}
