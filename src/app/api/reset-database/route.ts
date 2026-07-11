import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage, adminFieldValue } from '@/lib/firebaseAdmin';

const COLLECTIONS_TO_DELETE = [
  'orders', 'invoices', 'customers', 'activity_logs',
  'orders_demo', 'invoices_demo', 'customers_demo', 'activity_logs_demo'
];

// Hilfsfunktion: Überprüft das Auth-Token und die Admin-Rolle
async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  
  const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
  let userData = userDoc.data();
  
  if (!userData) {
    // Wie im Frontend AuthContext-Fallback: Profil als admin anlegen, wenn es in der DB fehlt
    userData = { role: 'admin', email: decodedToken.email };
    await adminDb.collection('users').doc(decodedToken.uid).set(userData);
  }

  if (userData.role !== 'admin') {
    console.error("verifyAdmin failed. UID:", decodedToken.uid, "userData:", userData);
    throw new Error('Forbidden');
  }

  return decodedToken.uid;
}

// Hilfsfunktion: Storage Prefix leeren
async function clearStoragePrefix(prefix: string) {
  const bucket = adminStorage.bucket();
  let count = 0;
  try {
    const [files] = await bucket.getFiles({ prefix });
    for (const file of files) {
      await file.delete();
      count++;
    }
  } catch (err: any) {
    if (err.code !== 404 && !err.message?.includes('No such object')) {
      console.error(`Fehler beim Löschen von Storage ${prefix}:`, err);
    }
  }
  return count;
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAdmin(req);
    
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'reset';

    if (action === 'count') {
      // Nur Zählen (Pre-flight für Bestätigungs-Dialog)
      const counts: Record<string, number> = {};
      for (const col of COLLECTIONS_TO_DELETE) {
        const snap = await adminDb.collection(col).count().get();
        counts[col] = snap.data().count;
      }
      return NextResponse.json({ success: true, counts });
    }

    if (action === 'reset') {
      const results: Record<string, any> = { deletedDocs: {}, deletedFiles: 0 };
      
      // 1. Collections löschen
      for (const colName of COLLECTIONS_TO_DELETE) {
        try {
          const colRef = adminDb.collection(colName);
          const snap = await colRef.count().get();
          const count = snap.data().count;
          
          if (typeof adminDb.recursiveDelete === 'function') {
             await adminDb.recursiveDelete(colRef);
          } else {
             // Fallback für Batch-Delete
             const querySnap = await colRef.get();
             const batch = adminDb.batch();
             querySnap.docs.forEach(doc => batch.delete(doc.ref));
             await batch.commit();
          }
          results.deletedDocs[colName] = count;
        } catch (err: any) {
          console.error(`Fehler beim Löschen der Collection ${colName}:`, err);
        }
      }

      // 2. Storage Dateien löschen
      const prefixes = [
        'orders/', 'invoices/', 'customers/', 
        'orders_demo/', 'invoices_demo/', 'customers_demo/'
      ];
      let totalFiles = 0;
      for (const prefix of prefixes) {
        totalFiles += await clearStoragePrefix(prefix);
      }
      results.deletedFiles = totalFiles;

      // 3. Settings Zähler zurücksetzen
      await adminDb.doc('system/settings').set({
        nextQuoteNumber: 1,
        nextOrderNumber: 1,
        nextInvoiceNumber: 1
      }, { merge: true });

      await adminDb.doc('system_demo/settings').set({
        nextQuoteNumber: 1,
        nextOrderNumber: 1,
        nextInvoiceNumber: 1
      }, { merge: true });

      // 4. Activity Log Eintrag für den Reset erstellen (überlebt den Delete)
      await adminDb.collection('activity_logs').add({
        action: 'database_reset',
        performedBy: uid,
        timestamp: adminFieldValue.serverTimestamp(),
        details: 'Full reset performed via developer button'
      });

      return NextResponse.json({ success: true, results });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Reset Database Error:', error);
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
