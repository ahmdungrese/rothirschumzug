const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');
const path = require('path');

// 1. Check for --confirm-reset flag
if (!process.argv.includes('--confirm-reset')) {
  console.error("Fehler: Das Script muss mit dem Flag '--confirm-reset' aufgerufen werden.");
  console.error("Beispiel: node resetDatabase.js --confirm-reset");
  process.exit(1);
}

// 2. Initialize Firebase Admin SDK
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Fehler: Service-Account-Key nicht gefunden unter ${serviceAccountPath}`);
  console.error("Bitte lade die JSON-Datei aus der Firebase Console herunter und nenne sie 'serviceAccountKey.json'.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

initializeApp({
  credential: cert(serviceAccount),
  // Falls storageBucket nicht automatisch erkannt wird, aus Projekt-ID ableiten:
  storageBucket: `${serviceAccount.project_id}.appspot.com` 
});

const db = getFirestore();
const bucket = getStorage().bucket();

const COLLECTIONS_TO_DELETE = [
  'orders', 'invoices', 'customers', 'auditLog',
  'orders_demo', 'invoices_demo', 'customers_demo', 'auditLog_demo',
  'demo_system', 'demo_users', 'system_demo'
];

async function clearStoragePrefix(prefix) {
  console.log(`Lösche Storage-Dateien mit Präfix: ${prefix}...`);
  try {
    const [files] = await bucket.getFiles({ prefix });
    if (files.length === 0) {
      console.log(`Keine Dateien unter ${prefix} gefunden.`);
      return;
    }
    for (const file of files) {
      await file.delete();
    }
    console.log(`[OK] Storage-Dateien gelöscht: ${prefix}`);
  } catch (err) {
    if (err.code === 404 || err.message.includes('No such object')) {
      console.log(`[SKIP] Storage Bucket oder Präfix existiert nicht: ${prefix}`);
    } else {
      console.error(`Fehler beim Löschen von Storage ${prefix}:`, err.message);
    }
  }
}

async function runReset() {
  console.log("Starte Datenbank-Reset...");
  
  // 3. Delete collections (with subcollections if recursiveDelete is available)
  for (const colName of COLLECTIONS_TO_DELETE) {
    console.log(`Lösche Collection: ${colName}...`);
    try {
      const colRef = db.collection(colName);
      if (typeof db.recursiveDelete === 'function') {
        await db.recursiveDelete(colRef);
      } else {
        // Fallback for older admin sdk, just top-level docs
        const snapshot = await colRef.get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      console.log(`[OK] Collection gelöscht: ${colName}`);
    } catch (err) {
      console.error(`Fehler beim Löschen der Collection ${colName}:`, err.message);
    }
  }

  // 4. Delete related Storage files
  await clearStoragePrefix('orders/');
  await clearStoragePrefix('invoices/');
  await clearStoragePrefix('customers/');
  await clearStoragePrefix('orders_demo/');
  await clearStoragePrefix('invoices_demo/');
  await clearStoragePrefix('customers_demo/');

  // 5. Reset counters in system/settings
  console.log("Setze Nummernzähler in system/settings auf 1...");
  try {
    await db.doc('system/settings').set({
      nextOfferNumber: 1,
      nextOrderNumber: 1,
      nextInvoiceNumber: 1
    }, { merge: true });
    console.log(`[OK] Nummernzähler erfolgreich zurückgesetzt.`);
  } catch (err) {
    console.error("Fehler beim Zurücksetzen der Zähler:", err.message);
  }

  console.log("===================================");
  console.log("Reset abgeschlossen!");
  console.log("Datenbank ist leer, Zähler auf 1, Einstellungen & User erhalten.");
}

runReset().catch(console.error);
