import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import path from 'path';
import fs from 'fs';

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApp();
  }

  // Für lokale Entwicklung: Versuch, serviceAccountKey.json zu laden
  const keyFileName = 'serviceAccountKey.json';
  const localKeyPath = path.join(process.cwd(), keyFileName);
  
  // Hack to prevent Turbopack from statically tracing fs.readFileSync and throwing "Module not found"
  const fsRef: any = fs;
  const readSync = fsRef.readFileSync;
  const existsSync = fsRef.existsSync;
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Wenn die Keys als Env-Variable (JSON string) in Vercel hinterlegt sind
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(serviceAccount);
    } catch (e) {
      console.error("Fehler beim Parsen der FIREBASE_SERVICE_ACCOUNT_KEY env variable.", e);
    }
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    // Alternativ: Einzelne Env-Variablen
    credential = cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else if (existsSync(localKeyPath)) {
    // Fallback für lokale Entwicklung
    const serviceAccount = JSON.parse(readSync(localKeyPath, 'utf8'));
    credential = cert(serviceAccount);
  } else {
    throw new Error("Konnte Firebase Admin SDK nicht initialisieren: Keine Credentials gefunden.");
  }

  // projectId aus credential extrahieren oder env nutzen
  let projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId && existsSync(localKeyPath)) {
    const serviceAccount = JSON.parse(readSync(localKeyPath, 'utf8'));
    projectId = serviceAccount.project_id;
  }

  return initializeApp({
    credential,
    storageBucket: projectId ? `${projectId}.appspot.com` : undefined,
  });
}

export const adminApp = initializeFirebaseAdmin();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export { FieldValue as adminFieldValue };

export default adminApp;
